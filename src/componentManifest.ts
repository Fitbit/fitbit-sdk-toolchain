import { Transform } from 'stream';

import gulpFile from 'gulp-file';
import Vinyl from 'vinyl';

import componentTargets from './componentTargets';
import { normalizeToPOSIX } from './pathUtils';
import ProjectConfiguration, { AppType } from './ProjectConfiguration';
import * as resources from './resources';
import { apiVersions } from './sdkVersion';

const manifestPath = 'manifest.json';

interface ComponentManifest {
  apiVersion: string;
  buildId: string;
  bundleDate: string;
  name: string;
  requestedPermissions?: string[];
  uuid: string;
}

interface DeviceManifest extends ComponentManifest {
  appManifestVersion: 1;
  // Enum values are hardcoded instead of reusing AppType since this
  // interface describes the manifest as the device expects it,
  // independent of data structures elsewhere. We want the build to
  // fail if the AppType enum changes such that it becomes incompatible
  // with what the device expects.
  appType: 'app' | 'clockface';
  i18n: {
    [locale: string]: {
      name?: string;
      resources?: string;
    };
  };
  iconFile?: string;
  main: string;
  svgMain: string;
  svgWidgets: string;
  wipeColor?: string;
}

interface CompanionManifest extends ComponentManifest {
  manifestVersion: 2;
  companion: {
    main: string;
  };
  settings?: {
    main: string;
  };
}

function makeCommonManifest({
  projectConfig,
  buildId,
  apiVersion,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
  apiVersion: string;
}): ComponentManifest {
  return {
    apiVersion,
    buildId,
    bundleDate: new Date().toISOString(),
    uuid: projectConfig.appUUID,
    name: projectConfig.appDisplayName,
    requestedPermissions: projectConfig.requestedPermissions,
  };
}

export function makeDeviceManifest({
  projectConfig,
  buildId,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
}) {
  const manifest: DeviceManifest = {
    appManifestVersion: 1,
    main: componentTargets.device.output,
    svgMain: resources.svgMain,
    svgWidgets: resources.svgWidgets,
    appType: projectConfig.appType,
    i18n: projectConfig.i18n,
    ...makeCommonManifest({
      projectConfig,
      buildId,
      apiVersion: apiVersions(projectConfig).deviceApi,
    }),
  };

  if (projectConfig.appType !== AppType.CLOCKFACE) {
    manifest.iconFile = projectConfig.iconFile;
    manifest.wipeColor = projectConfig.wipeColor;
  }

  return new Transform({
    objectMode: true,

    transform(file: Vinyl, _, next) {
      const lang: string | undefined = file.translationLanguage;

      if (lang) {
        if (manifest.i18n[lang] === undefined) manifest.i18n[lang] = {};
        manifest.i18n[lang].resources = normalizeToPOSIX(file.relative);
      }

      next(undefined, file);
    },

    flush(done) {
      // Ensure the default locale is the first listed in the manifest
      const {
        [projectConfig.defaultLocale]: defaultLocale,
        ...otherLocales
      } = manifest.i18n;
      manifest.i18n = {
        [projectConfig.defaultLocale]: defaultLocale,
        ...otherLocales,
      };

      done(
        undefined,
        new Vinyl({
          cwd: '',
          base: undefined,
          path: manifestPath,
          contents: Buffer.from(JSON.stringify(manifest)),
        }),
      );
    },
  });
}

export function makeCompanionManifest({
  projectConfig,
  hasSettings,
  buildId,
}: {
  projectConfig: ProjectConfiguration;
  hasSettings: boolean;
  buildId: string;
}) {
  const manifest: CompanionManifest = {
    manifestVersion: 2,
    companion: { main: componentTargets.companion.output },
    ...makeCommonManifest({
      projectConfig,
      buildId,
      apiVersion: apiVersions(projectConfig).companionApi,
    }),
  };

  if (hasSettings) {
    manifest.settings = { main: componentTargets.settings.output };
  }
  return gulpFile(manifestPath, JSON.stringify(manifest));
}
