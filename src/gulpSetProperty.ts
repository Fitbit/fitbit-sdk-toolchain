import { Transform } from 'stream';

import Vinyl from 'vinyl';

export default function gulpSetProperty(properties: {}) {
  const transform = new Transform({
    objectMode: true,
    transform(file: Vinyl, _, next) {
      if (!file.isNull()) Object.assign(file, properties);
      next(undefined, file);
    },
  });

  return transform;
}
