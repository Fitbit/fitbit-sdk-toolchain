import path from 'path';

import * as rollup from 'rollup';
import rollupPluginBabel from 'rollup-plugin-babel';
import rollupPluginCommonjs from 'rollup-plugin-commonjs';
import rollupPluginNodeResolve from 'rollup-plugin-node-resolve';
import ts from 'typescript';

import componentTargets, { ComponentType } from './componentTargets';
import {
  DiagnosticCategory,
  DiagnosticHandler,
  logDiagnosticToConsole,
} from './diagnostics';
import rollupToVinyl from './rollupToVinyl';
import sdkVersion from './sdkVersion';

import forbidAbsoluteImport from './plugins/forbidAbsoluteImport';
import i18nPolyfill from './plugins/i18nPolyfill';
import platformExternals from './plugins/platformExternals';
import polyfill, { PolyfillMap } from './plugins/polyfill';
import polyfillDevice from './plugins/polyfillDevice';
import resourceImports from './plugins/resourceImports';
import terser from './plugins/terser';
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
  entryPoint,
  outputDir,
  defaultLanguage,
  allowUnknownExternals = false,
  onDiagnostic = logDiagnosticToConsole,
  polyfills = {},
}: {
  component: ComponentType;
  entryPoint: string;
  outputDir?: string;
  defaultLanguage: string;
  allowUnknownExternals?: boolean;
  onDiagnostic?: DiagnosticHandler;
  polyfills?: PolyfillMap;
}) {
  const ecma = component !== ComponentType.DEVICE ? 6 : 5;
  const { translationsGlob } = componentTargets[component];
  return rollupToVinyl(
    {
      input: entryPoint,
      plugins: [
        // Polyfills must come before platform externals
        polyfill(polyfills),
        ...pluginIf(
          (sdkVersion().major >= 4 ||
            (sdkVersion().major === 3 && sdkVersion().minor >= 1)) &&
            component === ComponentType.DEVICE,
          polyfillDevice,
        ),
        ...pluginIf(
          (sdkVersion().major >= 4 ||
            (sdkVersion().major === 3 && sdkVersion().minor >= 1)) &&
            component !== ComponentType.DEVICE,
          () => polyfill(i18nPolyfill(translationsGlob, defaultLanguage)),
        ),
        platformExternals(component),
        typescript({
          onDiagnostic,
          tsconfigOverride: {
            ...tsconfigOverrides,
            target: ecma === 6 ? ts.ScriptTarget.ES2015 : ts.ScriptTarget.ES5,
          },
          tsconfigSearchPath: path.dirname(entryPoint),
        }),
        ...pluginIf(component === ComponentType.SETTINGS, resourceImports),
        forbidAbsoluteImport(),
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
              require('@babel/plugin-syntax-dynamic-import'),
            ],
            compact: false,
            babelrc: false,
            // We include JSON here to get a more sane error that includes the path
            extensions: ['.js', '.json'],
            // Types for babel are broken and don't accept anything but an object here
            inputSourceMap: false as any,
          }),
        ),
        terser({
          ecma,
          // We still support iOS 10, which ships Safari 10
          safari10: component !== ComponentType.DEVICE,
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
      ],
      onwarn: rollupWarningHandler({
        onDiagnostic,
        codeCategories: allowUnknownExternals
          ? { UNRESOLVED_IMPORT: DiagnosticCategory.Warning }
          : undefined,
      }),
      inlineDynamicImports: true,
    },
    {
      dir: outputDir,
      file: outputDir === undefined ? `${component}.js` : undefined,
      format: 'cjs',
      sourcemap: true,
      // mapPath is relative to outputDir,
      sourcemapPathTransform: (mapPath) =>
        path.normalize(
          outputDir === undefined ? mapPath : path.join(outputDir, mapPath),
        ),
    },
  );
}
