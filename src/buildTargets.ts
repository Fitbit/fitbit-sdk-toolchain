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
  higgs: {
    displayName: 'Fitbit Ionic',
    platform: ['30.1.2+'],
    resourceFilterTag: '348x250',
    specs: { screenSize: { width: 348, height: 250 } },
  },
  meson: {
    displayName: 'Fitbit Versa',
    platform: ['32.4.18+'],
    resourceFilterTag: '300x300',
    specs: { screenSize: { width: 300, height: 300 } },
  },
  gemini: {
    displayName: 'Fitbit Versa Lite',
    platform: ['33.1.30+'],
    resourceFilterTag: '300x300',
    specs: { screenSize: { width: 300, height: 300 } },
    minSDKVersion: '3.1.0',
    maxDeviceBundleSize: 3145728,
  },
  mira: {
    displayName: 'Fitbit Versa 2',
    platform: ['68.9.12+'],
    resourceFilterTag: '300x300',
    specs: { screenSize: { width: 300, height: 300 } },
    minSDKVersion: '4.0.0',
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
