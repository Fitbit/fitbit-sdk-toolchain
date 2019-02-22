import lodash from 'lodash';
import semver from 'semver';

import sdkVersion from './sdkVersion';
import { PolyfillMap } from './plugins/polyfill';

export interface BuildTargetDescriptor {
  displayName: string;
  platform: string[];
  resourceFilterTag: string;
  polyfills?: PolyfillMap;
  minSDKVersion?: string;
}

const baseBuildTargets: { [platform: string]: BuildTargetDescriptor } = {
  higgs: {
    displayName: 'Fitbit Ionic',
    platform: ['30.1.2+'],
    resourceFilterTag: '348x250',
  },
  meson: {
    displayName: 'Fitbit Versa',
    platform: ['32.4.18+'],
    resourceFilterTag: '300x300',
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
