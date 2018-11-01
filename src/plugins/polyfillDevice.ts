import polyfill from './polyfill';

const modules = {
  i18n: `
import { getResource } from 'resources';

export function gettext(msgid) {
  var resource = getResource('text', '_' + msgid);
  if (resource === null) return msgid;
  return resource;
}
`,
};

export default function polyfillDevice() {
  return polyfill(modules);
}
