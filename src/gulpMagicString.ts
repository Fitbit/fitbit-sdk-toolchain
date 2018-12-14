import { Transform } from 'stream';

import MagicString from 'magic-string';
import PluginError from 'plugin-error';
import {
  SourceMapConsumer,
  SourceMapGenerator,
  RawSourceMap,
} from 'source-map';
import Vinyl from 'vinyl';

const PLUGIN_NAME = 'gulp-magic-string';

async function mergeSourceMaps(inMap: RawSourceMap, outMap: RawSourceMap) {
  return SourceMapConsumer.with(inMap, null, async (inConsumer) =>
    SourceMapConsumer.with(outMap, null, async (outConsumer) => {
      const generator = SourceMapGenerator.fromSourceMap(inConsumer);
      generator.applySourceMap(outConsumer);
      return generator.toJSON();
    }),
  );
}

export default function gulpMagicString(
  transformerFunc: (code: string, magicString: MagicString) => void,
) {
  const transform = new Transform({
    objectMode: true,
    transform(file: Vinyl, _, next) {
      if (file.isNull() || file.extname !== '.js') {
        return next(undefined, file);
      }

      if (!file.isBuffer()) {
        next(
          new PluginError(
            PLUGIN_NAME,
            file.isStream()
              ? 'Streaming mode is not supported.'
              : 'Internal error processing file.',
            { fileName: file.relative },
          ),
        );
        return;
      }

      try {
        const code = file.contents.toString('utf-8');
        const parsed = new MagicString(code);

        transformerFunc(code, parsed);

        file.contents = Buffer.from(parsed.toString());

        if (!file.sourceMap) return next(undefined, file);
        const map = parsed.generateMap();

        mergeSourceMaps(
          file.sourceMap,
          // magic-string thinks map.version is a string, source-map thinks it's a number
          {
            ...map,
            version: Number(map.version),
            file: file.relative,
            sources: [file.relative],
          },
        ).then((sourceMap) => {
          file.sourceMap = sourceMap;
          next(undefined, file);
        });
      } catch (error) {
        next(new PluginError(PLUGIN_NAME, error, { fileName: file.relative }));
      }
    },
  });

  return transform;
}
