import { Readable } from 'stream';

export default function makeReadStream() {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};
  return stream;
}
