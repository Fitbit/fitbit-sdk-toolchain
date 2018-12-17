import gulpTerser from 'gulp-terser';
import pumpify from 'pumpify';
import * as rollup from 'rollup';
import rollupPluginBabel from 'rollup-plugin-babel';
import rollupPluginCommonjs from 'rollup-plugin-commonjs';
import rollupPluginJson from 'rollup-plugin-json';
import rollupPluginNodeResolve from 'rollup-plugin-node-resolve';
import ts from 'typescript';

import componentTargets, { ComponentType } from './componentTargets';
import {
  DiagnosticCategory,
  DiagnosticHandler,
  logDiagnosticToConsole,
} from './diagnostics';
import externals from './externals';
import rollupToVinyl from './rollupToVinyl';
import sdkVersion from './sdkVersion';

import brokenImports from './plugins/brokenImports';
import forbidAbsoluteImport from './plugins/forbidAbsoluteImport';
import i18nPolyfill from './plugins/i18nPolyfill';
import polyfill from './plugins/polyfill';
import polyfillDevice from './plugins/polyfillDevice';
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

function pluginIf(condition: boolean, plugin: () => rollup.Plugin) {
  return condition ? [plugin()] : [];
}

export default function compile({
  component,
  input,
  output,
  fallbackLocale,
  allowUnknownExternals = false,
  onDiagnostic = logDiagnosticToConsole,
}: {
  component: ComponentType;
  input: string;
  output: string;
  fallbackLocale: string;
  allowUnknownExternals?: boolean;
  onDiagnostic?: DiagnosticHandler;
}) {
  const ecma =
    sdkVersion().major >= 3 && component !== ComponentType.DEVICE ? 6 : 5;
  const { translationsGlob } = componentTargets[component];
  return new pumpify.obj([
    rollupToVinyl(
      output,
      {
        input,
        external: externals[component],
        plugins: [
          typescript({
            onDiagnostic,
            tsconfigOverride: {
              ...tsconfigOverrides,
              target: ecma === 6 ? ts.ScriptTarget.ES2015 : ts.ScriptTarget.ES5,
            },
          }),
          ...pluginIf(component === ComponentType.DEVICE, polyfillDevice),
          ...pluginIf(component !== ComponentType.DEVICE, () =>
            polyfill(i18nPolyfill(translationsGlob, fallbackLocale)),
          ),
          ...pluginIf(
            sdkVersion().major < 3 || component === ComponentType.SETTINGS,
            resourceImports,
          ),
          ...pluginIf(sdkVersion().major < 2, rollupPluginJson),
          forbidAbsoluteImport(),
          ...pluginIf(sdkVersion().major < 2, brokenImports),
          rollupPluginNodeResolve({ preferBuiltins: false }),
          rollupPluginCommonjs({ include: ['node_modules/**'] }),
          ...pluginIf(ecma === 5, () =>
            rollupPluginBabel({
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
              // Types for babel are broken and don't accept anything but an object here
              inputSourceMap: false as any,
            }),
          ),
        ],
        onwarn: rollupWarningHandler({
          onDiagnostic,
          codeCategories: allowUnknownExternals
            ? { UNRESOLVED_IMPORT: DiagnosticCategory.Warning }
            : undefined,
        }),
      },
      {
        format: 'cjs',
        sourcemap: true,
      },
    ),
    gulpTerser({
      ecma,
      mangle: {
        toplevel: true,
      },
      output: {
        // Fitbit OS versions before 2.2 couldn't handle multiple statements per line and still
        // give correct position info
        // Mobile doesn't give correct column info, so also one statement per line
        // Happily this causes a negligible difference in code size
        semicolons: false,
      },
      // Compression produces bad source maps
      // https://github.com/mishoo/UglifyJS2#source-maps-and-debugging
      compress: false,
    }),
  ]);
}
