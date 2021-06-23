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

  /**
   * List of App Cluster IDs requested by this app.
   *
   * Currently, only one cluster ID is permitted per app.
   * Cluster IDs must be 1-64 characters long, consisting of alphanumeric characters
   * separated by periods.
   *
   * On device, this field is capped at 64 bytes (not including the null char).
   */
  appClusters?: string[];

  /**
   * Developer Profile ID.
   *
   * On device, this field is capped at 36 bytes (not including the null char).
   */
  developerProfileId?: string;
}

interface DeviceManifestBase extends ComponentManifest {
  /**
   * The version of the manifest.
   */
  appManifestVersion: 1;

  /**
   * List of localized resources.
   *
   * On device, when this field is read, the value of the `i18n` field is
   * capped to 1024 bytes (not including the null char).
   */
  i18n: Locales;

  /**
   * Path to the main app script.
   *
   * On device, this field is capped at 256 bytes (not including the null char).
   * @example 'app/index.js'
   */
  main: string;

  /**
   * Features supported by the application.
   */
  supports?: SupportedDeviceCapabilities;
}

interface WithSVG {
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
   * @example 'resources/widget.defs'
   */
  svgWidgets: string;
}

interface AppDeviceManifest extends DeviceManifestBase, WithSVG {
  /**
   * Marks that this device component is part of a JavaScript application.
   *
   * If none is specified, it will default to 'app' for backwards compatibility.
   * On device, this field is capped at 10 bytes (not including the null char).
   */
  appType: 'app';

  /**
   * Wipe color to use for the app.
   *
   * On device, this field is capped at 7 bytes (not including the null char).
   * @example '#00b0b9'
   */
  wipeColor?: string;

  /**
   * Path to the app icon file.
   *
   * On device, this field is capped at 127 bytes (not including the null char).
   * @example 'resources/icon.png'
   */
  iconFile?: string;
}

interface ClockDeviceManifest extends DeviceManifestBase, WithSVG {
  /**
   * Marks that this device component is part of a JavaScript clock face.
   *
   * If none is specified, it will default to 'app' for backwards compatibility.
   * On device, this field is capped at 10 bytes (not including the null char).
   */
  appType: 'clockface';
}

interface ServiceDeviceManifest extends DeviceManifestBase {
  /**
   * Marks that this device component is part of a JavaScript service.
   *
   * If none is specified, it will default to 'app' for backwards compatibility.
   * On device, this field is capped at 10 bytes (not including the null char).
   */
  appType: 'service';
}

type DeviceManifest =
  | AppDeviceManifest
  | ClockDeviceManifest
  | ServiceDeviceManifest;

interface CompanionManifest extends ComponentManifest {
  manifestVersion: 2;
  companion: {
    main: string;
  };
  settings?: {
    main: string;
  };
  defaultWakeInterval?: number;
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
  const manifest: ComponentManifest = {
    apiVersion,
    buildId,
    bundleDate: new Date().toISOString(),
    uuid: projectConfig.appUUID,
    name: projectConfig.appDisplayName,
    requestedPermissions: projectConfig.requestedPermissions,
  };

  if (projectConfig.appClusterID) {
    manifest.appClusters = projectConfig.appClusterID;
  }

  if (projectConfig.developerID) {
    manifest.developerProfileId = projectConfig.developerID;
  }

  return manifest;
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
      if (!entryPoint) {
        return done(
          new PluginError(
            PLUGIN_NAME,
            'No entry point was generated for device component',
          ),
        );
      }

      // Ensure the default language is the first listed in the manifest
      const {
        [projectConfig.defaultLanguage]: defaultLanguage,
        ...otherLocales
      } = locales;

      const { deviceApi: apiVersion } = apiVersions(projectConfig);
      const supports = SupportedDeviceCapabilities.create(targetDevice);

      // FW is case sensitive for locales, it insists on everything being lowercase
      // Doing this too early means the casing won't match the developers defaultLanguage
      // setting, so do it as late as possible
      const i18n = lodash.mapKeys(
        {
          [projectConfig.defaultLanguage]: defaultLanguage,
          ...otherLocales,
        },
        (_, locale) => locale.toLowerCase(),
      );

      const manifestBase: DeviceManifestBase = {
        i18n,
        appManifestVersion: 1,
        main: entryPoint,
        ...makeCommonManifest({
          projectConfig,
          buildId,
          apiVersion,
        }),
        ...(supports && { supports }),
      };

      let manifest: DeviceManifest;

      switch (projectConfig.appType) {
        case AppType.APP:
          manifest = {
            appType: AppType.APP,
            ...manifestBase,
            iconFile: projectConfig.iconFile,
            wipeColor: projectConfig.wipeColor,
            svgMain: resources.svgMain,
            svgWidgets: resources.svgWidgets,
          };
          break;
        case AppType.CLOCKFACE:
          manifest = {
            appType: AppType.CLOCKFACE,
            ...manifestBase,
            svgMain: resources.svgMain,
            svgWidgets: resources.svgWidgets,
          };
          break;
        case AppType.SERVICE:
          manifest = {
            appType: AppType.SERVICE,
            ...manifestBase,
          };
          break;
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

      if (projectConfig.companionDefaultWakeInterval) {
        manifest.defaultWakeInterval =
          projectConfig.companionDefaultWakeInterval;
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
