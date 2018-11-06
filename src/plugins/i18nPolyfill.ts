import companionTranslations from './companionTranslations';
import gettextFactoryConst from './gettextFactory.const';

const i18nModuleString = `
  import languageTable from '\0lang:table';
  import gettextFactory from '\0lang:gettext-factory';
  import { locale } from 'user-settings';
  const gettext = gettextFactory(languageTable, locale.language);
  export { gettext };
`;

export default function i18nPolyfill(translationsGlob: string) {
  return {
    '\0lang:table': companionTranslations(translationsGlob),
    '\0lang:gettext-factory': gettextFactoryConst,
    i18n: i18nModuleString,
  };
}
