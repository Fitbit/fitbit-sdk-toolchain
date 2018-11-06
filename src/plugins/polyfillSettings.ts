import companionTranslations from './companionTranslations';
import polyfill from './polyfill';

export default function polyfillCompanion() {
  return polyfill({
    '\0lang:table': companionTranslations('settings/**/*.po'),
  });
}
