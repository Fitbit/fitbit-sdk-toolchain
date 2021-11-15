import { Readable } from 'stream';

import Vinyl from 'vinyl';

import appPackageManifest from './appPackageManifest';
import buildTargets from './buildTargets';
import { ComponentType } from './componentTargets';
import ProjectConfiguration, {
  AppProjectConfiguration,
  AppType,
  ClockProjectConfiguration,
  Tile,
} from './ProjectConfiguration';

import getJSONFileFromStream from './testUtils/getJSONFileFromStream';
import makeReadStream from './testUtils/makeReadStream';

jest.mock('./packageVersion.const');

const buildId = '0x0f75775f470c1585';
const makeProjectConfig = (): ClockProjectConfiguration => ({
  appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
  appType: AppType.CLOCKFACE,
  appDisplayName: 'My App',
  i18n: {
    en: { name: 'My App' },
    fr: { name: 'Mon application' },
  },
  buildTargets: ['atlas'],
  requestedPermissions: [],
  defaultLanguage: 'en-US',
});

function expectPackageManifest(
  stream: Readable,
  projectConfig: ProjectConfiguration,
) {
  return expect(
    getJSONFileFromStream(
      stream.pipe(
        appPackageManifest({
          buildId,
          projectConfig,
        }),
      ),
      'manifest.json',
    ),
  );
}

function expectValidPackageManifest(options?: {
  hasCompanion?: boolean;
  projectConfig?: ProjectConfiguration;
  nativeApp?: boolean;
}) {
  const { hasCompanion, projectConfig, nativeApp } = {
    projectConfig: makeProjectConfig(),
    hasCompanion: false,
    nativeApp: false,
    ...options,
  };
  const stream = makeReadStream();
  for (const platform of projectConfig.buildTargets) {
    if (!nativeApp) {
      stream.push(
        new Vinyl({
          path: `sourceMaps/${ComponentType.DEVICE}/${platform}/index.js.json`,
          contents: Buffer.alloc(0),
          componentMapKey: [ComponentType.DEVICE, platform],
        }),
      );
    }
    stream.push(
      new Vinyl({
        path: `${ComponentType.DEVICE}-${platform}.zip`,
        contents: Buffer.alloc(0),
        componentBundle: {
          type: 'device',
          family: platform,
          platform: buildTargets[platform].platform,
          ...(nativeApp && { isNative: true }),
        },
      }),
    );
  }
  if (hasCompanion) {
    for (const componentType of [
      ComponentType.COMPANION,
      ComponentType.SETTINGS,
    ]) {
      stream.push(
        new Vinyl({
          path: `sourceMaps/${componentType}/${componentType}.js.json`,
          contents: Buffer.alloc(0),
          componentMapKey: [componentType],
        }),
      );
    }
    stream.push(
      new Vinyl({
        path: `${ComponentType.COMPANION}.zip`,
        contents: Buffer.alloc(0),
        componentBundle: {
          type: 'companion',
        },
      }),
    );
  }
  stream.push(null);
  return expectPackageManifest(stream, projectConfig).resolves;
}

it('builds a package manifest', () =>
  expectValidPackageManifest().toMatchSnapshot());

it('builds a package manifest with a companion', () =>
  expectValidPackageManifest({ hasCompanion: true }).toMatchSnapshot());

it('builds a package manifest with multiple device components', () =>
  expectValidPackageManifest({
    projectConfig: {
      ...makeProjectConfig(),
      buildTargets: ['atlas', 'vulcan'],
    },
  }).toMatchSnapshot());

it('builds a package manifest with supported capabilities', () =>
  expectValidPackageManifest({
    projectConfig: {
      ...makeProjectConfig(),
      buildTargets: ['atlas', 'vulcan'],
      enableProposedAPI: true,
    },
  }).toMatchSnapshot());

it('emits an error if both JS and native device components are present', () => {
  const projectConfig = makeProjectConfig();
  const stream = makeReadStream();
  stream.push(
    new Vinyl({
      componentBundle: {
        type: 'device',
        family: 'atlas',
        platform: ['1.1.1+'],
      },
      path: 'bundle.zip',
      contents: Buffer.alloc(0),
    }),
  );
  stream.push(
    new Vinyl({
      componentBundle: {
        type: 'device',
        family: 'vulcan',
        platform: ['1.1.1+'],
        isNative: true,
      },
      path: 'bundle.bin',
      contents: Buffer.alloc(0),
    }),
  );
  stream.push(null);

  return expectPackageManifest(
    stream,
    projectConfig,
  ).rejects.toThrowErrorMatchingSnapshot();
});

it.each(['device', 'companion'])(
  'emits an error if multiple %s bundles are present for the same device family',
  (component) => {
    const projectConfig = makeProjectConfig();
    const stream = makeReadStream();
    for (let i = 0; i <= 3; i += 1) {
      stream.push(
        new Vinyl({
          componentBundle: {
            type: component,
            family: 'atlas',
            platform: ['1.1.1+'],
          },
          path: `bundle${i}.zip`,
          contents: Buffer.alloc(0),
        }),
      );
    }
    stream.push(null);

    return expectPackageManifest(
      stream,
      projectConfig,
    ).rejects.toThrowErrorMatchingSnapshot();
  },
);

it('builds a package manifest with a native device component', () =>
  expectValidPackageManifest({ nativeApp: true }).toMatchSnapshot());

it('builds a package manifest with a native device component and companion', () =>
  expectValidPackageManifest({
    nativeApp: true,
    hasCompanion: true,
  }).toMatchSnapshot());

it.each<[string, any]>([
  ['has an invalid type field', { type: '__invalid__' }],
  [
    'has a device type but missing platform',
    { type: 'device', family: 'atlas' },
  ],
  [
    'has a device type but missing family',
    { type: 'device', platform: ['1.1.1+'] },
  ],
  [
    'has a device type but invalid platform',
    { type: 'device', family: 'atlas', platform: '1.1.1+' },
  ],
])('emits an error if a component bundle tag %s', (_, componentBundle) => {
  const projectConfig = makeProjectConfig();
  const stream = makeReadStream();
  stream.push(
    new Vinyl({
      componentBundle,
      path: 'bundle.zip',
      contents: Buffer.alloc(0),
    }),
  );

  return expectPackageManifest(
    stream,
    projectConfig,
  ).rejects.toThrowErrorMatchingSnapshot();
});

it('builds a package with tiles component', () => {
  const tiles: Tile[] = [
    {
      name: 'Tile1',
      uuid: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a2',
      // Default to all buildTargets
    },
    {
      name: 'Tile2',
      uuid: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a3',
      buildTargets: ['atlas'], // Explictly specify buildTargets
    },
  ];

  const projectConfig = {
    ...makeProjectConfig(),
    tiles,
    appType: AppType.APP,
    buildTargets: ['atlas', 'vulcan'],
  } as AppProjectConfiguration;

  return expectValidPackageManifest({ projectConfig }).toMatchSnapshot();
});

it("doesn't include tile data if app type is not APP", () => {
  const tiles: Tile[] = [
    {
      name: 'Tile1',
      uuid: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a2',
    },
    {
      name: 'Tile2',
      uuid: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a3',
      buildTargets: ['atlas'],
    },
  ];

  const projectConfig = {
    ...makeProjectConfig(),
    tiles,
    appType: AppType.CLOCKFACE,
  } as ClockProjectConfiguration;

  return expectValidPackageManifest({ projectConfig }).toMatchSnapshot();
});
