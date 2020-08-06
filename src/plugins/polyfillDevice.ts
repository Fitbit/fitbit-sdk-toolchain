import { satisfies } from 'semver';

import polyfill from './polyfill';
import sdkVersion from '../sdkVersion';

interface PolyfillSpec {
  implementation: string;
  appliesTo?: string;
}

const availablePolyfills: Record<string, PolyfillSpec> = {
  i18n: {
    implementation: `
    import { getResource } from 'resources';

    export function gettext(msgid) {
      var resource = getResource('text', '_' + msgid);
      if (resource === null) return String(msgid);
      return resource;
    }
    `,
    appliesTo: '<4.2.0',
  },
  sleep: {
    implementation: `
    import { me } from 'appbit';
    import sleep from 'sleep';

    var sleepPolyfill = (sleep && me.permissions.granted('access_sleep')) ? sleep : undefined;
    export default sleepPolyfill;
    export { sleepPolyfill as sleep };
    `,
    appliesTo: '<5.0.0',
  },
};

export default function polyfillDevice() {
  const applicablePolyfills: Record<string, string> = {};
  for (const [module, { implementation, appliesTo }] of Object.entries(
    availablePolyfills,
  )) {
    const { major, minor } = sdkVersion();
    if (
      appliesTo === undefined ||
      satisfies(`${major}.${minor}.0`, appliesTo)
    ) {
      applicablePolyfills[module] = implementation;
    }
  }

  return polyfill(applicablePolyfills);
}
