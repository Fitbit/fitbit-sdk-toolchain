import humanizeList from 'humanize-list';
import { isHexColor, isUUID } from 'validator';
import lodash from 'lodash';
import semver from 'semver';

import buildTargets from './buildTargets';
import DiagnosticList from './DiagnosticList';
import { supportedTags, validateLanguageTag } from './languageTag';
import sdkVersion from './sdkVersion';

const knownBuildTargets = Object.keys(buildTargets);

export enum AppType {
  APP = 'app',
  CLOCKFACE = 'clockface',
}

export const VALID_APP_TYPES = Object.values(AppType);

export type LocalesConfig = { [locale: string]: { name: string } };

export interface BaseProjectConfiguration {
  appType: AppType;
  appDisplayName: string;
  appUUID: string;
  requestedPermissions: string[];
  i18n: LocalesConfig;
  defaultLanguage: string;
  buildTargets: string[];
  // We don't want to accidentally serialize `enableProposedAPI: false`
  // out to users' package.json files.
  enableProposedAPI?: true;
  appClusterID?: string;
  developerID?: string;
}

export interface AppProjectConfiguration extends BaseProjectConfiguration {
  appType: AppType.APP;
  wipeColor: string;
  iconFile: string;
}

export interface ClockProjectConfiguration extends BaseProjectConfiguration {
  appType: AppType.CLOCKFACE;
}

type ProjectConfiguration = AppProjectConfiguration | ClockProjectConfiguration;
export default ProjectConfiguration;

export const MAX_DISPLAY_NAME_LENGTH = 30;

export const LOCALES = Object.freeze({
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nl: 'Dutch',
  sv: 'Swedish',
  'zh-cn': 'Chinese (S)',
  'zh-tw': 'Chinese (T)',
});

enum Permission {
  ACCESS_ACTIVITY = 'access_activity',
  ACCESS_APP_CLUSTER_STORAGE = 'access_app_cluster_storage',
  ACCESS_EXERCISE = 'access_exercise',
  ACCESS_HEART_RATE = 'access_heart_rate',
  ACCESS_INTERNET = 'access_internet',
  ACCESS_LOCATION = 'access_location',
  ACCESS_SECURE_EXCHANGE = 'access_secure_exchange',
  ACCESS_USER_PROFILE = 'access_user_profile',
  FITBIT_TOKEN = 'fitbit_token',
  RUN_BACKGROUND = 'run_background',
  EXTERNAL_APP_COMMUNICATION = 'external_app_communication',
}

const permissionTypes = [
  {
    key: Permission.ACCESS_ACTIVITY,
    name: 'Activity',
    // tslint:disable-next-line:max-line-length
    description:
      'Read user activities for today (distance, calories, steps, elevation and active minutes), and daily goals.',
  },
  {
    key: Permission.ACCESS_USER_PROFILE,
    name: 'User Profile',
    // tslint:disable-next-line:max-line-length
    description:
      'Read non-identifiable personal information (gender, age, height, weight, resting HR, basal metabolic rate, stride, HR zones).',
  },
  {
    key: Permission.ACCESS_HEART_RATE,
    name: 'Heart Rate',
    description: 'Application may read the heart-rate sensor in real-time.',
  },
  {
    key: Permission.ACCESS_LOCATION,
    name: 'Location',
    description: 'Application and companion may use GPS.',
  },
  {
    key: Permission.ACCESS_INTERNET,
    name: 'Internet',
    description:
      'Companion may communicate with the Internet using your phone data connection.',
  },
  {
    key: Permission.RUN_BACKGROUND,
    name: 'Run in background',
    description:
      'Companion may run even when the application is not actively in use.',
  },
  {
    key: Permission.ACCESS_EXERCISE,
    name: 'Exercise Tracking',
    description: 'Application may track an exercise.',
    sdkVersion: '>=3.0.0',
  },
  {
    key: Permission.ACCESS_APP_CLUSTER_STORAGE,
    name: 'App Cluster Storage',
    description:
      'Application may access storage shared by other applications from the same developer.',
    // TODO: change this to the real versison
    sdkVersion: '>=999.0.0',
  },
];

const restrictedPermissionTypes = [
  {
    key: Permission.FITBIT_TOKEN,
    name: '[Restricted] Fitbit Token',
    description: 'Access Fitbit API token.',
  },
  {
    key: Permission.EXTERNAL_APP_COMMUNICATION,
    name: '[Restricted] External Application Communication',
    description:
      'Allows communication between external mobile applications and companion.',
  },
  {
    key: Permission.ACCESS_SECURE_EXCHANGE,
    name: '[Restricted] Secure Exchange',
    description: 'Allows securing any data and verifying that data was secured',
  },
];

