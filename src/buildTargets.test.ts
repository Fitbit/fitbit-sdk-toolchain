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

jest.mock('./sdkVersion', () => jest.fn(() => semver.parse('6.0.0')));

function mockSDKVersion(version: string) {
  (sdkVersion as jest.Mock).mockReturnValue(semver.parse(version));
}

it('merges the build target descriptors', () => {
  mockSDKVersion('6.0.0');
  expect(generateBuildTargets()).toMatchObject({
    atlas: {
      displayName: 'Fitbit Versa 3',
      platform: expect.any(Array),
      resourceFilterTag: '336x336',
      specs: { screenSize: { width: 336, height: 336 } },
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
