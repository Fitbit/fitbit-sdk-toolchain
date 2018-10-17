import path from 'path';
import stream from 'stream';

import Vinyl from 'vinyl';

import { ComponentType } from './componentTargets';
import { normalizeToPOSIX } from './pathUtils';

export default function collectComponentSourceMaps() {
  const emitter = new stream.PassThrough({ objectMode: true });

  const collector = (
    componentType: ComponentType,
    componentPlatform?: string,
  ) => new stream.Transform({
    objectMode: true,
    transform(file: Vinyl, _, next) {
      if (file.sourceMap) {
        const componentMapKey: string[] = [componentType];
        if (componentPlatform) componentMapKey.push(componentPlatform);
        componentMapKey.push(normalizeToPOSIX(file.relative));
        const mapPath = ['sourceMaps', ...componentMapKey].join('/') + '.map';

        emitter.push(new Vinyl({
          componentMapKey,
          contents: Buffer.from(JSON.stringify(file.sourceMap, undefined, 2), 'utf8'),
          base: process.cwd(),
          path: path.resolve(process.cwd(), mapPath),
        }));
      }
      next(undefined, file);
    },
  });

  return {
    collector,
    emitter,
  };
}
