/**
 * External modules available for each app component.
 */

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
  'jpeg',
  'orientation',
  'power',
  'scientific',
  'sensors',
  'system',
  'user-activity',
  'user-profile',
].concat(common);

const companion = [
  'companion',
  'external-app',
  'image',
  'local-storage',
  'peer',
  'secure-exchange',
  'settings',
].concat(common);

const settings = [
  'user-settings',
];

export default { device, companion, settings };
