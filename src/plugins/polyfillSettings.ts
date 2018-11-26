import i18nPolyfill from './i18nPolyfill';
import polyfill from './polyfill';
import { Plugin } from 'rollup';

export default function polyfillCompanion(): Plugin {
    return polyfill(i18nPolyfill('settings/**/*.po'));
}
