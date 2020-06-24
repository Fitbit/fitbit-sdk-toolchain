import { Duplex, Readable } from 'stream';

import { advanceTo } from 'jest-date-mock';
import path from 'path';
import Vinyl from 'vinyl';

import { makeDeviceManifest, makeCompanionManifest } from './componentManifest';
import { ComponentType } from './componentTargets';
import ProjectConfiguration, {
  AppProjectConfiguration,
  AppType,
  ClockProjectConfiguration,
} from './ProjectConfiguration';
import { apiVersions } from './sdkVersion';

import getFileFromStream from './testUtils/getFileFromStream';
import getJSONFileFromStream from './testUtils/getJSONFileFromStream';
import getVinylContents from './testUtils/getVinylContents';
import makeReadStream from './testUtils/makeReadStream';

jest.mock('./packageVersion.const');

const buildId = '0x0f75775f470c1585';
const makeClockfaceProjectConfig = (): ClockProjectConfiguration => ({
  appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
  appType: AppType.CLOCKFACE,
  appDisplayName: 'My App',
  i18n: {
    'en-US': { name: 'My App' },
    'fr-FR': { name: 'Mon application' },
  },
  buildTargets: ['higgs'],
  requestedPermissions: [],
  defaultLanguage: 'en-US',
});

const makeAppProjectConfig = (): AppProjectConfiguration => ({
  ...makeClockfaceProjectConfig(),
  appType: AppType.APP,
  wipeColor: '#ffaabb',
  iconFile: 'resources/icon.png',
});

let buildStream: Readable;

function addBuildFile(path: string, content: string | Buffer, props: object) {
  buildStream.push(
    new Vinyl({
      path,
      contents: Buffer.isBuffer(content) ? content : Buffer.from(content),
      ...props,
    }),
  );
}

function expectManifestJSON(stream: Duplex) {
  return expect(getJSONFileFromStream(stream, 'manifest.json'));
}

function makeDeviceManifestStream(
  projectConfig: ProjectConfiguration = makeClockfaceProjectConfig(),
) {
  buildStream.push(null);
  return buildStream.pipe(
    makeDeviceManifest({
      buildId,
      projectConfig,
      targetDevice: 'mira',
    }),
  );
}

function makeCompanionManifestStream(
  hasSettings = false,
  projectConfig: ProjectConfiguration = makeClockfaceProjectConfig(),
) {
  buildStream.push(null);
  return buildStream.pipe(
    makeCompanionManifest({
      buildId,
      projectConfig,
      hasSettings,
    }),
  );
}

beforeEach(() => {
  advanceTo(new Date(Date.UTC(2018, 5, 27, 0, 0, 0)));
  buildStream = makeReadStream();
});

it('emits an error if no device entry point is present', () =>
  expectManifestJSON(makeDeviceManifestStream()).rejects.toMatchSnapshot());

it('emits an error if multiple device entry points are present', () => {
  addBuildFile('device/index_A.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.DEVICE,
  });
  addBuildFile('device/index_B.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.DEVICE,
  });
  return expectManifestJSON(
    makeDeviceManifestStream(),
  ).rejects.toMatchSnapshot();
});

it('emits an error if an unrecognised entry point is present when expecting a device entry point', () => {
  addBuildFile('toaster/index.js', 'foo', {
    isEntryPoint: true,
    componentType: 'toaster',
  });
  return expectManifestJSON(
    makeDeviceManifestStream(),
  ).rejects.toMatchSnapshot();
});

it('emits an error if a companion entry point is present when expecting a device entry point', () => {
  addBuildFile('toaster/index.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.COMPANION,
  });
  return expectManifestJSON(
    makeDeviceManifestStream(),
  ).rejects.toMatchSnapshot();
});

