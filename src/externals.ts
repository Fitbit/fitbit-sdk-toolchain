/**
 * External modules available for each app component.
 */

const common = [
  'cbor',
  'crypto',
  'device',
  'events',
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
].concat(common);

const companion = [
  'blob',
  'companion',
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
  'wake-interval',
].concat(common);

const settings = [
  'user-settings',
];

export default { device, companion, settings };
