import semver, { SemVer } from 'semver';

import BuildError from './util/BuildError';
import packageVersionConst from './packageVersion.const';

interface ApiVersions {
  deviceApi: string;
  companionApi: string;
}

interface WithProposedAPI {
  enableProposedAPI?: boolean;
}

const apiBySdk: Record<string, ApiVersions> = {
  '5.1': { deviceApi: '7.1.0', companionApi: '3.1.0' },
  '6.0': { deviceApi: '8.1.0', companionApi: '3.3.0' },
  '6.1': { deviceApi: '8.2.0', companionApi: '3.3.0' },
  '6.2': { deviceApi: '8.2.0', companionApi: '3.3.0' },
  '7.0': { deviceApi: '10.0.0', companionApi: '3.4.0' },
};

export default function sdkVersion(
  toolchainVersion = packageVersionConst,
): SemVer {
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
  projectConfig: WithProposedAPI = {},
  toolchainVersion = packageVersionConst,
): ApiVersions {
  if (projectConfig.enableProposedAPI) {
    return { deviceApi: '*', companionApi: '*' };
  }

  const { major, minor } = sdkVersion(toolchainVersion);
  const sdk = `${major}.${minor}`;
  const componentVersions = apiBySdk[sdk];

  if (!componentVersions) {
    throw new BuildError(
      `No known API versions for SDK package version ${sdk}`,
    );
  }

  return componentVersions;
}
