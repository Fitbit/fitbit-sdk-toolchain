import { PolyfillMap } from './plugins/polyfill';

export interface BuildTargetDescriptor {
  displayName: string;
  platform: string[];
  resourceFilterTag: string;
  polyfills?: PolyfillMap;
}

const buildTargets: { [platform: string]: BuildTargetDescriptor } = {
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

let extraBuildTargets: typeof buildTargets | undefined;
try {
  extraBuildTargets = require('@fitbit/sdk-build-targets').default;
} catch {}

Object.assign(buildTargets, extraBuildTargets);

export default buildTargets;
