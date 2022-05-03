import semver from 'semver';

import { DiagnosticCategory } from './diagnostics';
import ProjectConfiguration, * as config from './ProjectConfiguration';
import sdkVersion from './sdkVersion';

jest.mock('./sdkVersion', () => jest.fn(() => semver.parse('0.0.0')));

function mockSDKVersion(version: string) {
  const parsedSDKVersion = semver.parse(version);
  if (parsedSDKVersion === null) throw new Error(`Invalid version: ${version}`);
  const sdkVersionSpy = sdkVersion as jest.Mock;
  sdkVersionSpy.mockReturnValue(parsedSDKVersion);
}

const mockUUID = '672bc0d9-624c-4ea9-b08f-a4c05f552031';
const validPermission = 'access_location';
const invalidPermission = 'invalid';
const sdk3Permission = 'access_exercise';

beforeEach(() => mockSDKVersion('3.0.0'));

it('validates the length of the app display name', () => {
  const configFile: any = {
    appDisplayName: 'The quick brown fox jumped over the lazy dog',
  };
  expect(config.validateProjectDisplayName(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: `Display name must not exceed ${config.MAX_DISPLAY_NAME_LENGTH} characters`,
    }),
  );
});

it('validates the app display name is not empty', () => {
  const configFile: any = {
    appDisplayName: '',
  };
  expect(config.validateProjectDisplayName(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Display name must not be blank',
    }),
  );
});

it('allows app display names of acceptable length', () => {
  const configFile: any = {
    appDisplayName: 'My App',
  };
  expect(
    config.validateProjectDisplayName(configFile).diagnostics,
  ).toHaveLength(0);
});

it('validates the app type is not an invalid app type', () => {
  const configFile: any = {
    appType: 'invalid',
  };
  expect(config.validateAppType(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        "App type 'invalid' is invalid, expected app, clockface or service",
    }),
  );
});

it('validates app is a valid app type', () => {
  const configFile: any = {
    appType: config.AppType.APP,
  };
  expect(config.validateAppType(configFile).diagnostics).toHaveLength(0);
});

it('validates clockface is a valid app type', () => {
  const configFile: any = {
    appType: config.AppType.CLOCKFACE,
  };
  expect(config.validateAppType(configFile).diagnostics).toHaveLength(0);
});

it('does report invalid wipe color if app type is app', () => {
  const configFile: any = {
    appType: config.AppType.APP,
    wipeColor: 'invalid',
  };
  const { diagnostics } = config.validateWipeColor(configFile);
  expect(diagnostics).toMatchSnapshot();
});

it('does not validate wipe color is invalid if app type is clockface', () => {
  const configFile: any = {
    appType: config.AppType.CLOCKFACE,
    wipeColor: 'invalid',
  };
  expect(config.validateWipeColor(configFile).diagnostics).toHaveLength(0);
});

it('does not validate wipe color existence if app type is clockface', () => {
  const configFile: any = {
    appType: config.AppType.CLOCKFACE,
  };
  expect(config.validateWipeColor(configFile).diagnostics).toHaveLength(0);
});

it('validates the requested permissions are valid', () => {
  const configFile: any = {
    requestedPermissions: [invalidPermission],
  };
  expect(
    config.validateRequestedPermissions(configFile).diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: `One or more requested permissions was invalid: ${invalidPermission}`,
    }),
  );
});

it('validates the requested permissions are valid with the current sdk', () => {
  const configFile: any = {
    requestedPermissions: [sdk3Permission],
  };

  mockSDKVersion('2.0.0');

  expect(
    config.validateRequestedPermissions(configFile).diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: `One or more requested permissions was invalid: ${sdk3Permission}`,
    }),
  );
});

it('does not produce a warning if sdk version is satisfied for the requested permissions', () => {
  const configFile: any = {
    requestedPermissions: [sdk3Permission],
  };

  expect(
    config.validateRequestedPermissions(configFile).diagnostics,
  ).toHaveLength(0);
});

it('does not produce a validation warning for restricted permissions', () => {
  const configFile: any = {
    requestedPermissions: ['fitbit_token'],
  };
  expect(
    config.validateRequestedPermissions(configFile).diagnostics,
  ).toHaveLength(0);
});

