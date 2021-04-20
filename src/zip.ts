import gulpZip from 'gulp-zip';
import vinylBuffer from 'vinyl-buffer';
import gulpDuplicates from './gulpDuplicates';
import readablePipeline from './readablePipeline';

export default function zip(
  filename: string,
  options?: gulpZip.GulpZipOptions,
) {
  return readablePipeline([
    vinylBuffer(),
    gulpDuplicates(),
    gulpZip(filename, options),
  ]);
}
