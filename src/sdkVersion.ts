import semver from 'semver';

import BuildError from './util/BuildError';
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
  if (major === 4 && minor === 0) {
    return { deviceApi: '5.0.0', companionApi: '3.0.0' };
  }
  if (major === 4 && minor === 1) {
    return { deviceApi: '5.1.0', companionApi: '3.1.0' };
  }
  if (major === 4 && minor === 2) {
    return { deviceApi: '6.0.0', companionApi: '3.1.0' };
  }
  throw new BuildError(
    `No known API versions for SDK package version ${major}.${minor}`,
  );
}
