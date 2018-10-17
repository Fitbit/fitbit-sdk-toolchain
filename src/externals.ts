/**
 * External modules available for each app component.
 */

const common = [
  'cbor',
  'device',
  'events',
  'geolocation',
  'messaging',
  'permissions',
  'resources',
  'util',
];

const device = [
  'accelerometer',
  'appbit',
  'barometer',
  'body-presence',
  'clock',
  'device',
  'display',
  'document',
  'file-transfer',
  'fs',
  'gyroscope',
  'haptics',
  'heart-rate',
  'jpeg',
  'orientation',
  'power',
  'sensors',
  'system',
  'user-activity',
  'user-profile',
  'user-settings',
].concat(common);

const companion = [
  'blob',
  'companion',
  'crypto',
  'external-app',
  'fetch',
  'file-transfer',
  'form-data',
  'host',
  'image',
  'life-cycle',
  'local-storage',
  'location-change',
  'peer',
  'secure-exchange',
  'settings',
  'storage',
  'user-settings',
  'wake-interval',
].concat(common);

const settings: string[] = [];  // No runtime externals for settings.

export default { device, companion, settings };
