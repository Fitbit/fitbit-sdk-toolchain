import { Readable } from 'stream';

import Vinyl from 'vinyl';
import gulpAssertFiles from './gulpAssertFiles';

function makeTestStream(paths: string[]) {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};

  for (const path of paths) {
    stream.push(new Vinyl({ path, contents: Buffer.alloc(0) }));
  }

  stream.push(null);
  return stream;
}

function expectAssertResult({
  expected,
  actual,
}: {
  expected: string[];
  actual?: string[];
}) {
  return expect(
    new Promise((resolve, reject) => {
      const stream = makeTestStream(actual || ['foo', 'bar']).pipe(
        gulpAssertFiles(expected),
      );
      stream.on('error', reject);
      stream.on('finish', resolve);
    }),
  );
}

it.each([
  ['one required file is missing', ['baz']],
  ['two required files are missing', ['baz', 'zab']],
  ['three required files are missing', ['baz', 'zab', 'oof']],
])('emits an error if %s', (_, expected) =>
  expectAssertResult({ expected }).rejects.toMatchSnapshot(),
);

it('resolves if all requested files are present', () =>
  expectAssertResult({
    expected: ['foo', 'bar'],
  }).resolves.toBeUndefined());
