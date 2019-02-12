import fs from 'fs';
import { Readable, Stream } from 'stream';

import dropStream from 'drop-stream';
import lazystream from 'lazystream';
import mergeStream from 'merge-stream';
import multistream from 'multistream';
import playbackStream from 'playback-stream';
import PluginError from 'plugin-error';
import pumpify from 'pumpify';
import simpleRandom from 'simple-random';
import vinylFS from 'vinyl-fs';

import appPackageManifest from './appPackageManifest';
import BuildError from './util/BuildError';
import buildTargets, { BuildTargetDescriptor } from './buildTargets';
import collectComponentSourceMaps from './collectComponentSourceMaps';
import compile from './compile';
import compileTranslations from './compileTranslations';
import { makeDeviceManifest, makeCompanionManifest } from './componentManifest';
import componentTargets, { ComponentType } from './componentTargets';
import convertImageToTXI, {
  ConvertImageToTXIOptions,
  TXIOutputFormat,
} from './convertImageToTXI';
import { errataPrimaryExpressionInSwitch } from './errataWorkarounds';
import eventsIntercept from './util/eventsIntercept';
import gulpMagicString from './gulpMagicString';
import gulpSetProperty from './gulpSetProperty';
import {
  logDiagnosticToConsole,
  Diagnostic,
  DiagnosticCategory,
  DiagnosticHandler,
  DiagnosticTarget,
} from './diagnostics';
import filterResourceTag from './filterResourceTag';
import findEntryPoint from './findEntryPoint';
import nativeComponents from './nativeComponents';
import pluginError from './util/pluginError';
import { PolyfillMap } from './plugins/polyfill';
import ProjectConfiguration, {
  normalizeProjectConfig,
  validate,
} from './ProjectConfiguration';
import * as resources from './resources';
import sdkVersion from './sdkVersion';
import validateIcon from './validateIcon';
import vinylAssertFiles from './vinylAssertFiles';
import zip from './zip';

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

function addDiagnosticTarget(
  target: DiagnosticTarget,
  onDiagnostic: DiagnosticHandler,
) {
  return (diagnostic: Diagnostic) => onDiagnostic({ target, ...diagnostic });
}

function addErrorTarget(
  target: DiagnosticTarget,
  fn: () => NodeJS.ReadableStream,
): NodeJS.ReadableStream {
  function wrap(err: any) {
    if (BuildError.is(err) || pluginError.isPluginError(err)) {
      (err as any).target = target;
    }
    return err;
  }

  try {
    const buildStream = eventsIntercept(fn());
    buildStream.intercept('error', (err, done) => done(null, wrap(err)));
    return buildStream;
  } catch (ex) {
    throw wrap(ex);
  }
}

function lazyObjectReadable(fn: () => Readable) {
  return new lazystream.Readable(fn, { objectMode: true });
}

