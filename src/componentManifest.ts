import { Transform } from 'stream';

import lodash from 'lodash';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

import { SupportedDeviceCapabilities } from './capabilities';
import { ComponentType } from './componentTargets';
import { normalizeToPOSIX } from './pathUtils';
import ProjectConfiguration, { AppType } from './ProjectConfiguration';
import * as resources from './resources';
import { apiVersions } from './sdkVersion';

const PLUGIN_NAME = 'componentManifest';
const manifestPath = 'manifest.json';

/**
 * Descriptor for localized resources.
 */
interface Locales {
  /**
   * Lower case locale name.
   *
   * On device, this field is capped at 20 bytes (not including the null char).
   * @example 'en-us'
   */
  [locale: string]: {
    /**
     * Localized name of the app.
     *
     * On device, this field is capped at 30 bytes (not including the null
     * char).
     */
    name?: string;

    /**
     * Path to the resources file for the locale, relative to the manifest file.
     *
     * This file is generated from the corresponding '.po' file using an
     * internal, more compact format. On device, this field is capped at
     * 256 bytes (not including the null char).
     * @example 'l/en-US'
     */
    resources?: string;
  };
}

interface ComponentManifest {
  /**
   * API version.
   *
   * On device, this field is capped at 32 bytes (not including the null char).
   */
  apiVersion: string;

  /**
   * Build ID, represented by a hex-formatted 64 bit int, prefixed with '0x'.
   *
   * On device, this field is capped at 20 bytes (not including the null char).
   * @example '0xcafecafecafecafe'
   */
  buildId: string;

  /**
   * The date the bundle was generated, formatted according to the ISO 8601
   * standard.
   */
  bundleDate: string;

  /**
   * Default non-localized app name.
   *
   * On device, this field is capped at 30 bytes (not including the null char).
   */
  name: string;

  /**
   * List of permissions required by the app.
   *
   * On device, each permission name is capped at 30 bytes (not including the
   * null char).
   */
  requestedPermissions?: string[];

  /**
   * Unique app ID.
   *
   * On device, this field is capped at 36 bytes (not including the null char).
   */
  uuid: string;
}

interface DeviceManifest extends ComponentManifest {
  /**
   * The version of the manifest.
   */
  appManifestVersion: 1;

  /**
   * JS App type.
   *
   * If none is specified, it will default to 'app' for backwards compatibility.
   * On device, this field is capped at 10 bytes (not including the null char).
   *
   * Enum values are hardcoded instead of reusing AppType since this
   * interface describes the manifest as the device expects it,
   * independent of data structures elsewhere. We want the build to
   * fail if the AppType enum changes such that it becomes incompatible
   * with what the device expects.
   */
  appType: 'app' | 'clockface';

  /**
   * List of localized resources.
   *
   * On device, when this field is read, the value of the `i18n` field is
   * capped to 1024 bytes (not including the null char).
   */
  i18n: Locales;

  /**
   * Path to the app icon file.
   *
   * On device, this field is capped at 127 bytes (not including the null char).
   * @example 'resources/icon.png'
   */
  iconFile?: string;

  /**
   * Path to the main app script.
   *
   * On device, this field is capped at 256 bytes (not including the null char).
   * @example 'app/index.js'
   */
  main: string;

  /**
   * Path to the main SVG file.
   *
   * On device, this field is capped at 256 bytes (not including the null char).
   * @example 'resources/index.view'
   */
  svgMain: string;

  /**
   * Path to the widgets SVG file.
   *
   * On device, this field is capped at 256 bytes (not including the null char).
   * @example 'resources/widgets.defs'
   */
  svgWidgets: string;

  /**
   * Wipe color to use for the app.
   *
   * On device, this field is capped at 7 bytes (not including the null char).
   * @example '#00b0b9'
   */
  wipeColor?: string;

  /**
   * Features supported by the application.
   */
  supports?: SupportedDeviceCapabilities;
}

