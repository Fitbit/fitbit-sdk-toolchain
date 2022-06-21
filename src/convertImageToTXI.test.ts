import concatStream from 'concat-stream';
import Vinyl from 'vinyl';
import vinylFS from 'vinyl-fs';

import convertImageToTXI, { TXIOutputFormat } from './convertImageToTXI';
import { Readable, PassThrough } from 'stream';
import { join } from 'path';
import { readFileSync } from 'fs';

const corruptImage = join(
  __dirname,
  '__test__',
  'PngSuite-2017jul19',
  'xs1n0g01.png',
);

function eventCounter(total: number, callback: () => void) {
  let counter = total;
  if (counter < 1) throw new TypeError('positive number required');

  return () => {
    counter -= 1;
    if (counter < 1) callback();
  };
}

it('passes through non-PNG files untouched', (done) => {
  const files = [
    new Vinyl({
      path: 'index.js',
      contents: Buffer.of(),
    }),
    new Vinyl({
      path: 'directory.png',
      stat: {
        isDirectory: () => true,
      } as any,
    }),
  ];

  const handleData = jest.fn();

  const converter = convertImageToTXI();
  converter
    .on('error', done)
    .on('data', handleData)
    .on('end', () => {
      expect(handleData).toHaveBeenCalledTimes(files.length);
      files.forEach((value, index) =>
        expect(handleData).toHaveBeenNthCalledWith(index + 1, value),
      );
      done();
    });

  files.forEach((file) => converter.write(file));
  converter.end();
});

describe('in streaming mode', () => {
  it('does not start reading from the source stream until there is a sink', (done) => {
    let shouldRead = false;
    const fileStream = new Readable({
      read() {
        if (shouldRead) {
          done();
        } else {
          done('Started reading too soon');
        }
      },
    });

    convertImageToTXI()
      .on('data', (file: Vinyl) =>
        process.nextTick(() => {
          shouldRead = true;
          if (!file.isStream()) {
            done('Got a non-stream file');
            return;
          }
          file.contents.on('data', () => {});
        }),
      )
      .end(
        new Vinyl({
          path: 'foo.png',
          contents: fileStream,
        }),
      );
  });

  it('handles a stream read error', (done) => {
    expect.assertions(2);

    const fileStream = new Readable({
      read() {
        process.nextTick(() => this.emit('error', new Error('blarg im ded')));
      },
    });

    const converter = convertImageToTXI();
    converter
      .on('data', (file: Vinyl) => {
        if (!file.isStream()) {
          done('Got a non-stream file');
          return;
        }

        // Start the lazy transform.
        file.contents
          .on('error', (error) => expect(error).toMatchSnapshot())
          .on('data', () => {});
      })
      .on('error', (error) => expect(error).toMatchSnapshot())
      .on('end', done);

    converter.end(
      new Vinyl({
        path: 'dead.png',
        contents: fileStream,
      }),
    );
  });

  it('handles a corrupt PNG', (done) => {
    expect.assertions(2);
    const tally = eventCounter(2, done);

    vinylFS
      .src(corruptImage, { buffer: false })
      .pipe(convertImageToTXI())
      .on('error', (error) => {
        expect(error).toMatchSnapshot();
        tally();
      })
      .on('data', (file: Vinyl) => {
        if (!file.isStream()) {
          done('Got a non-stream file');
          return;
        }

        file.contents
          .on('error', (error) => {
            expect(error).toMatchSnapshot();
            tally();
          })
          .on('data', () => {});
      });
  });

  // FIXME: Jest typings are broken and can't deal with the done callback parameter properly
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34617
  it.each<any>([
    ['empty', Buffer.of()],
    ['truncated', Buffer.from('89504E470D0A1A0A', 'hex')],
  ])('gracefully errors if the PNG file is %s', (_, data, done) => {
    expect.assertions(2);
    const tally = eventCounter(2, done);

    const contents = new PassThrough();
    contents.end(data);

    convertImageToTXI()
      .on('error', (error) => {
        expect(error).toMatchSnapshot();
        tally();
      })
      .on('data', (file: Vinyl) => {
        if (!file.isStream()) {
          done('Got a non-stream file');
          return;
        }

        file.contents
          .on('error', (error) => {
            expect(error).toMatchSnapshot();
            tally();
          })
          .on('data', () => {});
      })
      .end(
        new Vinyl({
          contents,
          path: 'image.png',
        }),
      );
  });

  // FIXME: Jest typings are broken and can't deal with the done callback parameter properly
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34617
  it.each<any>([
    ['1bit.png', 'monochrome'],
    ['rgb_image.png', 'RGB'],
    ['rle_no_leftovers.png', 'RGBA'],
  ])(
    'converts %s to a %s TXI',
    (filename: string, _, done: jest.DoneCallback) => {
      expect.hasAssertions();

      const png = join(__dirname, '__test__', filename);
      vinylFS
        .src(png, { buffer: false })
        .pipe(convertImageToTXI())
        .on('error', done)
        .on('data', (txi: Vinyl) => {
          expect(txi.basename).toBe(`${filename}.txi`);
          expect(txi.isStream()).toBe(true);
          if (txi.isStream()) {
            txi.contents.pipe(
              concatStream((contents) => {
                expect(contents.compare(readFileSync(`${png}.txi`))).toBe(0);
                done();
              }),
            );
          }
        });
    },
  );
});

