import { SemVer, satisfies } from 'semver';
import sdkVersion, { apiVersions } from './sdkVersion';

it('throws if package version has no known mapping', () => {
  expect(() => apiVersions({}, '1000.0.0')).toThrowErrorMatchingSnapshot();
});

it('throws if package version is invalid', () => {
  expect(() => apiVersions({}, '..')).toThrowErrorMatchingSnapshot();
});

it('provides a mapping for SDKv7.0', () => {
  expect(apiVersions({}, '7.0.0')).toEqual({
    deviceApi: '10.0.1',
    companionApi: '3.5.0',
  });
});

it('provides a mapping for SDKv7.1', () => {
  expect(apiVersions({}, '7.1.0')).toEqual({
    deviceApi: '10.1.0',
    companionApi: '3.5.0',
  });
});

it('provides a mapping for a known SDK version with a non-zero patch version', () => {
  expect(apiVersions({}, '7.0.100')).toEqual({
    deviceApi: '10.0.1',
    companionApi: '3.5.0',
  });
});

it('provides a mapping for a known SDK version with a pre-release suffix', () => {
  expect(apiVersions({}, '6.0.0-alpha.1')).toEqual({
    deviceApi: '8.1.0',
    companionApi: '3.3.0',
  });
});

it('maps API versions to "*" when proposed APIs are enabled', () => {
  expect(apiVersions({ enableProposedAPI: true }, '1000.0.0')).toEqual({
    deviceApi: '*',
    companionApi: '*',
  });
});

it('is able to derive the current SDK version', () => {
  expect(sdkVersion).not.toThrow();
});

it('is able to map the current SDK version to API versions', () => {
  expect(apiVersions()).toEqual({
    deviceApi: expect.any(String),
    companionApi: expect.any(String),
  });
});

describe('given a specific toolchain version', () => {
  let version: SemVer;

  beforeEach(() => {
    version = sdkVersion('6.0.5-pre.7');
  });

  it('converts the toolchain version to an SDK version', () => {
    expect(version).toMatchObject({
      major: 6,
      minor: 0,
      patch: 0,
      prerelease: [],
      version: '6.0.0',
    });
  });

  it('returns an SDK version that compares as expected', () => {
    expect(satisfies(version, '>=6.0.0')).toBe(true);
  });
});
