import companionTranslations from './companionTranslations';
import gettextFactoryConst from './gettextFactory.const';

const geti18nModuleString = (defaultLocale: string) => `
  import languageTable from '\0lang:table';
  import gettextFactory from '\0lang:gettext-factory';
  import { locale } from 'user-settings';
  const gettext = gettextFactory(languageTable, locale.language, ${JSON.stringify(
    defaultLocale,
  )});
  export { gettext };
`;

export default function i18nPolyfill(
  translationsGlob: string,
  defaultLocale: string,
) {
  return {
    '\0lang:table': companionTranslations(translationsGlob, defaultLocale),
    '\0lang:gettext-factory': gettextFactoryConst,
    i18n: geti18nModuleString(defaultLocale),
  };
}