describe('in buffered mode', () => {
  it('handles a corrupt PNG', (done) => {
    expect.assertions(1);

    vinylFS
      .src(corruptImage)
      .pipe(convertImageToTXI())
      .on('error', (error) => {
        expect(error).toMatchSnapshot();
        done();
      })
      .on('data', () => done('Got an unexpected file'));
  });

  // FIXME: Jest typings are broken and can't deal with the done callback parameter properly
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34617
  it.each<any>([
    ['empty', Buffer.of()],
    ['truncated', Buffer.from('89504E470D0A1A0A', 'hex')],
  ])('gracefully errors if the PNG file is %s', (_, contents, done) => {
    expect.assertions(1);

    convertImageToTXI()
      .on('error', (error) => {
        expect(error).toMatchSnapshot();
        done();
      })
      .on('data', () => done('Got an unexpected file'))
      .end(
        new Vinyl({
          contents,
          path: 'image.png',
        }),
      );
  });

  // FIXME: Jest typings are broken and can't deal with the done callback parameter properly
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34617
  it.each<any>([
    ['1bit.png', 'monochrome'],
    ['rgb_image.png', 'RGB'],
    ['rle_no_leftovers.png', 'RGBA'],
  ])(
    'converts %s to a %s TXI',
    (filename: string, _, done: jest.DoneCallback) => {
      expect.hasAssertions();

      const png = join(__dirname, '__test__', filename);
      vinylFS
        .src(png)
        .pipe(convertImageToTXI())
        .on('error', done)
        .on('data', (txi: Vinyl) => {
          expect(txi.basename).toBe(`${filename}.txi`);
          expect(txi.isBuffer()).toBe(true);
          if (txi.isBuffer()) {
            expect(txi.contents.compare(readFileSync(`${png}.txi`))).toBe(0);
            done();
          }
        });
    },
  );
});

describe('RGBA output format for alpha channel images', () => {
  it('converts to RGBA6666 if specified', (done: jest.DoneCallback) => {
    const png = join(__dirname, '__test__/rle_no_leftovers.png');

    vinylFS
      .src(png)
      .pipe(convertImageToTXI({ rgbaOutputFormat: TXIOutputFormat.RGBA6666 }))
      .on('error', done)
      .on('data', (txi: Vinyl) => {
        if (txi.isBuffer()) {
          expect(
            txi.contents.compare(readFileSync(`${png}.RGBA6666.txi`)),
          ).toBe(0);
          done();
        }
      });
  });

  it('defaults to RGBA8888 if RGBA6666 is not specified', (done: jest.DoneCallback) => {
    const png = join(__dirname, '__test__/rle_no_leftovers.png');

    vinylFS
      .src(png)
      .pipe(convertImageToTXI())
      .on('error', done)
      .on('data', (txi: Vinyl) => {
        if (txi.isBuffer()) {
          expect(txi.contents.compare(readFileSync(`${png}.txi`))).toBe(0);
          done();
        }
      });
  });
});
