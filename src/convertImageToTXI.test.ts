import concatStream from 'concat-stream';
import Vinyl from 'vinyl';
import vinylFS from 'vinyl-fs';

import convertImageToTXI, { TXIOutputFormat } from './convertImageToTXI';
import { Readable, PassThrough } from 'stream';
import { join } from 'path';
import { readFileSync } from 'fs';

const corruptImage = join(__dirname, '__test__', 'PngSuite-2017jul19', 'xs1n0g01.png');

const GOT_NON_STREAM_FILE_ERROR_STRING = 'Got a non-stream file';

function eventCounter(total: number, callback: () => void): () => void {
    let counter = total;
    if (counter < 1) {
        throw new TypeError('positive number required');
    }

    return () => {
        counter -= 1;
        if (counter < 1) {
            callback();
        }
    };
}

it('passes through non-PNG files untouched', done => {
    const files = [
        new Vinyl({
            path: 'index.js',
            contents: Buffer.of(),
        }),
        new Vinyl({
            path: 'directory.png',
            stat: {
                isDirectory: () => true,
                // tslint:disable-next-line:no-any
            } as any,
        }),
    ];

    const handleData = jest.fn();

    const converter = convertImageToTXI();
    converter
        .on('error', done.fail)
        .on('data', handleData)
        .on('end', () => {
            expect(handleData).toHaveBeenCalledTimes(files.length);
            files.forEach((value, index) => expect(handleData).toHaveBeenNthCalledWith(index + 1, value));
            done();
        });

    files.forEach(file => converter.write(file));
    converter.end();
});

describe('in streaming mode', () => {
    it('does not start reading from the source stream until there is a sink', done => {
        let shouldRead = false;
        const fileStream = new Readable({
            read(): void {
                if (shouldRead) {
                    done();
                } else {
                    done.fail('Started reading too soon');
                }
            },
        });

        convertImageToTXI()
            .on('data', (file: Vinyl) =>
                process.nextTick(() => {
                    shouldRead = true;
                    if (!file.isStream()) {
                        done.fail(GOT_NON_STREAM_FILE_ERROR_STRING);
                        return;
                    }
                    file.contents.on('data', () => {});
                })
            )
            .end(
                new Vinyl({
                    path: 'foo.png',
                    contents: fileStream,
                })
            );
    });

    it('handles a stream read error', done => {
        expect.assertions(2);

        const fileStream = new Readable({
            read(): void {
                // tslint:disable-next-line:no-invalid-this
                process.nextTick(() => this.emit('error', new Error('blarg im ded')));
            },
        });

        const converter = convertImageToTXI();
        converter
            .on('data', (file: Vinyl) => {
                if (!file.isStream()) {
                    done.fail(GOT_NON_STREAM_FILE_ERROR_STRING);
                    return;
                }

                // Start the lazy transform.
                file.contents.on('error', error => expect(error).toMatchSnapshot()).on('data', () => {});
            })
            .on('error', error => expect(error).toMatchSnapshot())
            .on('end', done);

        converter.end(
            new Vinyl({
                path: 'dead.png',
                contents: fileStream,
            })
        );
    });

    it('handles a corrupt PNG', done => {
        expect.assertions(2);
        const tally = eventCounter(2, done);

        vinylFS
            .src(corruptImage, { buffer: false })
            .pipe(convertImageToTXI())
            .on('error', error => {
                expect(error).toMatchSnapshot();
                tally();
            })
            .on('data', (file: Vinyl) => {
                if (!file.isStream()) {
                    done.fail(GOT_NON_STREAM_FILE_ERROR_STRING);
                    return;
                }

                file.contents
                    .on('error', error => {
                        expect(error).toMatchSnapshot();
                        tally();
                    })
                    .on('data', () => {});
            });
    });

    it.each([['empty', Buffer.of()], ['truncated', Buffer.from('89504E470D0A1A0A', 'hex')]])(
        'gracefully errors if the PNG file is %s',
        (_, data, done) => {
            expect.assertions(2);
            const tally = eventCounter(2, done);

            const contents = new PassThrough();
            contents.end(data);

            convertImageToTXI()
                .on('error', error => {
                    expect(error).toMatchSnapshot();
                    tally();
                })
                .on(
                    'data',
                    // tslint:disable-next-line:no-identical-functions
                    (file: Vinyl): void => {
                        if (!file.isStream()) {
                            done.fail(GOT_NON_STREAM_FILE_ERROR_STRING);
                            return;
                        }

                        file.contents
                            .on('error', error => {
                                expect(error).toMatchSnapshot();
                                tally();
                            })
                            .on('data', () => {});
                    }
                )
                .end(
                    new Vinyl({
                        contents,
                        path: 'image.png',
                    })
                );
        }
    );

    it.each([['1bit.png', 'monochrome'], ['rgb_image.png', 'RGB'], ['rle_no_leftovers.png', 'RGBA']])(
        'converts %s to a %s TXI',
        (filename: string, _, done: jest.DoneCallback) => {
            expect.hasAssertions();

            const png = join(__dirname, '__test__', filename);
            vinylFS
                .src(png, { buffer: false })
                .pipe(convertImageToTXI())
                .on('error', done.fail)
                .on('data', (txi: Vinyl) => {
                    expect(txi.basename).toBe(`${filename}.txi`);
                    expect(txi.isStream()).toBe(true);
                    if (txi.isStream()) {
                        txi.contents.pipe(
                            concatStream(contents => {
                                expect(contents.compare(readFileSync(`${png}.txi`))).toBe(0);
                                done();
                            })
                        );
                    }
                });
        }
    );
});

