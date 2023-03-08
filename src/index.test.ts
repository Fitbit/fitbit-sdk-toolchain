import { buildDeviceResources } from './index';
import { AppType, ClockProjectConfiguration } from './ProjectConfiguration';
import { BuildTargetDescriptor } from './buildTargets';
import { PassThrough } from 'stream';
import PluginError from 'plugin-error';

import convertImageToTXI, { TXIOutputFormat } from './convertImageToTXI';
jest.mock('./convertImageToTXI', () => {
  return {
    __esModule: true,
    ...jest.requireActual('./convertImageToTXI'),
    convertImageToTXI: jest.fn(() => {
      return new PassThrough();
    }),
    default: jest.fn(() => {
      return new PassThrough();
    }),
  };
});

const makeProjectConfig = (): ClockProjectConfiguration => ({
  appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
  appType: AppType.CLOCKFACE,
  appDisplayName: 'My App',
  i18n: {
    en: { name: 'My App' },
    fr: { name: 'Mon application' },
  },
  buildTargets: ['hera'],
  requestedPermissions: [],
  defaultLanguage: 'en-US',
});

const testBuildTargets: { [platform: string]: BuildTargetDescriptor } = {
  noDefaultTXI: {
    displayName: 'Test 1',
    platform: ['1.2.3+'],
    resourceFilterTag: '100x100',
    specs: {
      screenSize: {
        width: 100,
        height: 100,
      },
    },
  },
  defaultTXI: {
    displayName: 'Test 2',
    platform: ['1.2.3+'],
    resourceFilterTag: '100x100',
    defaultTXIOutputFormat: TXIOutputFormat.RGBA4444,
    specs: {
      screenSize: {
        width: 100,
        height: 100,
      },
    },
  },
};

for (const buildTarget of [
  {
    name: 'noDefaultTXI',
    encoding: TXIOutputFormat.RGBA6666,
  },
  {
    name: 'defaultTXI',
    encoding: TXIOutputFormat.RGBA4444,
  },
]) {
  describe(`builds device resources by passing a target with ${buildTarget.name}`, () => {
    it(`calls convert to ${buildTarget.encoding} format`, (done) => {
      const handleData = jest.fn();

      const builder = buildDeviceResources(
        makeProjectConfig(),
        testBuildTargets[buildTarget.name],
      );

      builder
        .on('error', (perr: PluginError) => {
          // The test is aware there are none of the mandatory bundle files present
          if (perr.plugin === 'assert-files') {
            return;
          }
          done(perr);
        })
        .on('data', handleData)
        .on('end', () => {
          expect(convertImageToTXI).toBeCalledWith({
            rgbaOutputFormat: buildTarget.encoding,
          });
          done();
        });
    });
  });
}