interface CompanionManifest extends ComponentManifest {
  manifestVersion: 2;
  companion: {
    main: string;
  };
  settings?: {
    main: string;
  };
  appClusters?: string[];
  developerProfileId?: string;
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
  targetDevice,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
  targetDevice: string;
}) {
  const locales: Locales = projectConfig.i18n;
  let entryPoint: string | undefined;

  return new Transform({
    objectMode: true,

    transform(file: Vinyl, _, next) {
      const lang: string | undefined = file.translationLanguage;

      if (lang) {
        if (locales[lang] === undefined) locales[lang] = {};
        locales[lang].resources = normalizeToPOSIX(file.relative);
      }

      if (file.isEntryPoint) {
        if (file.componentType === ComponentType.DEVICE) {
          if (entryPoint) {
            return next(
              new PluginError(
                PLUGIN_NAME,
                'Multiple entry points were generated for device, only one is allowed',
              ),
            );
          }
          entryPoint = normalizeToPOSIX(file.relative);
        } else {
          return next(
            new PluginError(
              PLUGIN_NAME,
              `Entry point for unrecognised component found: ${file.componentType}`,
            ),
          );
        }
      }

      next(undefined, file);
    },

    flush(done) {
      // Ensure the default language is the first listed in the manifest
      const {
        [projectConfig.defaultLanguage]: defaultLanguage,
        ...otherLocales
      } = locales;

      if (!entryPoint) {
        return done(
          new PluginError(
            PLUGIN_NAME,
            'No entry point was generated for device component',
          ),
        );
      }

      const { deviceApi } = apiVersions(projectConfig);
      const supports = SupportedDeviceCapabilities.create(
        deviceApi,
        targetDevice,
      );

      const manifest: DeviceManifest = {
        appManifestVersion: 1,
        main: entryPoint,
        svgMain: resources.svgMain,
        svgWidgets: resources.svgWidgets,
        appType: projectConfig.appType,
        ...makeCommonManifest({
          projectConfig,
          buildId,
          apiVersion: deviceApi,
        }),
        ...(supports && { supports }),
        // FW is case sensitive for locales, it insists on everything being lowercase
        // Doing this too early means the casing won't match the developers defaultLanguage
        // setting, so do it as late as possible
        i18n: lodash.mapKeys(
          {
            [projectConfig.defaultLanguage]: defaultLanguage,
            ...otherLocales,
          },
          (_, locale) => locale.toLowerCase(),
        ),
        ...(projectConfig.appType !== AppType.CLOCKFACE && {
          iconFile: projectConfig.iconFile,
          wipeColor: projectConfig.wipeColor,
        }),
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
  let companionEntryPoint: string;
  let settingsEntryPoint: string;

  return new Transform({
    objectMode: true,

    transform(file: Vinyl, _, next) {
      const isEntryPoint: boolean | undefined = file.isEntryPoint;
      if (isEntryPoint) {
        if (file.componentType === ComponentType.COMPANION) {
          if (companionEntryPoint) {
            return next(
              new PluginError(
                PLUGIN_NAME,
                'Multiple entry points were generated for companion, only one is allowed',
              ),
            );
          }
          companionEntryPoint = normalizeToPOSIX(file.relative);
        } else if (file.componentType === ComponentType.SETTINGS) {
          if (settingsEntryPoint) {
            return next(
              new PluginError(
                PLUGIN_NAME,
                'Multiple entry points were generated for settings, only one is allowed',
              ),
            );
          }
          settingsEntryPoint = normalizeToPOSIX(file.relative);
        } else {
          return next(
            new PluginError(
              PLUGIN_NAME,
              `Entry point for unrecognised component found: ${file.componentType}`,
            ),
          );
        }
      }

      next(undefined, file);
    },

    flush(done) {
      if (!companionEntryPoint) {
        return done(
          new PluginError(
            PLUGIN_NAME,
            'No entry point was generated for companion component',
          ),
        );
      }

      const manifest: CompanionManifest = {
        manifestVersion: 2,
        companion: { main: companionEntryPoint },
        ...makeCommonManifest({
          projectConfig,
          buildId,
          apiVersion: apiVersions(projectConfig).companionApi,
        }),
      };

      if (hasSettings) {
        if (!settingsEntryPoint) {
          return done(
            new PluginError(
              PLUGIN_NAME,
              'No entry point was generated for settings component',
            ),
          );
        }
        manifest.settings = { main: settingsEntryPoint };
      }

      if (projectConfig.appClusterID) {
        manifest.appClusters = [projectConfig.appClusterID];
      }

      if (projectConfig.developerID) {
        manifest.developerProfileId = projectConfig.developerID;
      }

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