describe('when there is a device entry point present', () => {
  beforeEach(() => {
    addBuildFile('device/index.js', 'foo', {
      isEntryPoint: true,
      componentType: ComponentType.DEVICE,
    });
  });

  it('builds a device manifest for a clock', () =>
    expectManifestJSON(makeDeviceManifestStream()).resolves.toMatchSnapshot());

  it('includes supported screen sizes for a clock', () => {
    const projectConfig = {
      ...makeClockfaceProjectConfig(),
      enableProposedAPI: true,
    } as ProjectConfiguration;
    expectManifestJSON(
      makeDeviceManifestStream(projectConfig),
    ).resolves.toMatchSnapshot();
  });

  it('builds a device manifest for an app', () =>
    expectManifestJSON(
      makeDeviceManifestStream(makeAppProjectConfig()),
    ).resolves.toMatchSnapshot());

  it('sets apiVersion in app manifest', () =>
    expectManifestJSON(makeDeviceManifestStream()).resolves.toHaveProperty(
      'apiVersion',
      apiVersions({}).deviceApi,
    ));

  describe('when there are compiled language files', () => {
    beforeEach(() => {
      addBuildFile('lang/english', 'foo', { translationLanguage: 'en-US' });
      addBuildFile('spanish/language', 'foo', { translationLanguage: 'es-ES' });
    });

    it('sets the i18n[lang].resources key for language files that pass through', () =>
      expectManifestJSON(
        makeDeviceManifestStream(),
      ).resolves.toMatchSnapshot());

    it.each(['es-ES', 'en-US'])(
      'ensures the default language %s is the first key in the i18n object',
      (defaultLanguage) => {
        buildStream.push(null);
        const manifest = makeDeviceManifestStream({
          ...makeClockfaceProjectConfig(),
          defaultLanguage,
        });

        return expect(
          getFileFromStream(manifest, 'manifest.json').then(getVinylContents),
        ).resolves.toMatchSnapshot();
      },
    );

    it('passes all files through', (done) => {
      const files: string[] = [];

      makeDeviceManifestStream()
        .on('error', done.fail)
        .on('data', (file: Vinyl) => files.push(file.relative))
        .on('end', () => {
          expect(files).toEqual([
            path.normalize('device/index.js'),
            path.normalize('lang/english'),
            path.normalize('spanish/language'),
            path.normalize('manifest.json'),
          ]);
          done();
        });
    });
  });
});

it('emits an error if no companion entry point is present', () =>
  expectManifestJSON(makeCompanionManifestStream()).rejects.toMatchSnapshot());

it('emits an error if multiple companion entry points are present', () => {
  addBuildFile('companion/index_A.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.COMPANION,
  });
  addBuildFile('companion/index_B.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.COMPANION,
  });
  return expectManifestJSON(
    makeCompanionManifestStream(),
  ).rejects.toMatchSnapshot();
});

it('emits an error if multiple settings entry points are present', () => {
  addBuildFile('companion/index.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.COMPANION,
  });
  addBuildFile('settings/index_A.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.SETTINGS,
  });
  addBuildFile('settings/index_B.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.SETTINGS,
  });
  return expectManifestJSON(
    makeCompanionManifestStream(),
  ).rejects.toMatchSnapshot();
});

it('emits an error if an unrecognised entry point is present when expecting a companion/settings entry point', () => {
  addBuildFile('toaster/index.js', 'foo', {
    isEntryPoint: true,
    componentType: 'toaster',
  });
  return expectManifestJSON(
    makeCompanionManifestStream(),
  ).rejects.toMatchSnapshot();
});

it('emits an error if a device entry point is present when expecting a companion/settings entry point', () => {
  addBuildFile('toaster/index.js', 'foo', {
    isEntryPoint: true,
    componentType: ComponentType.DEVICE,
  });
  return expectManifestJSON(
    makeCompanionManifestStream(),
  ).rejects.toMatchSnapshot();
});

describe('when there is a companion entry point present', () => {
  beforeEach(() => {
    addBuildFile('companion/index.js', 'foo', {
      isEntryPoint: true,
      componentType: ComponentType.COMPANION,
    });
  });

  it('builds a companion manifest', () =>
    expectManifestJSON(
      makeCompanionManifestStream(),
    ).resolves.toMatchSnapshot());

  it('sets apiVersion in companion manifest', () =>
    expectManifestJSON(makeCompanionManifestStream()).resolves.toHaveProperty(
      'apiVersion',
      apiVersions({}).companionApi,
    ));

  it('sets app cluster storage related fields if configured', () =>
    expectManifestJSON(
      makeCompanionManifestStream(false, {
        ...makeClockfaceProjectConfig(),
        developerID: 'f00df00d-f00d-f00d-f00d-f00df00df00d',
        appClusterID: 'a.storage.group',
      }),
    ).resolves.toMatchSnapshot());

  it('emits an error if project has settings but no settings entry point', () =>
    expectManifestJSON(
      makeCompanionManifestStream(true),
    ).rejects.toMatchSnapshot());

  describe('when there is a settings entry point present', () => {
    beforeEach(() => {
      addBuildFile('settings/index.js', 'foo', {
        isEntryPoint: true,
        componentType: ComponentType.SETTINGS,
      });
    });

    it('builds a companion manifest with settings', () =>
      expectManifestJSON(
        makeCompanionManifestStream(true),
      ).resolves.toMatchSnapshot());
  });
});
