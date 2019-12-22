import { writeArray } from 'event-stream';
import Vinyl from 'vinyl';
import path from 'path';

import filterResourceTag from './filterResourceTag';

const projectDir = new Map<string, Vinyl>();

[
  path.normalize('/app/index.js'),

  path.normalize('/app/lib/foo~bar.js'),
  path.normalize('/app/lib/foo.js'),
  path.normalize('/app/lib/foo~quux.js'),

  path.normalize('/resources/resources.json'),
  path.normalize('/resources/index.gui'),
  path.normalize('/resources/index~higgs.gui'),
  path.normalize('/resources/index~asdf.gui'),
  path.normalize('/resources/widgets~higgs.gui'),
  path.normalize('/resources/widgets~foo.gui'),
  path.normalize('/resources/no~fallback.txt'),
  path.normalize('/resources/exclude~me.txt'),
  path.normalize('/resources/exclude~this.txt'),

  path.normalize('/resources/images/icon~higgs.png'),
  path.normalize('/resources/images/icon.png'),
].forEach((path) =>
  projectDir.set(
    path,
    new Vinyl({
      path,
      contents: Buffer.from(`content of ${path}`, 'utf8'),
    }),
  ),
);

const fs = new Map<string, Vinyl>();
const paths: string[] = [];

beforeAll((done) => {
  const filter = filterResourceTag('higgs');
  filter.pipe(
    writeArray((err: any, files: Vinyl[]) => {
      if (err) return done.fail(err);
      files.forEach((file) => {
        fs.set(file.path, file);
        paths.push(file.path);
      });
      done();
    }),
  );

  projectDir.forEach((file) => filter.write(file));
  filter.end();
});

it.each(['/app/index.js', '/resources/resources.json'])(
  'passes through %s with no tagged alternative',
  (path) => {
    expect(fs.get(path)).toEqual(projectDir.get(path));
  },
);

it.each([
  'index~higgs.gui',
  'index~asdf.gui',
  'widgets~higgs.gui',
  'widgets~foo.gui',
  'no~fallback.txt',
  'exclude~me.txt',
  'exclude~this.txt',
  'images/icon~higgs.png',
])('does not set the tag-included filename %s', (path: string) =>
  expect(paths).not.toContain('/resources/' + path),
);

it.each([
  ['index~higgs.gui', 'index.gui'],
  ['widgets~higgs.gui', 'widgets.gui'],
  ['images/icon~higgs.png', 'images/icon.png'],
])(
  'prefers the tagged file %s over the untagged %s',
  (tagged: string, untagged: string) => {
    expect(fs.get(path.normalize('/resources/' + untagged))!.contents).toEqual(
      projectDir.get(path.normalize('/resources/' + tagged))!.contents,
    );
  },
);

it('excludes tagged resources with no matching tag option', () => {
  ['no.txt', 'exclude.txt'].forEach((path) =>
    expect(paths).not.toContain('/resources/' + path),
  );
});

it('passes directories through untouched', (done) => {
  const dir = new Vinyl({
    path: '/some/dir',
    stat: {
      isDirectory: () => true,
    } as any,
  });

  expect.assertions(1);
  const filter = filterResourceTag('foo');
  filter.on('error', done.fail);
  filter.on('data', (value) => expect(value).toBe(dir));
  filter.on('end', done);

  filter.end(dir);
});
