import * as stream from 'stream';

export class Readable extends stream.Readable {
  constructor(fn: (options?: {}) => stream.Readable, options: stream.ReadableOptions);
  constructor(fn: () => stream.Readable);
}

export class Writable extends stream.Writable {
  constructor(fn: (options?: {}) => stream.Writable, options: stream.WritableOptions);
  constructor(fn: () => stream.Readable);
}
