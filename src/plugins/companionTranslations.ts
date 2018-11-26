import { basename } from 'path';
import { promisify } from 'util';

import { LanguageTable, MessageTable } from '@fitbit-sdk/companion-gettext';
import { default as _glob } from 'glob';
import pofile from 'pofile';
import { dataToEsm } from 'rollup-pluginutils';

import { normalizeLanguageTag } from '../languageTag';

const glob = promisify(_glob);
const loadPOFile = promisify(pofile.load);

async function loadTranslations(filePath: string): Promise<MessageTable> {
    const po = await loadPOFile(filePath);
    const messages: MessageTable = {};

    for (const { msgid, msgstr } of po.items) {
        if (msgstr.length > 1) {
            // tslint:disable-next-line:max-line-length
            throw new Error(`msgid "${msgid}" in file "${filePath}" has multiple msgstr values. This is not supported.`);
        }
        messages[msgid] = msgstr[0];
    }

    return messages;
}

export default function companionTranslations(globPattern: string): () => Promise<string> {
    return async () => {
        const languagePaths = new Map<string, string>();
        const translations: LanguageTable = {};

        for (const filePath of await glob(globPattern)) {
            const tag = normalizeLanguageTag(basename(filePath, '.po'));

            if (tag === null) {
                // tslint:disable-next-line:max-line-length
                throw new Error(
                    `Translation file "${filePath}" has a bad name. Translation files must have names in the form ll-cc.po or ll.po (e.g. en-US.po)`
                );
            }

            const existingTranslations = languagePaths.get(tag);

            if (existingTranslations) {
                // tslint:disable-next-line:max-line-length
                throw new Error(
                    `More than one translation file found for language ${tag}. Found "${existingTranslations}" and "${filePath}".`
                );
            }

            languagePaths.set(tag, filePath);
            translations[tag] = await loadTranslations(filePath);
        }

        return dataToEsm(translations, { namedExports: false });
    };
}
