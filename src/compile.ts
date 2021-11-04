import path from 'path';

import * as rollup from 'rollup';
import pluginBabel from '@rollup/plugin-babel';
import pluginCommonjs from '@rollup/plugin-commonjs';
import pluginNodeResolve from '@rollup/plugin-node-resolve';
import ts from 'typescript';
import semver from 'semver';

import componentTargets, { ComponentType } from './componentTargets';
import {
  DiagnosticCategory,
  DiagnosticHandler,
  logDiagnosticToConsole,
} from './diagnostics';
import rollupToVinyl from './rollupToVinyl';

import forbidAbsoluteImport from './plugins/forbidAbsoluteImport';
import i18nPolyfill from './plugins/i18nPolyfill';
import * as platformExternals from './plugins/platformExternals';
import polyfill from './plugins/polyfill';
import resourceImports from './plugins/resourceImports';
import workaroundRequireScope from './plugins/workaroundRequireScope';
import terser from './plugins/terser';
import typescript from './plugins/typescript';
import rollupWarningHandler from './rollupWarningHandler';
import sdkVersion from './sdkVersion';
import weatherPolyfill from './plugins/weatherPolyfill';

// TODO: emit a warning when any of these settings are
// defined in the app's tsconfig
const tsconfigOverrides = {
  noEmitHelpers: false,
  importHelpers: true,
  noResolve: false,
  noEmit: false,
  inlineSourceMap: false,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  module: ts.ModuleKind.ESNext,
  suppressOutputPathCheck: true,
};

function pluginIf(condition: boolean, plugin: () => rollup.Plugin) {
  return condition ? [plugin()] : [];
}

const deviceModulesWithoutDefaultExports = new Set([
  'crypto',
  'document',
  'fs',
  'jpeg',
  'power',
  'scientific',
  'scientific/signal',
  'system',
  'user-activity',
  'user-settings',
]);

export default function compile({
  component,
  entryPoint,
  outputDir,
  defaultLanguage,
  allowUnknownExternals = false,
  onDiagnostic = logDiagnosticToConsole,
}: {
  component: ComponentType;
  entryPoint: string;
  outputDir?: string;
  defaultLanguage: string;
  allowUnknownExternals?: boolean;
  onDiagnostic?: DiagnosticHandler;
}) {
  const { translationsGlob } = componentTargets[component];
  return rollupToVinyl(
    {
      input: entryPoint,
      plugins: [
        ...pluginIf(component !== ComponentType.DEVICE, () =>
          polyfill(i18nPolyfill(translationsGlob, defaultLanguage)),
        ),
        ...pluginIf(
          component === ComponentType.COMPANION &&
            semver.satisfies(sdkVersion(), '~6.0.0'),
          () => polyfill(weatherPolyfill),
        ),
        platformExternals.plugin(component),
        typescript({
          onDiagnostic,
          tsconfigOverride: {
            ...tsconfigOverrides,
            target: ts.ScriptTarget.ES2020,
          },
          tsconfigSearchPath: path.dirname(entryPoint),
        }),
        ...pluginIf(component === ComponentType.SETTINGS, resourceImports),
        forbidAbsoluteImport(),
        pluginNodeResolve({ preferBuiltins: false }),
        pluginCommonjs({ include: ['node_modules/**'] }),
        // ...pluginIf(ecma === 5, () =>
        //   pluginBabel({
        //     plugins: [
        //       // Plugins are specified in this way to avoid this:
        //       // https://github.com/webpack/webpack/issues/1866
        //       // Also makes this work correctly in a browser environment
        //       require('@babel/plugin-transform-block-scoped-functions'),
        //       require('@babel/plugin-transform-block-scoping'),
        //       require('@babel/plugin-syntax-dynamic-import'),
        //     ],
        //     compact: false,
        //     babelrc: false,
        //     // We include JSON here to get a more sane error that includes the path
        //     extensions: ['.js', '.json'],
        //     // Types for babel are broken and don't accept anything but an object here
        //     inputSourceMap: false as any,
        //     babelHelpers: 'bundled',
        //   }),
        // ),
        // Must come before terser in order not to wrap strict directive
        workaroundRequireScope(),
        terser({
          ecma: 6,
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
          compress: {
            toplevel: true,
            arrows: component !== ComponentType.DEVICE,
            keep_infinity: component !== ComponentType.DEVICE,
            passes: 2,
            sequences: false,
          },
        }),
      ],
      onwarn: rollupWarningHandler({
        onDiagnostic,
        codeCategories: allowUnknownExternals
          ? { UNRESOLVED_IMPORT: DiagnosticCategory.Warning }
          : undefined,
      }),
      // Companion/Settings have no FS and therefore can't use code splitting
      inlineDynamicImports: component !== ComponentType.DEVICE,
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
      interop: (id: string | null) => {
        if (id === null) {
          return 'auto';
        }

        // If this is not a built-in module, use 'interop: auto'.
        if (platformExternals.externals[component].indexOf(id) === -1) {
          return 'auto';
        }

        // Some of the built-in modules do not have a default export.
        // Pretend one exists for compatibility reasons up to SDK 6.0
        if (
          component === ComponentType.DEVICE &&
          deviceModulesWithoutDefaultExports.has(id) &&
          sdkVersion().major < 6
        ) {
          return 'auto';
        }

        return 'esModule';
      },
    },
  );
}
