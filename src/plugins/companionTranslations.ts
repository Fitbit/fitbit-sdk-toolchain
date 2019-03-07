import { basename } from 'path';
import { promisify } from 'util';

import { LanguageTable, MessageTable } from '@fitbit-sdk/companion-gettext';
import { default as _glob } from 'glob';
import humanizeList from 'humanize-list';
import pofile from 'pofile';
import { dataToEsm } from 'rollup-pluginutils';

import BuildError from '../util/BuildError';
import { validateLanguageTag, supportedTags } from '../languageTag';

const glob = promisify(_glob);
const loadPOFile = promisify(pofile.load);

async function loadTranslations(filePath: string) {
  const po = await loadPOFile(filePath);
  const messages: MessageTable = {};

  for (const { msgid, msgstr } of po.items) {
    if (msgstr.length > 1) {
      throw new BuildError(
        `msgid "${msgid}" in file "${filePath}" has multiple msgstr values. This is not supported.`,
      );
    }
    messages[msgid] = msgstr[0];
  }

  return messages;
}

export default function companionTranslations(
  globPattern: string,
  defaultLanguage: string,
) {
  return async () => {
    const languagePaths = new Map<string, string>();
    const translations: LanguageTable = {};

    for (const filePath of await glob(globPattern)) {
      const languageTag = basename(filePath, '.po');

      if (!validateLanguageTag(languageTag)) {
        throw new BuildError(
          `Translation file "${filePath}" has a bad name. Translation files must be named ${humanizeList(
            supportedTags.map((tag) => tag + '.po'),
            { conjunction: 'or' },
          )}.`,
        );
      }

      const existingTranslations = languagePaths.get(languageTag);

      if (existingTranslations) {
        throw new BuildError(
          `More than one translation file found for language ${languageTag}. Found "${existingTranslations}" and "${filePath}".`,
        );
      }

      languagePaths.set(languageTag, filePath);
      translations[languageTag] = await loadTranslations(filePath);
    }

    if (!translations.hasOwnProperty(defaultLanguage)) {
      throw new BuildError(
        `No translation file found for default language "${defaultLanguage}"`,
      );
    }

    return dataToEsm(translations, { namedExports: false });
  };
}
