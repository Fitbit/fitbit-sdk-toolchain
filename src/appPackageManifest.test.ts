import { Readable } from 'stream';

import Vinyl from 'vinyl';
import appPackageManifest from './appPackageManifest';
import buildTargets from './buildTargets';
import { ComponentType } from './componentTargets';
import ProjectConfiguration, {
  AppType,
  ClockProjectConfiguration,
} from './ProjectConfiguration';

import getJSONFileFromStream from './testUtils/getJSONFileFromStream';

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
  buildTargets: ['higgs'],
  requestedPermissions: [],
  defaultLanguage: 'en-US',
});

function makeReadStream() {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};
  return stream;
}

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
      buildTargets: ['higgs', 'meson'],
    },
  }).toMatchSnapshot());

it('emits an error if both JS and native device components are present', () => {
  const projectConfig = makeProjectConfig();
  const stream = makeReadStream();
  stream.push(
    new Vinyl({
      componentBundle: {
        type: 'device',
        family: 'foo',
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
        family: 'bar',
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

it('emits an error if multiple bundles are present for the same device family', () => {
  const projectConfig = makeProjectConfig();
  const stream = makeReadStream();
  for (let i = 0; i <= 3; i += 1) {
    stream.push(
      new Vinyl({
        componentBundle: {
          type: 'device',
          family: 'foo',
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
});

it('builds a package manifest with a native device component', () =>
  expectValidPackageManifest({ nativeApp: true }).toMatchSnapshot());

it('builds a package manifest with a native device component and companion', () =>
  expectValidPackageManifest({
    nativeApp: true,
    hasCompanion: true,
  }).toMatchSnapshot());

it.each([
  ['has an invalid type field', { type: '__invalid__' }],
  ['has a device type but missing platform', { type: 'device', family: 'foo' }],
  [
    'has a device type but missing family',
    { type: 'device', platform: ['1.1.1+'] },
  ],
  [
    'has a device type but invalid platform',
    { type: 'device', family: 'foo', platform: '1.1.1+' },
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