function getAllPermissionTypes(enableProposedAPI: boolean) {
  return [
    ...restrictedPermissionTypes,
    ...permissionTypes.filter(
      (permission) =>
        !permission.sdkVersion ||
        semver.satisfies(sdkVersion(), permission.sdkVersion) ||
        enableProposedAPI,
    ),
  ];
}

function constrainedSetDiagnostics({
  actualValues,
  knownValues,
  valueTypeNoun,
  notFoundIsFatal = false,
}: {
  actualValues: ReadonlyArray<any>;
  knownValues: ReadonlyArray<any>;
  valueTypeNoun: string;
  notFoundIsFatal?: boolean;
}) {
  const unknownValues = lodash.without(actualValues, ...knownValues);
  const diagnostics = new DiagnosticList();

  if (unknownValues.length > 0) {
    const unknownValueStrings = unknownValues.filter(lodash.isString);
    const unknownValueOther = lodash
      .without(unknownValues, ...unknownValueStrings)
      .map(String);
    if (unknownValueStrings.length) {
      const errStr = `One or more ${valueTypeNoun} was invalid: ${unknownValueStrings.join(
        ', ',
      )}`;
      if (notFoundIsFatal) diagnostics.pushFatalError(errStr);
      else diagnostics.pushWarning(errStr);
    }
    if (unknownValueOther.length) {
      diagnostics.pushFatalError(
        `One or more ${valueTypeNoun} was not a string: ${unknownValueOther.join(
          ', ',
        )}`,
      );
    }
  }

  const duplicatedValues = lodash
    .uniq(actualValues)
    .filter(
      (value) =>
        actualValues.indexOf(value) !== actualValues.lastIndexOf(value),
    );
  if (duplicatedValues.length > 0) {
    diagnostics.pushWarning(
      `One or more ${valueTypeNoun} was specified multiple times: ${duplicatedValues.join(
        ', ',
      )}`,
    );
  }

  return diagnostics;
}

/**
 * Normalize the project configuration from a parsed package.json.
 *
 * @param config Configuration object
 * @param defaults Override the default values to use
 */
export function normalizeProjectConfig(
  config: any,
  defaults?: Partial<AppProjectConfiguration & ClockProjectConfiguration>,
): ProjectConfiguration {
  if (!lodash.isPlainObject(config)) {
    throw new TypeError('Project configuration root must be an object');
  }

  const mergedConfig: ProjectConfiguration = {
    // The *cough* default defaults
    appUUID: '',
    appType: AppType.APP,
    appDisplayName: '',
    iconFile: 'resources/icon.png',
    wipeColor: '',
    requestedPermissions: [],
    buildTargets: [],
    i18n: {},
    defaultLanguage: 'en-US',

    // Override defaults
    ...defaults,

    // The config object proper
    ...(config.fitbit as {}),
  };

  const { requestedPermissions } = mergedConfig;
  if (!Array.isArray(requestedPermissions)) {
    // tslint:disable-next-line:max-line-length
    throw new TypeError(
      `fitbit.requestedPermissions must be an array, not ${typeof requestedPermissions}`,
    );
  }

  return mergedConfig;
}

export function validateAppType(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();

  if (VALID_APP_TYPES.indexOf(config.appType) === -1) {
    const appTypeNames = humanizeList(VALID_APP_TYPES, { conjunction: 'or' });
    diagnostics.pushFatalError(
      `App type '${config.appType}' is invalid, expected ${appTypeNames}`,
    );
  }
  return diagnostics;
}

