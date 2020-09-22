import lodash from 'lodash';
import semver from 'semver';

import sdkVersion from './sdkVersion';

export interface BuildTargetDescriptor {
  displayName: string;
  platform: string[];
  resourceFilterTag: string;
  specs: {
    screenSize: {
      width: number;
      height: number;
    };
  };
  maxDeviceBundleSize?: number; // in bytes
  minSDKVersion?: string;
}

const baseBuildTargets: { [platform: string]: BuildTargetDescriptor } = {
  atlas: {
    displayName: 'Fitbit Versa 3',
    minSDKVersion: '5.0.0',
    platform: ['128.1.1+'],
    resourceFilterTag: '336x336',
    specs: {
      screenSize: {
        width: 336,
        height: 336,
      },
    },
  },
  vulcan: {
    displayName: 'Fitbit Sense',
    minSDKVersion: '5.0.0',
    platform: ['128.1.1+'],
    resourceFilterTag: '336x336',
    specs: {
      screenSize: {
        width: 336,
        height: 336,
      },
    },
  },
};

let extraBuildTargets: typeof baseBuildTargets | undefined;
try {
  extraBuildTargets = require('@fitbit/sdk-build-targets').default;
} catch {}

export function generateBuildTargets() {
  return lodash.pickBy(
    {
      ...baseBuildTargets,
      ...extraBuildTargets,
    },
    ({ minSDKVersion }) =>
      minSDKVersion === undefined ||
      semver.gte(sdkVersion().format(), minSDKVersion),
  );
}

const buildTargets = generateBuildTargets();
export default buildTargets;
