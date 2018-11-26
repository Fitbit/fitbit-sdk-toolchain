import { Transform, Readable } from 'stream';

import { encode, TXIOutputFormat } from '@fitbit/image-codec-txi';
import PluginError from 'plugin-error';
import { Metadata as PNGMetadata, PNG } from '@fitbit/pngjs';
import Vinyl from 'vinyl';
import { NextTransformCallback } from './appPackageManifest';

export { TXIOutputFormat };

const PLUGIN_NAME = 'convertImageToTXI';

type RGBAOutputFormat = TXIOutputFormat.RGBA8888 | TXIOutputFormat.RGBA6666;

export interface ConvertImageToTXIOptions {
    /**
     * Defaults to RGBA8888
     */
    rgbaOutputFormat?: RGBAOutputFormat;
}

function pickOutputFormat(image: PNGMetadata, rgbaOutputFormat: RGBAOutputFormat = TXIOutputFormat.RGBA8888): TXIOutputFormat {
    if (!image.color) {
        return TXIOutputFormat.A8;
    }
    if (!image.alpha) {
        return TXIOutputFormat.RGB565;
    }

    return rgbaOutputFormat;
}

function transformPNG(png: PNG, rgbaOutputFormat?: RGBAOutputFormat): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        png.on('metadata', metadata => {
            png.on('parsed', () => {
                try {
                    const txi = encode(
                        {
                            data: new Uint8ClampedArray(png.data),
                            width: png.width,
                            height: png.height,
                        },
                        {
                            outputFormat: pickOutputFormat(metadata, rgbaOutputFormat),
                            rle: 'auto',
                        }
                    );
                    resolve(Buffer.from(txi));
                } catch (e) {
                    reject(e);
                }
            });
        });
        png.on('error', reject);
    });
}

function transformPNGBuffer(file: Buffer, rgbaOutputFormat?: RGBAOutputFormat): Promise<Buffer> {
    const png = new PNG();
    const transformer = transformPNG(png, rgbaOutputFormat);
    png.parse(file);
    return transformer;
}

/**
 * Lazily parse the PNG to cut down on the number of images
 * concurrently in memory.
 */
function transformPNGStream(file: NodeJS.ReadableStream, rgbaOutputFormat?: RGBAOutputFormat): Readable {
    let started = false;

    return new Readable({
        read(): void {
            if (started) {
                return;
            }
            started = true;

            const png = new PNG();
            transformPNG(png, rgbaOutputFormat)
                .then(txi => {
                    // tslint:disable-next-line:no-invalid-this
                    this.push(txi);
                    // tslint:disable-next-line:no-invalid-this
                    this.push(null);
                })
                // tslint:disable-next-line:no-invalid-this
                .catch(error => this.emit('error', error));

            // tslint:disable-next-line:no-invalid-this
            file.on('error', err => this.emit('error', err)).pipe(png);
        },
    });
}

export default function convertImageToTXI(options: ConvertImageToTXIOptions = {}): Transform {
    return new Transform({
        objectMode: true,
        transform(this: Transform, file: Vinyl, _: unknown, callback: NextTransformCallback): void {
            if (file.isNull() || file.extname !== '.png') {
                return callback(undefined, file);
            }

            const fileName = file.relative;
            file.basename += '.txi';

            if (file.isBuffer()) {
                transformPNGBuffer(file.contents, options.rgbaOutputFormat)
                    .then(txi => {
                        file.contents = txi;
                        callback(undefined, file);
                    })
                    .catch(err => callback(new PluginError(PLUGIN_NAME, err, { fileName })));
            } else if (file.isStream()) {
                file.contents = transformPNGStream(file.contents, options.rgbaOutputFormat).on('error', err =>
                    // tslint:disable-next-line:no-invalid-this
                    this.emit('error', new PluginError(PLUGIN_NAME, err, { fileName }))
                );
                callback(undefined, file);
            }
        },
    });
}