it('validates the requested permissions are not duplicated', () => {
  const configFile: any = {
    requestedPermissions: [validPermission, validPermission, validPermission],
  };
  expect(
    config.validateRequestedPermissions(configFile).diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      // tslint:disable-next-line:max-line-length
      messageText: `One or more requested permissions was specified multiple times: ${validPermission}`,
    }),
  );
});

it('reports the correct validation warning for both invalid and non-string permissions', () => {
  const configFile: any = {
    requestedPermissions: [validPermission, invalidPermission, 123, null],
  };
  expect(config.validateRequestedPermissions(configFile).diagnostics).toEqual([
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: `One or more requested permissions was invalid: ${invalidPermission}`,
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'One or more requested permissions was not a string: 123, null',
    }),
  ]);
});

it.each<[string, any]>([
  ['a number', 3.14],
  ['an array', ['foo', 'bar']],
  ['null', null],
  ['a boolean', true],
])(
  'reports a validation warning if requested permissions includes %s',
  (_, vector) => {
    const configFile: any = {
      requestedPermissions: [vector],
    };
    expect(
      config.validateRequestedPermissions(configFile).diagnostics[0],
    ).toEqual(
      expect.objectContaining({
        category: DiagnosticCategory.Error,
        messageText: `One or more requested permissions was not a string: ${vector}`,
      }),
    );
  },
);

it('validates the supported locales are valid', () => {
  const configFile: any = {
    i18n: { invalid: { name: 'foo' } },
  };
  expect(config.validateSupportedLocales(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: 'Invalid locales: invalid',
    }),
  );
});

it('validates the length of the localized display name', () => {
  const configFile: any = {
    i18n: {
      'fr-FR': { name: 'The quick brown fox jumped over the lazy dog' },
    },
  };
  expect(
    config.validateLocaleDisplayName(configFile, 'fr-FR').diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      // tslint:disable-next-line:max-line-length
      messageText: `Localized display name for French must not exceed ${config.MAX_DISPLAY_NAME_LENGTH} characters`,
    }),
  );
});

it('validates the localized app display name is not empty', () => {
  const configFile: any = {
    i18n: {
      'fr-FR': { name: '' },
    },
  };
  expect(
    config.validateLocaleDisplayName(configFile, 'fr-FR').diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Localized display name for French must not be blank',
    }),
  );
});

it('validates multiple localized display names', () => {
  const configFile: any = {
    appType: config.AppType.CLOCKFACE,
    i18n: {
      'fr-FR': { name: '' },
      'it-IT': { name: '' },
    },
  };

  expect(config.validateLocaleDisplayNames(configFile).diagnostics).toEqual([
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Localized display name for French must not be blank',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Localized display name for Italian must not be blank',
    }),
  ]);
});

it('does not complain if appUUID is any canonical-format UUID string', () => {
  expect(
    config.validateAppUUID({
      appUUID: '00000000-0000-0000-0000-000000000000',
    } as any).diagnostics,
  ).toHaveLength(0);
});

