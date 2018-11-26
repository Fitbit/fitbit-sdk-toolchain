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
    outputOptions: rollup.OutputOptions
): Readable {
    const stream = new Readable({ objectMode: true });
    stream._read = () => {};

    rollup
        .rollup(inputOptions)
        .then(bundle => {
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
                    })
                );
                stream.push(null);
            });
        })
        .catch(reason => {
            setImmediate(() => {
                const pluginError: PluginError<VinylPluginError> = new PluginError('rollup', reason);

                if (reason.loc) {
                    pluginError.fileName = reason.loc.file;
                    pluginError.lineNumber = reason.loc.line;
                    pluginError.columnNumber = reason.loc.column;
                }

                // tslint:disable-next-line:no-any
                delete (pluginError as any).loc;
                // tslint:disable-next-line:no-any
                delete (pluginError as any).pos;

                stream.emit('error', pluginError);
            });
        });

    return stream;
}
