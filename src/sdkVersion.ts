import semver from 'semver';

import packageVersionConst from './packageVersion.const';

export default function sdkVersion(toolchainVersion = packageVersionConst) {
  const version = semver.parse(toolchainVersion);
  if (version === null) {
    throw new Error(`Invalid SDK package version: ${toolchainVersion}`);
  }
  // SDK versions do not have a patch or prerelease. Strip them out.
  version.patch = 0;
  version.prerelease = [];
  version.format(); // Side effect: updates the version.version property.
  return version;
}

export function apiVersions(
  { enableProposedAPI }: { enableProposedAPI?: boolean } = {},
  toolchainVersion = packageVersionConst,
) {
  if (enableProposedAPI) return { deviceApi: '*', companionApi: '*' };

  const { major, minor } = sdkVersion(toolchainVersion);
  if (major === 3 && minor === 0) {
    return { deviceApi: '4.0.0', companionApi: '2.1.0' };
  }
  if (major === 3 && minor === 1) {
    return { deviceApi: '4.0.0', companionApi: '2.1.0' };
  }
  throw new Error(
    `No known API versions for SDK package version ${major}.${minor}`,
  );
}