export function loadProjectConfig({
  onDiagnostic = logDiagnosticToConsole,
  fileName = 'package.json',
}) {
  try {
    const config = normalizeProjectConfig(
      JSON.parse(fs.readFileSync(fileName, 'utf-8')),
    );
    const diagnostics = validate(config);
    diagnostics.diagnostics.forEach((diagnostic) =>
      onDiagnostic({ file: { path: fileName }, ...diagnostic }),
    );

    if (diagnostics.fatalError) {
      throw new Error('Project configuration is invalid');
    }

    if (config.enableProposedAPI) {
      onDiagnostic({
        category: DiagnosticCategory.Warning,
        // tslint:disable-next-line:max-line-length
        messageText:
          'Targeting proposed API may cause your app to behave unexpectedly. Use only when needed for development or QA.',
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
  polyfills = {},
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration;
  component: ComponentType;
  onDiagnostic?: DiagnosticHandler;
  polyfills?: PolyfillMap;
}) {
  const { inputs, outputDir, notFoundIsFatal } = componentTargets[component];

  const entryPoint = findEntryPoint(inputs, {
    onDiagnostic,
    component,
    notFoundIsFatal,
  });
  if (!entryPoint) return;

  return lazyObjectReadable(
    () =>
      new pumpify.obj(
        compile({
          component,
          onDiagnostic,
          entryPoint,
          outputDir,
          polyfills,
          allowUnknownExternals: projectConfig.enableProposedAPI,
          defaultLanguage: projectConfig.defaultLanguage,
        }),
        gulpSetProperty({
          componentType: component,
        }),
      ),
  );
}

export function buildDeviceResources(
  projectConfig: ProjectConfiguration,
  { resourceFilterTag }: BuildTargetDescriptor,
  onDiagnostic = logDiagnosticToConsole,
) {
  const convertImageToTXIOptions: ConvertImageToTXIOptions = {};
  if (sdkVersion().major >= 2) {
    convertImageToTXIOptions.rgbaOutputFormat = TXIOutputFormat.RGBA6666;
  }

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
  projectConfig: ProjectConfiguration;
  buildId: string;
  onDiagnostic?: DiagnosticHandler;
}) {
  return multistream.obj([
    // Sequence the build process: wait until compilation finishes
    // before building the resources for each component.
    ...projectConfig.buildTargets.map((family) =>
      lazyObjectReadable(() => {
        const { platform, displayName, polyfills } = buildTargets[family];
        onDiagnostic({
          messageText: `Building app for ${displayName}`,
          category: DiagnosticCategory.Message,
        });

        const sourceMap = collectComponentSourceMaps();
        // Split so that JS doesn't pass through resource filtering
        return new pumpify.obj(
          mergeStream(
            new pumpify.obj(
              // TODO: remove is-defined assertion ('!')
              buildComponent({
                projectConfig,
                onDiagnostic,
                polyfills,
                component: ComponentType.DEVICE,
              })!,
              sdkVersion().major < 3
                ? gulpMagicString(errataPrimaryExpressionInSwitch)
                : new Stream.PassThrough({ objectMode: true }),
              sourceMap.collector(ComponentType.DEVICE, family),
            ),
            new pumpify.obj(
              // Things can start glitching out if multiple vinylFS.src()
              // streams with the same glob pattern are in use
              // concurrently. (IPD-102519)
              // We're serializing the execution of the pipelines, so
              // there should not be any opportunity for glitches as only
              // one vinylFS stream is active at a time. Wrapping the
              // vinylFS stream in a playbackStream would be safer, but
              // would buffer all the resources into memory at once with
              // no backpressure. We like our users and don't want to eat
              // all their RAM, so we just have to be careful not to
              // introduce a regression when modifying this code.
              vinylFS.src('./resources/**', { base: '.' }),
              buildDeviceResources(
                projectConfig,
                buildTargets[family],
                onDiagnostic,
              ),
            ),
            sdkVersion().major >= 3
              ? new pumpify.obj(
                  vinylFS.src(componentTargets.device.translationsGlob, {
                    base: '.',
                  }),
                  compileTranslations(projectConfig.defaultLanguage),
                )
              : new Stream.PassThrough({ objectMode: true }),
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
      }),
    ),
  ]);
}

export function buildCompanion({
  projectConfig,
  buildId,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
  onDiagnostic?: DiagnosticHandler;
}) {
  const sourceMaps = collectComponentSourceMaps();

  const diagnosticTargets = {
    [ComponentType.COMPANION]: DiagnosticTarget.Companion,
    [ComponentType.SETTINGS]: DiagnosticTarget.Settings,
    [ComponentType.DEVICE]: DiagnosticTarget.App,
  };

  const [companion, settings] = [
    ComponentType.COMPANION,
    ComponentType.SETTINGS,
  ].map((componentType) => {
    const targetedDiagnostic = addDiagnosticTarget(
      diagnosticTargets[componentType],
      onDiagnostic,
    );
    const component = buildComponent({
      projectConfig,
      component: componentType,
      onDiagnostic: targetedDiagnostic,
    });
    if (component) {
      return lazyObjectReadable(() => {
        targetedDiagnostic({
          category: DiagnosticCategory.Message,
          messageText: `Building ${diagnosticTargets[componentType]}`,
        });
        return new pumpify.obj(
          addErrorTarget(diagnosticTargets[componentType], () => component),
          sourceMaps.collector(componentType),
        );
      });
    }
    return component;
  });

  if (settings && !companion) {
    throw new BuildError(
      'This project is being built with settings, but has no companion component.',
    );
  }

  const components = [companion, settings].filter(
    (component): component is pumpify => component !== undefined,
  );
  if (components.length === 0) return;

  return lazyObjectReadable(
    () =>
      new pumpify.obj(
        multistream.obj(components),
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
      ),
  );
}

export function buildAppPackage({
  projectConfig,
  buildId,
  existingDeviceComponents,
  onDiagnostic = logDiagnosticToConsole,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
  existingDeviceComponents?: Readable;
  onDiagnostic?: DiagnosticHandler;
}) {
  const components = [];

  if (existingDeviceComponents) {
    components.push(existingDeviceComponents);
  } else {
    components.push(
      addErrorTarget(DiagnosticTarget.App, () =>
        buildDeviceComponents({
          projectConfig,
          buildId,
          onDiagnostic: addDiagnosticTarget(DiagnosticTarget.App, onDiagnostic),
        }),
      ),
    );
  }

  const companion = buildCompanion({
    projectConfig,
    buildId,
    onDiagnostic: addDiagnosticTarget(DiagnosticTarget.Companion, onDiagnostic),
  });

  if (companion) components.push(companion);

  return new pumpify.obj(
    multistream.obj(components),
    appPackageManifest({
      projectConfig,
      buildId,
    }),
    zip('app.fba'),
  );
}

export function buildProject({
  nativeDeviceComponentPaths = [],
  onDiagnostic = logDiagnosticToConsole,
}: {
  nativeDeviceComponentPaths?: string[];
  onDiagnostic?: DiagnosticHandler;
}) {
  let buildId: string;
  let existingDeviceComponents: Readable | undefined;

  const projectConfig = loadProjectConfig({ onDiagnostic });

  if (nativeDeviceComponentPaths.length > 0) {
    ({ buildId, existingDeviceComponents } = nativeComponents(
      projectConfig.appUUID,
      nativeDeviceComponentPaths,
    ));
  } else {
    buildId = generateBuildId();
  }

  return buildAppPackage({
    projectConfig,
    buildId,
    onDiagnostic,
    existingDeviceComponents,
  }).on('finish', () => {
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
  dest = vinylFS.dest('./build'),
  onDiagnostic = logDiagnosticToConsole,
  nativeDeviceComponentPaths,
}: {
  dest?: Stream;
  nativeDeviceComponentPaths?: string[];
  onDiagnostic?: DiagnosticHandler;
} = {}) {
  return new Promise<void>((resolve, reject) => {
    new pumpify.obj(
      buildProject({ nativeDeviceComponentPaths, onDiagnostic }),
      dest,
    )
      .on('error', reject)
      .on('finish', resolve);
  }).catch((e) => {
    if (pluginError.isPluginError(e) && pluginError.isProjectBuildError(e)) {
      onDiagnostic(pluginError.convertToDiagnostic(e));
      return Promise.reject();
    }
    if (BuildError.is(e)) {
      onDiagnostic(e.toDiagnostic());
      return Promise.reject();
    }
    return Promise.reject(e);
  });
}
