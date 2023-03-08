import lodash from 'lodash';
import semver from 'semver';

import sdkVersion from './sdkVersion';
import { RGBAOutputFormat, TXIOutputFormat } from '@fitbit/image-codec-txi';

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
  defaultTXIOutputFormat?: RGBAOutputFormat;
}

const baseBuildTargets: { [platform: string]: BuildTargetDescriptor } = {
  rhea: {
    displayName: 'Fitbit Sense 2',
    minSDKVersion: '7.0.0',
    platform: ['128.1.1+'],
    resourceFilterTag: '336x336',
    defaultTXIOutputFormat: TXIOutputFormat.RGBA4444,
    specs: {
      screenSize: {
        width: 336,
        height: 336,
      },
    },
  },
  hera: {
    displayName: 'Fitbit Versa 4',
    minSDKVersion: '7.0.0',
    platform: ['128.1.1+'],
    resourceFilterTag: '336x336',
    defaultTXIOutputFormat: TXIOutputFormat.RGBA4444,
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
