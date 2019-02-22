import { advanceTo } from 'jest-date-mock';

import { makeDeviceManifest, makeCompanionManifest } from './componentManifest';
import ProjectConfiguration, {
  AppProjectConfiguration,
  AppType,
  ClockProjectConfiguration,
} from './ProjectConfiguration';
import { apiVersions } from './sdkVersion';

import getJSONFileFromStream from './testUtils/getJSONFileFromStream';

jest.mock('./packageVersion.const');

const buildId = '0x0f75775f470c1585';
const makeClockfaceProjectConfig = (): ClockProjectConfiguration => ({
  appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
  appType: AppType.CLOCKFACE,
  appDisplayName: 'My App',
  i18n: {
    en: { name: 'My App' },
    fr: { name: 'Mon application' },
  },
  buildTargets: ['higgs'],
  requestedPermissions: [],
});

const makeAppProjectConfig = (): AppProjectConfiguration => ({
  ...makeClockfaceProjectConfig(),
  appType: AppType.APP,
  wipeColor: '#ffaabb',
  iconFile: 'resources/icon.png',
});

function expectDeviceManifest(
  projectConfig: ProjectConfiguration = makeClockfaceProjectConfig(),
) {
  const manifest = makeDeviceManifest({
    buildId,
    projectConfig,
  });

  return expect(getJSONFileFromStream(manifest)).resolves;
}

function expectCompanionManifest(hasSettings = false) {
  return expect(
    getJSONFileFromStream(
      makeCompanionManifest({
        buildId,
        hasSettings,
        projectConfig: makeClockfaceProjectConfig(),
      }),
    ),
  ).resolves;
}

beforeEach(() => {
  advanceTo(new Date(Date.UTC(2018, 5, 27, 0, 0, 0)));
});

it('builds a device manifest for a clock', () =>
  expectDeviceManifest().toMatchSnapshot());

it('builds a device manifest for an app', () =>
  expectDeviceManifest(makeAppProjectConfig()).toMatchSnapshot());

it('builds a companion manifest', () =>
  expectCompanionManifest().toMatchSnapshot());

it('builds a companion manifest with settings', () =>
  expectCompanionManifest(true).toMatchSnapshot());

it('sets apiVersion in app manifest', () =>
  expectDeviceManifest().toHaveProperty(
    'apiVersion',
    apiVersions({}).deviceApi,
  ));

it('sets apiVersion in companion manifest', () =>
  expectCompanionManifest().toHaveProperty(
    'apiVersion',
    apiVersions({}).companionApi,
  ));
