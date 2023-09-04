import { Plugin } from 'rollup';

import { ComponentType } from '../componentTargets';
import sdkVersion from '../sdkVersion';

let extraDevice: string[] = [];
let extraCompanion: string[] = [];

try {
  const {
    getDeviceModules,
    getCompanionModules,
  } = require('@fitbit/sdk-build-targets');
  extraDevice = getDeviceModules(sdkVersion());
  extraCompanion = getCompanionModules(sdkVersion());
} catch {}

const common = [
  'cbor',
  'crypto',
  'device',
  'events',
  'file-transfer',
  'geolocation',
  'messaging',
  'permissions',
  'resources',
  'user-settings',
  'util',
];

const device = [
  'accelerometer',
  'app-cluster-storage',
  'appbit',
  'barometer',
  'body-presence',
  'clock',
  'display',
  'document',
  'exercise',
  'fs',
  'gyroscope',
  'haptics',
  'heart-rate',
  'i18n',
  'jpeg',
  'orientation',
  'power',
  'scientific',
  'scientific/signal',
  'sensors',
  'sleep',
  'system',
  'user-activity',
  'user-profile',
  ...common,
  ...extraDevice,
];

const companion = [
  'app-cluster-storage',
  'calendars',
  'companion',
  'device-notifications',
  'external-app',
  'image',
  'local-storage',
  'mobile-notifications',
  'peer',
  'pub-sub',
  'secure-exchange',
  'settings',
  'user-water',
  'user-weight',
  'weather',
  ...common,
  ...extraCompanion,
];

const settings = ['user-settings'];

export const externals = { device, companion, settings };

export function plugin(component: ComponentType): Plugin {
  return {
    name: 'platform-externals',

    resolveId(importee) {
      if (importee.startsWith('internal/')) return false;
      if (externals[component].indexOf(importee) !== -1) return false;
    },
  };
}
