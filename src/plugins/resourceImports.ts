import fs from 'fs';
import { extname } from 'path';

import { Plugin } from 'rollup';

const mimeTypes: {[ext: string]: string} = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

export default function resourceImports(options = {}): Plugin {
  return {
    name: 'resourceImports',
    load(id) {
      const mime = mimeTypes[extname(id)];
      if (!mime) return undefined;

      const file = fs.readFileSync(id);
      return `export default "data:${mime};base64,${Buffer.from(file).toString('base64')}";`;
    },
  };
}