it('validationErrors() validates all fields', () => {
  const configFile: any = {
    appUUID: 'invalid',
    appDisplayName: '',
    buildTargets: [],
    wipeColor: 'invalid',
    appType: 'invalid',
    requestedPermissions: [invalidPermission, validPermission],
    i18n: {
      'en-US': { name: '' },
      invalid: { name: 'foo' },
      'fr-FR': { name: '' },
    },
    defaultLanguage: '_invalid_',
    companionDefaultWakeInterval: '_invalid_',
    tiles: [],
  };
  const diagnostics = config.validate(configFile).diagnostics;
  expect(diagnostics).toEqual([
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'appUUID must be a valid UUID, run "npx fitbit-build generate-appid" to fix',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Display name must not be blank',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        "App type 'invalid' is invalid, expected app, clockface or service",
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: `One or more requested permissions was invalid: ${invalidPermission}`,
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText: 'Invalid locales: invalid',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Localized display name for English (US) must not be blank',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Localized display name for French must not be blank',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Default language is an invalid language tag: _invalid_. Must be en-US, de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, nl-NL, sv-SE, zh-CN, zh-TW, pt-BR, id-ID, ro-RO, ru-RU, pl-PL, cs-CZ or nb-NO.',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Default companion wake interval must be an integer value greater than or equal to 300000',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText:
        'Tiles available only for APPS. Skipping tile configuration!',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'At least one build target must be enabled',
    }),
  ]);

  // Check tile verification separate as tile verification runs only in case of appTile == APP
  const configFileTiles: any = {
    appType: 'app',
    appUUID: '00001849-0000-4000-8000-000000f17b17',
    appDisplayName: 'test',
    iconFile: 'resources/icon.png',
    wipeColor: '#ffffff',
    requestedPermissions: [],
    buildTargets: ['vulcan'],
    i18n: {},
    defaultLanguage: 'en-US',
    tiles: [
      {
        buildTargets: ['invalid'],
      },
    ],
  };
  const diagnosticsTiles = config.validate(configFileTiles, {
    hasNativeComponents: false,
  }).diagnostics;
  expect(diagnosticsTiles).toEqual([
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'One or more build targets was invalid: vulcan',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'One or more tile build targets was invalid: invalid',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: "Tile UUID can't be undefined",
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Tile UUID must be a valid UUID',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Tile name must be specified',
    }),
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText:
        'Tiles available only for native components. Skipping tile configuration!',
    }),
  ]);
});

it('validates that only apps have tiles configuration', () => {
  const configFile: any = {
    tiles: [],
    appType: config.AppType.CLOCKFACE,
  };
  expect(
    config.validateTileComponentAppType(configFile).diagnostics[0],
  ).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Warning,
      messageText:
        'Tiles available only for APPS. Skipping tile configuration!',
    }),
  );
});

describe('validateBuildTarget()', () => {
  it('validates values are valid build targets', () => {
    const configFile: any = {
      buildTargets: ['__always_unknown__'],
    };
    expect(
      config.validateBuildTarget(configFile, { hasNativeComponents: false })
        .diagnostics[0],
    ).toEqual(
      expect.objectContaining({
        category: DiagnosticCategory.Error,
        messageText:
          'One or more build targets was invalid: __always_unknown__',
      }),
    );
  });

  it('allows an empty list if native components are present', () => {
    const configFile: any = {
      buildTargets: [],
    };
    expect(
      config.validateBuildTarget(configFile, { hasNativeComponents: true })
        .diagnostics,
    ).toHaveLength(0);
  });

  it('allows missing field if native components are present', () => {
    const configFile: any = {};
    expect(
      config.validateBuildTarget(configFile, { hasNativeComponents: true })
        .diagnostics,
    ).toHaveLength(0);
  });
});

describe('validateTileBuildTarget()', () => {
  it('allows empty list for tiles', () => {
    expect(
      config.validateTileBuildTarget(
        {
          name: '__random__',
          uuid: '__random__',
        },
        {} as config.AppProjectConfiguration,
      ).diagnostics,
    ).toHaveLength(0);
  });

  it('validates values for tiles', () => {
    expect(
      config.validateTileBuildTarget(
        {
          name: '__random__',
          uuid: '__random__',
          buildTargets: ['_invalid_device_'],
        },
        {} as config.AppProjectConfiguration,
      ).diagnostics[0],
    ).toEqual(
      expect.objectContaining({
        category: DiagnosticCategory.Error,
        messageText:
          'One or more tile build targets was invalid: _invalid_device_',
      }),
    );
  });
});

describe('validateTileUUID()', () => {
  it('allow only valid UUID for tiles', () => {
    const configFile: any = {
      appUUID: '__invalid__',
      tiles: [],
    };
    expect(
      config.validateTileUUID(
        {
          name: '__random__',
          uuid: '',
        },
        configFile,
      ).diagnostics[0],
    ).toEqual(
      expect.objectContaining({
        category: DiagnosticCategory.Error,
        messageText: 'Tile UUID must be a valid UUID',
      }),
    );
  });

  it("doesn't allow duplicate uuids", () => {
    const configFile: any = {
      appUUID: '00001849-0000-4000-8000-000000f17b17',
      tiles: [
        {
          name: '__random__',
          uuid: '00001849-0000-4000-8000-000000f17b17',
        },
        {
          name: '__random__',
          uuid: '00001849-0000-4000-8000-000000f17b17',
        },
      ],
    };
    expect(
      config.validateTileUUID(configFile.tiles[0], configFile).diagnostics[0],
    ).toEqual(
      expect.objectContaining({
        category: DiagnosticCategory.Error,
        messageText: "Can't have duplicate UUIDs between tiles",
      }),
    );
  });

  it('allows duplicate between tile and app uuid', () => {
    const configFile: any = {
      appUUID: '00001849-0000-4000-8000-000000f17b17',
      tiles: [
        {
          name: '__random__',
          uuid: '00001849-0000-4000-8000-000000f17b17',
        },
      ],
    };
    expect(
      config.validateTileUUID(configFile.tiles[0], configFile).diagnostics,
    ).toHaveLength(0);
  });
});

