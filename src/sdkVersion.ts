import semver from 'semver';

import packageVersionConst from './packageVersion.const';

export default function sdkVersion(toolchainVersion = packageVersionConst) {
  const version = semver.parse(toolchainVersion);
  if (version === null) {
    throw new Error(`Invalid SDK package version: ${toolchainVersion}`);
  }
  return version;
}

export function apiVersions(
  { enableProposedAPI }: { enableProposedAPI?: boolean } = {},
  toolchainVersion = packageVersionConst,
) {
  if (enableProposedAPI) return { deviceApi: '*', companionApi: '*' };

  const { major, minor } = sdkVersion(toolchainVersion);
  if (major === 1 && minor === 0) {
    return { deviceApi: '1.0.0', companionApi: '1.0.0' };
  }
  if (major === 2 && minor === 0) {
    return { deviceApi: '3.0.0', companionApi: '2.0.0' };
  }
  if (major === 3 && minor === 0) {
    return { deviceApi: '4.0.0', companionApi: '2.1.0' };
  }
  throw new Error(
    `No known API versions for SDK package version ${major}.${minor}`,
  );
}
