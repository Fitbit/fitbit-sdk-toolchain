import fs from 'fs';
import { Stream } from 'stream';

import gulpUglifyEs from 'gulp-uglify-es';
import mergeStream from 'merge-stream';
import PluginError from 'plugin-error';
import pumpify from 'pumpify';
import simpleRandom from 'simple-random';
import vinylFS from 'vinyl-fs';

import appPackageManifest from './appPackageManifest';
import buildTargets, { BuildTargetDescriptor } from './buildTargets';
import collectComponentSourceMaps from './collectComponentSourceMaps';
import compile from './compile';
import compileTranslations from './compileTranslations';
import { makeDeviceManifest, makeCompanionManifest } from './componentManifest';
import componentTargets, { ComponentType } from './componentTargets';
import convertImageToTXI, { ConvertImageToTXIOptions, TXIOutputFormat } from './convertImageToTXI';
import { errataPrimaryExpressionInSwitch } from './errataWorkarounds';
import gulpMagicString from './gulpMagicString';
import gulpSetProperty from './gulpSetProperty';
import {
  logDiagnosticToConsole,
  Diagnostic,
  DiagnosticCategory,
  DiagnosticHandler,
  DiagnosticTarget,
} from './diagnostics';
import externals from './externals';
import filterResourceTag from './filterResourceTag';
import findEntryPoint from './findEntryPoint';
import ProjectConfiguration, { normalizeProjectConfig, validate } from './ProjectConfiguration';
import * as resources from './resources';
import sdkVersion from './sdkVersion';
import validateIcon from './validateIcon';
import vinylAssertFiles from './vinylAssertFiles';
import zip from './zip';
import {
  isPluginError,
  isProjectBuildError,
  convertPluginErrorToDiagnostic,
} from './buildError';

export { DiagnosticCategory };

export function generateBuildId() {
  return `0x0${simpleRandom({
    // Edge doesn't support the crypto API in a WebWorker
    // so we fallback to Math.random here in that case
    secure: simpleRandom.isSecureSupported,
    chars: '0123456789abcdef',
    length: 15,
  })}`;
}

function addDiagnosticTarget(target: DiagnosticTarget, onDiagnostic: DiagnosticHandler) {
  return (diagnostic: Diagnostic) => onDiagnostic({ target, ...diagnostic });
}

export function loadProjectConfig({
  onDiagnostic = logDiagnosticToConsole,
  fileName = 'package.json',
}) {
  try {
    const config = normalizeProjectConfig(JSON.parse(
      fs.readFileSync(fileName, 'utf-8'),
    ));
    const diagnostics = validate(config);
    diagnostics.diagnostics.forEach(
      diagnostic => onDiagnostic({ file: { path: fileName }, ...diagnostic }),
    );

    if (diagnostics.fatalError) throw new Error('Project configuration is invalid');

    if (config.enableProposedAPI) {
      onDiagnostic({
        category: DiagnosticCategory.Warning,
        // tslint:disable-next-line:max-line-length
        messageText: 'Targeting proposed API may cause your app to behave unexpectedly. Use only when needed for development or QA.',
      });
    }

    return config;
  } catch (err) {
    throw new PluginError('projectConfig', err, { fileName });
  }
}