describe('in buffered mode', () => {
    it('handles a corrupt PNG', done => {
        expect.assertions(1);

        vinylFS
            .src(corruptImage)
            .pipe(convertImageToTXI())
            .on('error', error => {
                expect(error).toMatchSnapshot();
                done();
            })
            .on('data', () => done.fail('Got an unexpected file'));
    });

    it.each([['empty', Buffer.of()], ['truncated', Buffer.from('89504E470D0A1A0A', 'hex')]])(
        'gracefully errors if the PNG file is %s',
        (_, contents, done) => {
            expect.assertions(1);

            convertImageToTXI()
                .on('error', error => {
                    expect(error).toMatchSnapshot();
                    done();
                })
                .on('data', () => done.fail('Got an unexpected file'))
                .end(
                    new Vinyl({
                        contents,
                        path: 'image.png',
                    })
                );
        }
    );

    it.each([['1bit.png', 'monochrome'], ['rgb_image.png', 'RGB'], ['rle_no_leftovers.png', 'RGBA']])(
        'converts %s to a %s TXI',
        (filename: string, _, done: jest.DoneCallback) => {
            expect.hasAssertions();

            const png = join(__dirname, '__test__', filename);
            vinylFS
                .src(png)
                .pipe(convertImageToTXI())
                .on('error', done.fail)
                .on('data', (txi: Vinyl) => {
                    expect(txi.basename).toBe(`${filename}.txi`);
                    expect(txi.isBuffer()).toBe(true);
                    if (txi.isBuffer()) {
                        expect(txi.contents.compare(readFileSync(`${png}.txi`))).toBe(0);
                        done();
                    }
                });
        }
    );
});

describe('RGBA output format for alpha channel images', () => {
    it('converts to RGBA6666 if specified', (done: jest.DoneCallback) => {
        const png = join(__dirname, '__test__/rle_no_leftovers.png');

        vinylFS
            .src(png)
            .pipe(convertImageToTXI({ rgbaOutputFormat: TXIOutputFormat.RGBA6666 }))
            .on('error', done.fail)
            .on('data', (txi: Vinyl) => {
                if (txi.isBuffer()) {
                    expect(txi.contents.compare(readFileSync(`${png}.RGBA6666.txi`))).toBe(0);
                    done();
                }
            });
    });

    it('defaults to RGBA8888 if RGBA6666 is not specified', (done: jest.DoneCallback) => {
        const png = join(__dirname, '__test__/rle_no_leftovers.png');

        vinylFS
            .src(png)
            .pipe(convertImageToTXI())
            .on('error', done.fail)
            .on('data', (txi: Vinyl) => {
                if (txi.isBuffer()) {
                    expect(txi.contents.compare(readFileSync(`${png}.txi`))).toBe(0);
                    done();
                }
            });
    });
});
