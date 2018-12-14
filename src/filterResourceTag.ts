import { Transform, TransformCallback } from 'stream';
import Vinyl from 'vinyl';

import splitTaggedFilename from './splitTaggedFilename';

class FilterResourceTag extends Transform {
  private files = new Map<string, Vinyl>();

  constructor(private resourceFilterTag: string) {
    super({ objectMode: true });
  }

  // tslint:disable-next-line:function-name
  _transform(file: Vinyl, _: any, callback: TransformCallback) {
    if (file.isDirectory()) {
      callback(undefined, file);
      return;
    }

    const { basename, tag } = splitTaggedFilename(file.basename);
    if (
      tag === this.resourceFilterTag ||
      (tag === undefined && !this.files.has(file.path))
    ) {
      const newFile = file.clone({ contents: false });
      newFile.basename = basename;
      this.files.set(newFile.path, newFile);
    }
    callback();
  }

  // tslint:disable-next-line:function-name
  _flush(callback: TransformCallback) {
    for (const file of this.files.values()) {
      this.push(file);
    }

    this.files.clear();
    callback();
  }
}

/**
 * Strip the resource tags out of file names.
 */
export default function filterResourceTag(tagName: string) {
  return new FilterResourceTag(tagName);
}