export function buildComponent({
  projectConfig,
  component,
  ecma,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration,
  component: ComponentType,
  ecma?: 5 | 6,
  onDiagnostic?: DiagnosticHandler,
}) {
  const { inputs, output, notFoundIsFatal } = componentTargets[component];
  const entryPoint = findEntryPoint(
    inputs,
    { onDiagnostic, component, notFoundIsFatal },
  );
  if (!entryPoint) return;
  return new pumpify.obj(
    compile(entryPoint, output, {
      ecma,
      onDiagnostic,
      external: externals[component],
      allowUnknownExternals: projectConfig.enableProposedAPI,
    }),
    gulpUglifyEs({
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
  );
}

export function buildDeviceResources(
  projectConfig: ProjectConfiguration,
  { displayName, resourceFilterTag }: BuildTargetDescriptor,
  onDiagnostic = logDiagnosticToConsole,
) {
  onDiagnostic({
    messageText: `Building app for ${displayName}`,
    category: DiagnosticCategory.Message,
  });

  const convertImageToTXIOptions: ConvertImageToTXIOptions = {};
  if (sdkVersion().major >= 2) convertImageToTXIOptions.rgbaOutputFormat = TXIOutputFormat.RGBA6666;

  return new pumpify.obj(
    filterResourceTag(resourceFilterTag),
    validateIcon({ projectConfig, onDiagnostic }),
    convertImageToTXI(convertImageToTXIOptions),
    vinylAssertFiles([resources.svgMain, resources.svgWidgets]),
  );
}

export function buildDeviceComponents({
  projectConfig,
  buildId,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration,
  buildId: string,
  onDiagnostic?: DiagnosticHandler,
}) {
  // TODO: remove is-defined assertion ('!')
  const deviceJS = buildComponent({
    projectConfig,
    onDiagnostic,
    component: ComponentType.DEVICE,
    ecma: 5,
  })!;

  const errataPlugin = gulpMagicString(errataPrimaryExpressionInSwitch);
  const processedJS = sdkVersion().major >= 3 ? deviceJS : new pumpify.obj(deviceJS, errataPlugin);

  // Things can start glitching out if multiple vinylFS.src() streams
  // with the same glob pattern are in use concurrently. (IPD-102519)
  // Work around this by only using one copy of each source stream.
  const resources = vinylFS.src('./resources/**', { base: '.' });
  const pofiles = vinylFS.src('./i18n/**/*.po', { base: '.' });

  return projectConfig.buildTargets.map((family) => {
    const { platform } = buildTargets[family];
    const sourceMap = collectComponentSourceMaps();
    // Split so that JS doesn't pass through resource filtering
    return new pumpify.obj(
      mergeStream(
        new pumpify.obj(
          processedJS,
          sourceMap.collector(ComponentType.DEVICE, family),
        ),
        new pumpify.obj(
          resources,
          buildDeviceResources(projectConfig, buildTargets[family], onDiagnostic),
        ),
        new pumpify.obj(
          pofiles,
          compileTranslations(),
        ),
      ),
      makeDeviceManifest({ projectConfig, buildId }),
      zip(`device-${family}.zip`, { compress: sdkVersion().major >= 3 }),
      gulpSetProperty({
        componentBundle: {
          family,
          platform,
          type: 'device',
        },
      }),
      sourceMap.emitter,
    );
  });
}

export function buildCompanion({
  projectConfig,
  buildId,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration,
  buildId: string,
  onDiagnostic?: DiagnosticHandler,
}) {
  const sourceMaps = collectComponentSourceMaps();

  const diagnosticTargets = {
    [ComponentType.COMPANION]: DiagnosticTarget.Companion,
    [ComponentType.SETTINGS]: DiagnosticTarget.Settings,
    [ComponentType.DEVICE]: DiagnosticTarget.App,
  };

  const [companion, settings] = [ComponentType.COMPANION, ComponentType.SETTINGS]
    .map((componentType) => {
      let component = buildComponent({
        projectConfig,
        component: componentType,
        onDiagnostic: addDiagnosticTarget(diagnosticTargets[componentType], onDiagnostic),
      });
      if (component) {
        component = new pumpify.obj(
          component,
          sourceMaps.collector(componentType),
        );
      }
      return component;
    });

  if (settings && !companion) {
    throw new Error('This project is being built with settings, but has no companion component');
  }

  const components = [companion, settings]
    .filter((component): component is pumpify => component !== undefined);
  if (components.length === 0) return;

  return new pumpify.obj(
    mergeStream(components),
    makeCompanionManifest({
      projectConfig,
      buildId,
      hasSettings: !!settings,
    }),
    zip('companion.zip'),
    gulpSetProperty({
      componentBundle: { type: 'companion' },
    }),
    sourceMaps.emitter,
  );
}

export function buildAppPackage({
  projectConfig,
  buildId,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration,
  buildId: string,
  onDiagnostic?: DiagnosticHandler,
}) {
  const components = buildDeviceComponents({
    projectConfig,
    buildId,
    onDiagnostic: addDiagnosticTarget(DiagnosticTarget.App, onDiagnostic),
  });

  const companion = buildCompanion({
    projectConfig,
    buildId,
    onDiagnostic: addDiagnosticTarget(DiagnosticTarget.Companion, onDiagnostic),
  });

  if (companion) components.push(companion);

  return new pumpify.obj(
    mergeStream(components),
    appPackageManifest({
      projectConfig,
      buildId,
    }),
    zip('app.fba'),
  );
}

export function buildProject({ onDiagnostic = logDiagnosticToConsole } = {}) {
  const buildId = generateBuildId();
  const projectConfig = loadProjectConfig({ onDiagnostic });

  return buildAppPackage({ projectConfig, buildId, onDiagnostic })
    .on('finish', () => {
      onDiagnostic({
        messageText: `App UUID: ${projectConfig.appUUID}, BuildID: ${buildId}`,
        category: DiagnosticCategory.Message,
      });
    });
}

/**
 * If the build fails because there is a problem with the project,
 * the reason is sent as a diagnostic and the returned Promise rejects
 * with `undefined` as the reason. If the build fails for any other
 * reason, the returned Promise rejects with the error.
 */
export function build({
  dest = vinylFS.dest('./build') as Stream,
  onDiagnostic = logDiagnosticToConsole,
} = {}) {
  return new Promise<void>((resolve, reject) => {
    new pumpify.obj(
      buildProject({ onDiagnostic }),
      dest,
    )
      .on('error', reject)
      .on('finish', resolve);
  }).catch((e) => {
    if (isPluginError(e) && isProjectBuildError(e)) {
      onDiagnostic(convertPluginErrorToDiagnostic(e));
      return Promise.reject();
    }
    return Promise.reject(e);
  });
}
