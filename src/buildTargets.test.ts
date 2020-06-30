import semver from 'semver';

import { generateBuildTargets } from './buildTargets';
import sdkVersion from './sdkVersion';

jest.mock(
  '@fitbit/sdk-build-targets',
  () => ({
    default: {
      foo: {
        displayName: 'Foo',
      },
      bar: {
        displayName: 'Bar',
        specs: { screenSize: { width: 300, height: 300 } },
      },
      baz: {
        displayName: 'Baz',
        minSDKVersion: '10.0.0',
      },
    },
  }),
  { virtual: true },
);

jest.mock('./sdkVersion', () => jest.fn(() => semver.parse('3.1.0')));

function mockSDKVersion(version: string) {
  (sdkVersion as jest.Mock).mockReturnValue(semver.parse(version));
}

it('merges the build target descriptors', () => {
  mockSDKVersion('3.1.0');
  expect(generateBuildTargets()).toMatchObject({
    higgs: {
      displayName: 'Fitbit Ionic',
      platform: expect.any(Array),
      resourceFilterTag: '348x250',
      specs: { screenSize: { width: 348, height: 250 } },
    },
    // Unfortunately, due to the way that module mocking works, the
    // extra build targets constant cannot be deduped easily.
    foo: {
      displayName: 'Foo',
    },
    bar: {
      displayName: 'Bar',
      specs: { screenSize: { width: 300, height: 300 } },
    },
  });
});

it('filters build targets not supported by current SDK version', () => {
  mockSDKVersion('10.0.0');
  expect(generateBuildTargets()).toMatchObject({
    baz: {
      displayName: 'Baz',
      minSDKVersion: '10.0.0',
    },
  });
  mockSDKVersion('9.0.0');
  expect(generateBuildTargets()).not.toMatchObject({
    baz: {
      displayName: 'Baz',
      minSDKVersion: '10.0.0',
    },
  });
});
