import path from 'path';

import companionTranslations from './companionTranslations';

const basePath = path.join(__dirname, '__test__', 'companionTranslations');

expect.addSnapshotSerializer({
  test(val) {
    return val instanceof Error && val.message.includes(basePath);
  },

  print(val, serialize) {
    val.message = val.message.replace(basePath, '<base>');
    return serialize(val);
  },
});

function expectTranslations(...paths: string[]) {
  return expect(companionTranslations(path.join(basePath, ...paths))());
}

it('emits an empty module when no .po files are present', () =>
  expectTranslations('no-po-files', '**', '*.po').resolves.toMatchSnapshot());

it('builds a table from all the available translations', () =>
  expectTranslations('good', '**', '*.po').resolves.toMatchSnapshot());

it('throws when multiple files map to the same language', () =>
  expectTranslations('language-collision', '**', '*.po').rejects.toMatchSnapshot());

it('throws when a translation file has multiple msgstr values for the same msgid', () =>
  expectTranslations('multiple-msgstr', 'en.po').rejects.toMatchSnapshot());

it.each([
  '.po',
  'a.po',
  'english.po',
  'enus.po',
])('throws when encountering the badly named file %j', (name: string) =>
  expectTranslations('bad-name', name).rejects.toMatchSnapshot());
