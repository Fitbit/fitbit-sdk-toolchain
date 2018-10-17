import gulpZip from 'gulp-zip';
import pumpify from 'pumpify';
import vinylBuffer from 'vinyl-buffer';

export default function zip(filename: string, options?: gulpZip.GulpZipOptions) {
  return new pumpify.obj(
    vinylBuffer(),
    // FW-62978: Fitbit OS is very picky about zip file flags and will reject
    // files where the file names are flagged as being UTF-8 encoded.
    //
    // We use an old version of gulp-zip that still uses JSZip, as the
    // yazl package used by newer versions sets the flag that Fitbit OS does
    // not like. We used to use gulp-archiver2, but the archive package it uses
    // has a bug that caused builds to never complete when zipping a bundle
    // with a large number of resources (IPD-99187).
    gulpZip(filename, options),
  );
}
