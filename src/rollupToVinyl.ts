import { posix, resolve } from 'path';
import { Readable } from 'stream';

import PluginError from 'plugin-error';
import * as rollup from 'rollup';
import sourceMapCompactor from 'source-map-compactor';
import Vinyl from 'vinyl';

interface VinylPluginError {
  columnNumber?: number;
}

function isEmittedAsset(
  chunkOrAsset: rollup.OutputChunk | rollup.OutputAsset,
): chunkOrAsset is rollup.OutputAsset {
  return !!(chunkOrAsset as rollup.OutputAsset).isAsset;
}

export default function rollupToVinyl(
  inputOptions: rollup.RollupOptions,
  outputOptions: rollup.OutputOptions,
) {
  const stream = new Readable({ objectMode: true });
  stream._read = () => {};

  function generatePath(fileName: string) {
    return outputOptions.dir
      ? posix.join(outputOptions.dir, fileName)
      : fileName;
  }

  function emitAsset({ fileName, source }: rollup.OutputAsset) {
    stream.push(
      new Vinyl({
        contents: Buffer.isBuffer(source)
          ? source
          : Buffer.from(source, 'utf8'),
        path: resolve(process.cwd(), generatePath(fileName)),
      }),
    );
  }

  function emitChunk({ code, fileName, map, isEntry }: rollup.OutputChunk) {
    const chunkPath = generatePath(fileName);
    if (map) {
      // Rollup produces bad sourcemaps, this package fixes them up.
      // We've tried taking it out, and source maps have broken each
      // time. NO TOUCHING!
      map.mappings = JSON.parse(sourceMapCompactor(map)).mappings;

      // Rollup only writes the basename to the file property
      map.file = chunkPath;
    }
    stream.push(
      new Vinyl({
        isEntryPoint: isEntry,
        contents: Buffer.from(code, 'utf8'),
        path: resolve(process.cwd(), chunkPath),
        sourceMap: map,
      }),
    );
  }

  rollup
    .rollup(inputOptions)
    .then((bundle) => {
      stream.emit('bundle', bundle);
      return bundle.generate(outputOptions).then(({ output }) => {
        for (const chunkOrAsset of output) {
          if (isEmittedAsset(chunkOrAsset)) emitAsset(chunkOrAsset);
          else emitChunk(chunkOrAsset);
        }
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
