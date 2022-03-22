import { Transform, Readable } from 'stream';

import {
  encode,
  TXIOutputFormat,
  RGBAOutputFormat,
} from '@fitbit/image-codec-txi';
import PluginError from 'plugin-error';
import { Metadata as PNGMetadata, PNG } from '@fitbit/pngjs';
import Vinyl from 'vinyl';

export { TXIOutputFormat };

const PLUGIN_NAME = 'convertImageToTXI';

export interface ConvertImageToTXIOptions {
  /**
   * Defaults to RGBA8888
   */
  rgbaOutputFormat?: RGBAOutputFormat;
}

function pickOutputFormat(
  image: PNGMetadata,
  rgbaOutputFormat: RGBAOutputFormat = TXIOutputFormat.RGBA8888,
) {
  if (!image.color) return TXIOutputFormat.A8;
  if (!image.alpha) return TXIOutputFormat.RGB565;

  return rgbaOutputFormat;
}

function transformPNG(png: PNG, rgbaOutputFormat?: RGBAOutputFormat) {
  return new Promise<Buffer>((resolve, reject) => {
    png.on('metadata', (metadata) => {
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
            },
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

function transformPNGBuffer(file: Buffer, rgbaOutputFormat?: RGBAOutputFormat) {
  const png = new PNG();
  const transformer = transformPNG(png, rgbaOutputFormat);
  png.parse(file);
  return transformer;
}

/**
 * Lazily parse the PNG to cut down on the number of images
 * concurrently in memory.
 */
function transformPNGStream(
  file: NodeJS.ReadableStream,
  rgbaOutputFormat?: RGBAOutputFormat,
) {
  let started = false;

  return new Readable({
    read() {
      if (started) return;
      started = true;

      const png = new PNG();
      transformPNG(png, rgbaOutputFormat)
        .then((txi) => {
          this.push(txi);
          this.push(null);
        })
        .catch((error) => this.emit('error', error));

      file.on('error', (err) => this.emit('error', err)).pipe(png);
    },
  });
}

export default function convertImageToTXI(
  options: ConvertImageToTXIOptions = {},
) {
  return new Transform({
    objectMode: true,
    transform(this: Transform, file: Vinyl, _, cb) {
      if (file.isNull() || file.extname !== '.png') {
        return cb(undefined, file);
      }

      const fileName = file.relative;
      file.basename += '.txi';

      if (file.isBuffer()) {
        transformPNGBuffer(file.contents, options.rgbaOutputFormat)
          .then((txi) => {
            file.contents = txi;
            cb(undefined, file);
          })
          .catch((err) => cb(new PluginError(PLUGIN_NAME, err, { fileName })));
      } else if (file.isStream()) {
        file.contents = transformPNGStream(
          file.contents,
          options.rgbaOutputFormat,
        ).on('error', (err) =>
          this.emit('error', new PluginError(PLUGIN_NAME, err, { fileName })),
        );
        cb(undefined, file);
      }
    },
  });
}
