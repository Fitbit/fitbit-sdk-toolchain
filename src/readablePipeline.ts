import { Readable, Stream, pipeline } from 'stream';

// This is just pipeline with more permissive types to fit in where we previously used pumpify
export default function readablePipeline(
  streams: readonly (
    | // tslint:disable-next-line:max-union-size
    NodeJS.ReadableStream
    | NodeJS.WritableStream
    | NodeJS.ReadWriteStream
    | Stream
  )[],
  callback: (err: NodeJS.ErrnoException | null) => void = () => {},
): Readable {
  return (pipeline as any)(streams, callback);
}
