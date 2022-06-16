import { posix as path } from 'path';

import companionTranslations from './companionTranslations';
import {
  errorMessageSerializer,
  normalizeSlash,
} from '../jestSnapshotSerializers';

const basePath = normalizeSlash(
  path.join(__dirname, '__test__', 'companionTranslations'),
);

expect.addSnapshotSerializer(errorMessageSerializer);
expect.addSnapshotSerializer({
  test(val) {
    return val instanceof Error && val.message.includes(basePath);
  },

  print(val, serialize) {
    const err = val as Error;
    err.message = err.message.replace(basePath, '<base>');
    return serialize(err);
  },
});

function expectTranslations(translationsPath: string, defaultLanguage: string) {
  return expect(
    companionTranslations(
      path.join(basePath, translationsPath),
      defaultLanguage,
    )(),
  );
}

it('builds a table from all the available translations', () =>
  expectTranslations('good/**/*.po', 'fr-FR').resolves.toMatchSnapshot());

it('throws when multiple files map to the same language', () =>
  expectTranslations(
    'language-collision/**/*.po',
    'en-US',
  ).rejects.toMatchSnapshot());

it('throws when a translation file has multiple msgstr values for the same msgid', () =>
  expectTranslations(
    'multiple-msgstr/en-US.po',
    'en-US',
  ).rejects.toMatchSnapshot());

it('throws if the default language is not found', () =>
  expectTranslations('good/**/*.po', 'it-IT').rejects.toMatchSnapshot());

it.each(['.po', 'a.po', 'english.po', 'enus.po'])(
  'throws when encountering the badly named file %j',
  (name: string) =>
    expectTranslations(`bad-name/${name}`, 'en-US').rejects.toMatchSnapshot(),
);
