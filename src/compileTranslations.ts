import { basename } from 'path';
import { Transform } from 'stream';

import { TranslationLoader } from '@fitbit/bison-i18n';
import humanizeList from 'humanize-list';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

import { validateLanguageTag } from './languageTag';
import { Locales } from './ProjectConfiguration';

const PLUGIN_NAME = 'compileTranslations';

/**
 * Compile .po files into Bison FW binary translation files.
 *
 * The emitted files have a .translationLanguage property which holds
 * the string BCP 47 language tag for the translations in the file.
 */
export default function compileTranslations(defaultLanguage: string) {
  const translations = new TranslationLoader();
  const translationFiles = new Map<string, Vinyl>();

  const transform = new Transform({
    objectMode: true,
    transform(file: Vinyl, _, next) {
      if (file.isNull() || file.extname !== '.po') {
        return next(undefined, file);
      }

      const languageTag = basename(file.basename, '.po');
      if (!validateLanguageTag(languageTag)) {
        next(
          new PluginError(
            PLUGIN_NAME,
            // tslint:disable-next-line:max-line-length
            `Translation file ${
              file.basename
            } has a bad name. Translation files must be named ${humanizeList(
              Object.keys(Locales).map((tag) => tag + '.po'),
              { conjunction: 'or' },
            )}.`,
            { fileName: file.relative },
          ),
        );
        return;
      }

      if (file.isBuffer()) {
        try {
          const contents = file.contents.toString('utf-8');
          translations.loadLanguage(languageTag, contents);
          translationFiles.set(languageTag, file.clone({ contents: false }));
          return next();
        } catch (error) {
          next(
            new PluginError(PLUGIN_NAME, error as Error, {
              fileName: file.relative,
            }),
          );
        }
      } else {
        next(
          new PluginError(
            PLUGIN_NAME,
            file.isStream()
              ? 'Streaming mode is not supported.'
              : 'Internal error processing file.',
            { fileName: file.relative },
          ),
        );
        return;
      }
    },

    flush(done) {
      const languageTable = translations.build();

      if (
        languageTable.languages.size > 0 &&
        !languageTable.languages.has(defaultLanguage)
      ) {
        done(
          new PluginError(
            PLUGIN_NAME,
            `No translation file found for default language "${defaultLanguage}"`,
          ),
        );
        return;
      }

      for (const language of languageTable.languages) {
        const file = translationFiles.get(language)!;

        try {
          file.contents = Buffer.from(languageTable.getLanguage(language));
          file.translationLanguage = language;
        } catch (error) {
          done(
            new PluginError(PLUGIN_NAME, error as Error, {
              fileName: file.relative,
            }),
          );
          return;
        }

        // Not a constant because the actual output path is arbitrary and
        // can be changed at any time without impact. The path is kept
        // short because of limitations on the max size of manifest.json.
        file.path = `l/${language}`;
        transform.push(file);
      }

      done();
    },
  });

  return transform;
}
