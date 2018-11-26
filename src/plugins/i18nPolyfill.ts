import companionTranslations from './companionTranslations';
import gettextFactoryConst from './gettextFactory.const';

const i18nModuleString = `
  import languageTable from '\0lang:table';
  import gettextFactory from '\0lang:gettext-factory';
  import { locale } from 'user-settings';
  const gettext = gettextFactory(languageTable, locale.language);
  export { gettext };
`;

interface Ii18nPolyfill {
    // tslint:disable-next-line:no-any
    [key: string]: any;
    '\0lang:table': () => Promise<string>;
    '\0lang:gettext-factory': string;
    i18n: string;
}

export default function i18nPolyfill(translationsGlob: string): Ii18nPolyfill {
    return {
        '\0lang:table': companionTranslations(translationsGlob),
        '\0lang:gettext-factory': gettextFactoryConst,
        i18n: i18nModuleString,
    };
}