export function validateDisplayName(name: string) {
  if (name.length === 0) {
    return 'Display name must not be blank';
  }
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Display name must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters`;
  }
  return true;
}

export function validateProjectDisplayName(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  const result = validateDisplayName(config.appDisplayName);
  if (result !== true) {
    diagnostics.pushFatalError(result);
  }
  return diagnostics;
}

export function validateWipeColor(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  if (config.appType !== AppType.CLOCKFACE && !isHexColor(config.wipeColor)) {
    diagnostics.pushFatalError('Wipe color must be a valid hex color');
  }
  return diagnostics;
}

export function validateRequestedPermissions({
  enableProposedAPI,
  requestedPermissions,
}: ProjectConfiguration) {
  return constrainedSetDiagnostics({
    actualValues: requestedPermissions,
    knownValues: getAllPermissionTypes(!!enableProposedAPI).map(
      (permission) => permission.key,
    ),
    valueTypeNoun: 'requested permissions',
    notFoundIsFatal: false,
  });
}

export function validateBuildTarget({ buildTargets }: ProjectConfiguration) {
  const diagnostics = constrainedSetDiagnostics({
    actualValues: buildTargets,
    knownValues: knownBuildTargets,
    valueTypeNoun: 'build targets',
    notFoundIsFatal: true,
  });

  if (buildTargets.length === 0) {
    diagnostics.pushFatalError('At least one build target must be enabled');
  }

  return diagnostics;
}

export function validateLocaleDisplayName(
  { i18n }: ProjectConfiguration,
  localeKey: keyof typeof LOCALES,
) {
  const diagnostics = new DiagnosticList();
  const locale = i18n[localeKey];

  if (!locale) return diagnostics;

  if (!locale.name || locale.name.length === 0) {
    // tslint:disable-next-line:max-line-length
    diagnostics.pushFatalError(
      `Localized display name for ${LOCALES[localeKey]} must not be blank`,
    );
  }
  if (locale.name.length > MAX_DISPLAY_NAME_LENGTH) {
    // tslint:disable-next-line:max-line-length
    diagnostics.pushFatalError(
      `Localized display name for ${
        LOCALES[localeKey]
      } must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters`,
    );
  }

  return diagnostics;
}

export function validateLocaleDisplayNames(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  for (const localeKey of Object.keys(LOCALES)) {
    diagnostics.extend(
      validateLocaleDisplayName(config, localeKey as keyof typeof LOCALES),
    );
  }
  return diagnostics;
}

export function validateSupportedLocales({ i18n }: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();

  const unknownLocales = lodash.without(
    Object.keys(i18n),
    ...Object.keys(LOCALES),
  );
  if (unknownLocales.length > 0) {
    diagnostics.pushWarning(`Invalid locales: ${unknownLocales.join(', ')}`);
  }

  return diagnostics;
}

export function validateAppUUID({ appUUID }: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  if (!isUUID(String(appUUID))) {
    diagnostics.pushFatalError(
      'appUUID must be a valid UUID, run "npx fitbit-build generate-appid" to fix',
    );
  }

  return diagnostics;
}

export function validateDefaultLanguage(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  if (!validateLanguageTag(config.defaultLanguage)) {
    diagnostics.pushFatalError(
      `Default language is an invalid language tag: ${
        config.defaultLanguage
      }. Must be ${humanizeList(supportedTags, { conjunction: 'or' })}.`,
    );
  }
  return diagnostics;
}

export function validateStorageGroup(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();

  const hasRequestedPermission = getAllPermissionTypes(
    !!config.enableProposedAPI,
  )
    .map((permission) => permission.key)
    .filter((permission) =>
      (config.requestedPermissions || []).includes(permission),
    )
    .includes(Permission.ACCESS_APP_CLUSTER_STORAGE);

  if (hasRequestedPermission) {
    if (config.appClusterID === undefined) {
      diagnostics.pushFatalError(
        'App Cluster ID must be set when the App Cluster Storage permission is requested',
      );
    } else if (
      config.appClusterID.length < 1 ||
      config.appClusterID.length > 64
    ) {
      diagnostics.pushFatalError(
        'App Cluster ID must be between 1-64 characters',
      );
    } else if (!/^([a-z0-9]+)(\.[a-z0-9]+)*$/.test(config.appClusterID)) {
      diagnostics.pushFatalError(
        'App Cluster ID may only contain alphanumeric characters separated by periods, eg: my.app.123',
      );
    }

    if (config.developerID === undefined) {
      diagnostics.pushFatalError(
        'Developer ID must be set when the App Cluster Storage permission is requested',
      );
    } else if (!isUUID(String(config.developerID))) {
      diagnostics.pushFatalError('Developer ID must be a valid UUID');
    }
  } else if (
    config.appClusterID !== undefined ||
    config.developerID !== undefined
  ) {
    diagnostics.pushFatalError(
      'App Cluster Storage permission must be requested to set App Cluster ID and Developer ID fields',
    );
  }

  return diagnostics;
}

export function validate(config: ProjectConfiguration) {
  const diagnostics = new DiagnosticList();
  [
    validateAppUUID,
    validateProjectDisplayName,
    validateAppType,
    validateWipeColor,
    validateRequestedPermissions,
    validateBuildTarget,
    validateSupportedLocales,
    validateLocaleDisplayNames,
    validateDefaultLanguage,
    validateStorageGroup,
  ].forEach((validator) => diagnostics.extend(validator(config)));
  return diagnostics;
}
