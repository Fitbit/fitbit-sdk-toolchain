import stream from 'stream';

import humanizeList from 'humanize-list';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

const PLUGIN_NAME = 'duplicates';

export default function vinylAssertFiles() {
  const foundPaths = new Set<string>();
  const duplicatePaths = new Set<string>();
  return new stream.Transform({
    objectMode: true,
    transform(this: stream.Transform, file: Vinyl, _, cb) {
      if (!file.isNull()) {
        if (foundPaths.has(file.relative)) {
          duplicatePaths.add(file.relative);
        } else {
          foundPaths.add(file.relative);
        }
      }
      cb(undefined, file);
    },
    flush(this: stream.Transform, cb) {
      if (duplicatePaths.size !== 0) {
        this.emit(
          'error',
          new PluginError(
            PLUGIN_NAME,
            `One or more files in the build output were duplicates: ${humanizeList(
              [...duplicatePaths],
            )}`,
          ),
        );
      }
      cb();
    },
  });
}
