import path from 'path';
import stream from 'stream';

import humanizeList from 'humanize-list';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

const PLUGIN_NAME = 'assert-files';

export default function vinylAssertFiles(expected: string[]) {
  const expectedPaths = new Set(expected.map(path.normalize));
  return new stream.Transform({
    objectMode: true,
    transform(this: stream.Transform, file: Vinyl, _, cb) {
      if (!file.isNull()) expectedPaths.delete(file.relative);
      cb(undefined, file);
    },
    flush(this: stream.Transform, cb) {
      if (expectedPaths.size !== 0) {
        this.emit(
          'error',
          new PluginError(
            PLUGIN_NAME,
            // tslint:disable-next-line:max-line-length
            `One or more required files do not exist in the project: ${humanizeList(
              [...expectedPaths],
            )}`,
          ),
        );
      }
      cb();
    },
  });
}
