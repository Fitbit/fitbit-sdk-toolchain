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
): Readable {
  // stream.pipeline doesn't emit errors on the last stream in the pipeline
  // like pumpify so it has to be done manually
  return (pipeline as any)(streams, (e: Error) => {
    if (e) streams[streams.length - 1].emit('error', e);
  });
}
