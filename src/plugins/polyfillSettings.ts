import i18nPolyfill from './i18nPolyfill';
import polyfill from './polyfill';

export default function polyfillCompanion() {
  return polyfill(i18nPolyfill('settings/**/*.po'));
}
