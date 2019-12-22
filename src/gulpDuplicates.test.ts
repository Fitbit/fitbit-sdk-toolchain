import { Readable } from 'stream';
import path from 'path';

import Vinyl from 'vinyl';
import gulpDuplicates from './gulpDuplicates';

function makeTestStream(paths: string[]) {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};

  for (const path of paths) {
    stream.push(new Vinyl({ path, contents: Buffer.alloc(0) }));
  }

  stream.push(null);
  return stream;
}

function expectStreamPromise(paths: string[]) {
  return expect(
    new Promise((resolve, reject) => {
      const stream = makeTestStream(paths).pipe(gulpDuplicates());
      stream.on('error', reject);
      stream.on('finish', resolve);
    }),
  );
}

it('does not emit an error when no files are duplicated', () =>
  expectStreamPromise([
    'app/index.js',
    'app/foo.js',
    'resources/icon.png.txi',
  ]).resolves.toBeUndefined());

it('emits an error when a file is duplicated twice', () =>
  expectStreamPromise(['app/index.js', 'app/index.js']).rejects.toThrowError(
    `One or more files in the build output were duplicates: ${path.join(
      'app',
      'index.js',
    )}`,
  ));

it('emits an error when two files are duplicated', () =>
  expectStreamPromise([
    'app/index.js',
    'app/index.js',
    'resources/icon.png.txi',
    'resources/icon.png.txi',
  ]).rejects.toThrowError(
    `One or more files in the build output were duplicates: ${path.join(
      'app',
      'index.js',
    )} and ${path.join('resources', 'icon.png.txi')}`,
  ));
