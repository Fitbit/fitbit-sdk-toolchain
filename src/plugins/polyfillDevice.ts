import polyfill from './polyfill';
import { Plugin } from 'rollup';

const modules = {
    i18n: `
import { getResource } from 'resources';

export function gettext(msgid) {
  var resource = getResource('text', '_' + msgid);
  if (resource === null) return String(msgid);
  return resource;
}
`,
};

export default function polyfillDevice(): Plugin {
    return polyfill(modules);
}
