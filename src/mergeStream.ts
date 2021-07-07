import { PassThrough, Stream } from 'stream';

export default function mergeStream(...streams: Stream[]): PassThrough {
  let sources: Stream[] = streams;

  const output = new PassThrough({ objectMode: true });
  output.setMaxListeners(0);
  output.on('unpipe', remove);

  function remove(source: Stream) {
    sources = sources.filter((s) => s !== source);
    if (!sources.length && output.readable) {
      output.end();
    }
  }

  for (const stream of sources) {
    stream.on('error', output.emit.bind(output, 'error'));
    stream.on('end', remove.bind(null, stream));
    stream.pipe(output, { end: false });
  }

  return output;
}
