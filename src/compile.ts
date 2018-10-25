import { relative } from 'path';

import * as rollup from 'rollup';
import rollupPluginBabel from 'rollup-plugin-babel';
import rollupPluginCommonjs from 'rollup-plugin-commonjs';
import rollupPluginJson from 'rollup-plugin-json';
import rollupPluginNodeResolve from 'rollup-plugin-node-resolve';
import ts from 'typescript';

import {
  DiagnosticCategory,
  DiagnosticHandler,
  DiagnosticMessage,
  logDiagnosticToConsole,
} from './diagnostics';
import rollupToVinyl from './rollupToVinyl';
import sdkVersion from './sdkVersion';

import brokenImports from './plugins/brokenImports';
import forbidAbsoluteImport from './plugins/forbidAbsoluteImport';
import resourceImports from './plugins/resourceImports';
import typescript from './plugins/typescript';

// TODO: emit a warning when any of these settings are
// defined in the app's tsconfig
const tsconfigOverrides = {
  noEmitHelpers: false,
  importHelpers: true,
  noResolve: false,
  noEmit: false,
  inlineSourceMap: false,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  module: ts.ModuleKind.ES2015,
  suppressOutputPathCheck: true,
};

type CodeCategoryMap = { [code: string]: DiagnosticCategory };

const defaultCodeCategories: CodeCategoryMap = {
  EMPTY_BUNDLE: DiagnosticCategory.Error,
  MISSING_EXPORT: DiagnosticCategory.Error,
  NAMESPACE_CONFLICT: DiagnosticCategory.Error,
  UNRESOLVED_IMPORT: DiagnosticCategory.Error,
};

const messageFormatter: { [code: string]: (w: rollup.RollupWarning) => string } = {
  UNRESOLVED_IMPORT: w => `${w.source} is imported by ${w.importer}, but could not be resolved`,
};

function relativeId(id: string) {
  if (typeof process === 'undefined' || !/^(?:\/|(?:[A-Za-z]:)?[\\|/])/.test(id)) return id;
  return relative(process.cwd(), id);
}

function defaultFormatter(w: rollup.RollupWarning) {
  return w.loc ?
    `${relativeId(w.loc.file)} (${w.loc.line}:${w.loc.column}) ${w.message!}` : w.message!;
}

const rollupWarningToDiagnostic = (codeCategories = defaultCodeCategories) =>
  (warning: rollup.RollupWarning | string) => {
    if (typeof warning === 'string') {
      return {
        category: DiagnosticCategory.Warning,
        messageText: warning,
      };
    }

    const { code } = warning;

    // TypeScript emits `var _this = this;` at the top level for
    // transpiled fat-arrow functions. Filter out the noise so as not to
    // confuse users with a warning that they can't do anything about.
    if (code === 'THIS_IS_UNDEFINED') return;

    let category = DiagnosticCategory.Warning;
    if (code && codeCategories[code]) category = codeCategories[code];

    let formatter = defaultFormatter;
    if (code && messageFormatter[code]) formatter = messageFormatter[code];

    let messageText: string | DiagnosticMessage[] = formatter(warning);
    if (warning.frame) {
      const context = {
        messageText: warning.frame,
        category: DiagnosticCategory.Message,
      };
      messageText = [{ messageText, category }, context];
    }

    return { messageText, category };
  };

function conditionalPlugin(include: boolean, plugin: rollup.Plugin) {
  return include ? [plugin] : [];
}

export default function compile(
  input: string,
  output: string,
  {
    external = [],
    allowUnknownExternals = false,
    ecma = sdkVersion().major >= 3 ? 6 : 5,
    onDiagnostic = logDiagnosticToConsole,
  } : {
    external?: rollup.ExternalOption,
    allowUnknownExternals?: boolean,
    ecma?: 5 | 6,
    onDiagnostic?: DiagnosticHandler,
  },
) {
  const convertRollupWarning = rollupWarningToDiagnostic({
    ...defaultCodeCategories,
    ...(allowUnknownExternals && { UNRESOLVED_IMPORT: DiagnosticCategory.Warning }),
  });
  return rollupToVinyl(
    output,
    {
      external,
      input,
      plugins: [
        typescript({
          onDiagnostic,
          tsconfigOverride: {
            ...tsconfigOverrides,
            target: ecma === 6 ? ts.ScriptTarget.ES2015 : ts.ScriptTarget.ES5,
          },
        }),
        resourceImports(),
        ...conditionalPlugin(sdkVersion().major < 2, rollupPluginJson()),
        forbidAbsoluteImport(),
        ...conditionalPlugin(sdkVersion().major < 2, brokenImports()),
        rollupPluginNodeResolve({ preferBuiltins: false }),
        rollupPluginCommonjs({ include: ['node_modules/**'] }),
        ...conditionalPlugin(ecma === 5, rollupPluginBabel({
          plugins: [
            // Plugins are specified in this way to avoid this:
            // https://github.com/webpack/webpack/issues/1866
            // Also makes this work correctly in a browser environment
            require('@babel/plugin-transform-block-scoped-functions'),
            require('@babel/plugin-transform-block-scoping'),
          ],
          compact: false,
          babelrc: false,
          // We include JSON here to get a more sane error that includes the path
          extensions: ['.js', '.json'],
        })),
      ],
      onwarn: (w: rollup.RollupWarning | string) => {
        const diagnostic = convertRollupWarning(w);
        if (!diagnostic) return;
        onDiagnostic(diagnostic);
        if (diagnostic.category !== DiagnosticCategory.Error) return;
        throw new Error('Compile failed.');
      },
    },
    {
      format: 'cjs',
      sourcemap: true,
    },
  );
}