describe('normalizeProjectConfig', () => {
  it.each<[string, any]>([
    ['a number', 3.14],
    ['an array', ['foo', 'bar']],
    ['null', null],
    ['a boolean', true],
    ['a string', 'fail'],
  ])('throws a TypeError if the config JSON root is %s', (_, configData) => {
    expect(() => config.normalizeProjectConfig(configData)).toThrow(TypeError);
  });

  it.each<[string, any]>([
    ['a number', 3.14],
    ['an object', { foo: 'bar' }],
    ['null', null],
    ['a boolean', true],
    ['a string', 'fail'],
  ])(
    'throws a TypeError if requestedPermissions is %s',
    (_, requestedPermissions) => {
      expect(() =>
        config.normalizeProjectConfig({ fitbit: { requestedPermissions } }),
      ).toThrow(TypeError);
    },
  );

  it('generates a string Array if appClusterID is a string', () => {
    const appClusterIDStr = 'foo';
    const configFile = config.normalizeProjectConfig({
      fitbit: {
        appClusterID: appClusterIDStr,
      },
    });
    expect(configFile.appClusterID).toEqual([appClusterIDStr]);
  });

  it.each<[string, any]>([
    ['a number', 3.14],
    ['an object', { foo: 'bar' }],
    ['null', null],
    ['a boolean', true],
  ])('throws a TypeError if appClusterID is %s', (_, clusterID) => {
    expect(() =>
      config.normalizeProjectConfig({
        fitbit: {
          appClusterID: clusterID,
        },
      }),
    ).toThrow(TypeError);
  });

  it('generates a new UUID if there is not one in the file', () => {
    const configFile = config.normalizeProjectConfig({}, { appUUID: mockUUID });
    expect(configFile.appUUID).toEqual(mockUUID);
  });

  it('does not generate a new UUID if one exists already', () => {
    const expectedUUID = 'd3f0198c-865c-4b62-8630-91d1480089fb';
    const configFile = config.normalizeProjectConfig({
      fitbit: {
        appUUID: expectedUUID,
      },
    });
    expect(configFile.appUUID).toEqual(expectedUUID);
  });

  it('defaults build targets to an empty array', () => {
    const configFile = config.normalizeProjectConfig({});
    expect(configFile.buildTargets).toHaveLength(0);
  });

  it('defaults default language to en-US', () => {
    const configFile = config.normalizeProjectConfig({});
    expect(configFile.defaultLanguage).toBe('en-US');
  });

  it('converts a language only display name locale into a full one', () => {
    const configFile = config.normalizeProjectConfig({
      fitbit: {
        i18n: {
          fr: 'French Name',
        },
      },
    });
    expect(configFile.i18n).toHaveProperty('fr-FR');
  });

  it('uses a full locale instead of a language only one if present', () => {
    const configFile = config.normalizeProjectConfig({
      fitbit: {
        i18n: {
          fr: 'French Name',
          'fr-FR': 'French French name',
        },
      },
    });
    expect(configFile.i18n['fr-FR']).toEqual('French French name');
  });
});

it('validates the default language is a valid language tag', () => {
  const configFile: any = {
    defaultLanguage: '_really_not_bcp_47_',
  };
  expect(config.validateDefaultLanguage(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Default language is an invalid language tag: _really_not_bcp_47_. Must be en-US, de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, nl-NL, sv-SE, zh-CN, zh-TW, pt-BR, id-ID, ro-RO, ru-RU, pl-PL, cs-CZ or nb-NO.',
    }),
  );
});

