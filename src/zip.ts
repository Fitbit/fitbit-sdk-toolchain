import gulpZip from 'gulp-zip';
import multipipe from 'multipipe';
import vinylBuffer from 'vinyl-buffer';
import gulpDuplicates from './gulpDuplicates';

export default function zip(
  filename: string,
  options?: gulpZip.GulpZipOptions,
) {
  return multipipe([
    vinylBuffer(),
    gulpDuplicates(),
    gulpZip(filename, options),
  ]);
}
