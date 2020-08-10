import { Plugin } from 'rollup';

import { ComponentType } from '../componentTargets';

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
].concat(common);

const companion = [
  'app-cluster-storage',
  'calendars',
  'companion',
  'external-app',
  'image',
  'local-storage',
  'mobile-notifications',
  'peer',
  'secure-exchange',
  'settings',
  'user-water',
  'user-weight',
].concat(common);

const settings = ['user-settings'];

const externals = { device, companion, settings };

export default function platformExternals(component: ComponentType): Plugin {
  return {
    name: 'platform-externals',

    resolveId(importee) {
      if (importee.startsWith('internal/')) return false;
      if (externals[component].indexOf(importee) !== -1) return false;
    },
  };
}