it('allows up to 4 cluster IDs', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      requestedPermissions: ['access_app_cluster_storage'],
      developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
      appClusterID: ['foo', 'bar', 'baz', 'qux'],
    },
  });
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics).toHaveLength(
    0,
  );
});

it('does not allow more than 4 cluster IDs', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      requestedPermissions: ['access_app_cluster_storage'],
      developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
      appClusterID: ['foo', 'bar', 'baz', 'qux', 'quux'],
    },
  });
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Only a maximum of 4 App Cluster IDs may be declared',
    }),
  );
});

it('validates app cluster ID is defined if app cluster storage permission is requested', () => {
  const configFile: any = {
    requestedPermissions: ['access_app_cluster_storage'],
    developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
  };
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'App Cluster ID must be set when the App Cluster Storage permission is requested',
    }),
  );
});

it.each([
  ['an empty string', ''],
  [
    'more than 64 characters long',
    '00000000000000000000000000000000000000000000000000000000000000000',
  ],
])('validates app cluster ID is not %s', (_, appClusterID) => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      appClusterID,
      requestedPermissions: ['access_app_cluster_storage'],
      developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
    },
  });
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: `App Cluster ID '${appClusterID}' must be between 1-64 characters`,
    }),
  );
});

it('validates app cluster ID is of correct format', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      requestedPermissions: ['access_app_cluster_storage'],
      developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
      appClusterID: 'foo_bar',
    },
  });
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: `App Cluster ID 'foo_bar' may only contain alphanumeric characters separated by periods, eg: my.app.123`,
    }),
  );
});

it('validates developer ID is defined if app cluster storage permission is requested', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      requestedPermissions: ['access_app_cluster_storage'],
      appClusterID: 'abc.123',
    },
  });
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Developer ID must be set when the App Cluster Storage permission is requested',
    }),
  );
});

it('validates developer ID is a valid UUID if app cluster storage permission is requested', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      requestedPermissions: ['access_app_cluster_storage'],
      appClusterID: '123',
      developerID: 'definitely_not_a_uuid',
    },
  });
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText: 'Developer ID must be a valid UUID',
    }),
  );
});

it('validates app cluster storage permission is requested if app cluster ID is set', () => {
  const configFile: any = {
    appClusterID: 'abc',
  };
  // TODO: fixme with real version
  mockSDKVersion('999.0.0');
  expect(config.validateStorageGroup(configFile).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'App Cluster Storage permission must be requested to set App Cluster ID and Developer ID fields',
    }),
  );
});

it('validates heap size is less than maximum allowed without internal permission', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      heapSize: 129,
    },
  });
  expect(config.validateHeapSize(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Heap size must be an integer value less than or equal to 128',
    }),
  );
});

it('validates heap size is more than minimum allowed without internal permission', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      heapSize: 63,
    },
  });
  expect(config.validateHeapSize(projectConfig).diagnostics[0]).toEqual(
    expect.objectContaining({
      category: DiagnosticCategory.Error,
      messageText:
        'Heap size must be an integer value greater than or equal to 64',
    }),
  );
});

it('does not validate heap size is less than maximum allowed with internal permission', () => {
  const projectConfig: ProjectConfiguration = config.normalizeProjectConfig({
    fitbit: {
      heapSize: 129,
      requestedPermissions: [config.Permission.FITBIT_INTERNAL],
    },
  });
  expect(config.validateHeapSize(projectConfig).diagnostics).toHaveLength(0);
});

describe('normalizeLocales()', () => {
  it('maps en to en-US', () => {
    expect(
      config.normalizeLocales({
        en: { name: 'English' },
      }),
    ).toEqual({
      'en-US': { name: 'English' },
    });
  });

  it('does not overwrite an existing en-US value', () => {
    expect(
      config.normalizeLocales({
        en: { name: 'English' },
        'en-US': { name: 'US English' },
      }),
    ).toEqual({
      'en-US': { name: 'US English' },
    });
  });

  it('copies unknown values', () => {
    expect(
      config.normalizeLocales({
        foo: { name: 'Foo' },
      }),
    ).toEqual({
      foo: { name: 'Foo' },
    });
  });
});
