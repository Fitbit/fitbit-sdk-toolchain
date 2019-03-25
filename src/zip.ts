import gulpZip from 'gulp-zip';
import pumpify from 'pumpify';
import vinylBuffer from 'vinyl-buffer';
import gulpDuplicates from './gulpDuplicates';

export default function zip(
  filename: string,
  options?: gulpZip.GulpZipOptions,
) {
  return new pumpify.obj(
    vinylBuffer(),
    gulpDuplicates(),
    gulpZip(filename, options),
  );
}
