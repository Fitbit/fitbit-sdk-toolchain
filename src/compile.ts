import * as rollup from 'rollup';
import rollupPluginBabel from 'rollup-plugin-babel';
import rollupPluginCommonjs from 'rollup-plugin-commonjs';
import rollupPluginJson from 'rollup-plugin-json';
import rollupPluginNodeResolve from 'rollup-plugin-node-resolve';
import ts from 'typescript';

import {
  DiagnosticCategory,
  DiagnosticHandler,
  logDiagnosticToConsole,
} from './diagnostics';
import rollupToVinyl from './rollupToVinyl';
import sdkVersion from './sdkVersion';

import brokenImports from './plugins/brokenImports';
import forbidAbsoluteImport from './plugins/forbidAbsoluteImport';
import resourceImports from './plugins/resourceImports';
import typescript from './plugins/typescript';
import rollupWarningHandler from './rollupWarningHandler';

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
      onwarn: rollupWarningHandler({
        onDiagnostic,
        codeCategories: allowUnknownExternals ?
          { UNRESOLVED_IMPORT: DiagnosticCategory.Warning } : undefined,
      }),
    },
    {
      format: 'cjs',
      sourcemap: true,
    },
  );
}
