import stream from 'stream';

import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

import { DiagnosticCategory, DiagnosticHandler } from './diagnostics';
import byteStringFormatter from './util/byteStringFormatter';

const PLUGIN_NAME = 'validateFileSizes';

export default function validateFileSizes({
  maxSizes,
  onDiagnostic,
}: {
  maxSizes: Record<string, number | undefined>;
  onDiagnostic: DiagnosticHandler;
}) {
  return new stream.Transform({
    objectMode: true,
    transform(this: stream.Transform, file: Vinyl, _, cb) {
      const expectedMaxSize = maxSizes[file.relative];
      if (file.isNull() || expectedMaxSize === undefined) {
        return cb(undefined, file);
      }

      if (!file.isBuffer()) {
        // Error if file is not a buffer, may in the future support file streams
        return cb(
          new PluginError(
            PLUGIN_NAME,
            `File is not a buffer: ${file.relative}`,
            {
              fileName: file.relative,
            },
          ),
        );
      }

      const actualSize = file.contents.byteLength;
      if (actualSize > expectedMaxSize) {
        onDiagnostic({
          category: DiagnosticCategory.Error,
          messageText: `${
            file.relative
          } is larger than maximum allowed size. File size was ${byteStringFormatter(
            actualSize,
            4,
          )}, maximum allowed is ${byteStringFormatter(expectedMaxSize, 4)}.`,
        });
      }

      return cb(undefined, file);
    },
  });
}
