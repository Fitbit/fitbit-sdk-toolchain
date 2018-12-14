/**
 * External modules available for each app component.
 */

function internalsFilter(externals: string[]) {
  return (id: string) => {
    if (id.startsWith('internal/')) return true;
    if (externals.includes(id)) return true;
  };
}

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

const device = internalsFilter(
  [
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
    'scientific/signal',
    'sensors',
    'system',
    'user-activity',
    'user-profile',
  ].concat(common),
);

const companion = internalsFilter(
  [
    'companion',
    'external-app',
    'image',
    'local-storage',
    'peer',
    'secure-exchange',
    'settings',
  ].concat(common),
);

const settings = internalsFilter(['user-settings']);

export default { device, companion, settings };
