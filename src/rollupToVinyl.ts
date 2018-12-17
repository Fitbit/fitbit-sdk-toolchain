import { resolve } from 'path';
import { Readable } from 'stream';

import PluginError from 'plugin-error';
import * as rollup from 'rollup';
import sourceMapCompactor from 'source-map-compactor';
import Vinyl from 'vinyl';

interface VinylPluginError {
  columnNumber?: number;
}

export default function rollupToVinyl(
  outputPath: string,
  inputOptions: rollup.RollupFileOptions,
  outputOptions: rollup.OutputOptions,
) {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};

  rollup
    .rollup(inputOptions)
    .then((bundle) => {
      stream.emit('bundle', bundle);
      return bundle.generate(outputOptions).then(({ code, map }) => {
        if (map) {
          // Rollup produces bad sourcemaps, this package fixes them up.
          // We've tried taking it out, and source maps have broken each
          // time. NO TOUCHING!
          map.mappings = JSON.parse(sourceMapCompactor(map)).mappings;

          // Rollup only writes the basename to the file property
          map.file = outputPath;
        }
        stream.push(
          new Vinyl({
            contents: Buffer.from(code, 'utf8'),
            path: resolve(process.cwd(), outputPath),
            sourceMap: map,
          }),
        );
        stream.push(null);
      });
    })
    .catch((reason) => {
      setImmediate(() => {
        const pluginErr: PluginError<VinylPluginError> = new PluginError(
          'rollup',
          reason,
        );

        if (reason.loc) {
          pluginErr.fileName = reason.loc.file;
          pluginErr.lineNumber = reason.loc.line;
          pluginErr.columnNumber = reason.loc.column;
        }

        delete (pluginErr as any).loc;
        delete (pluginErr as any).pos;

        stream.emit('error', pluginErr);
      });
    });

  return stream;
}
