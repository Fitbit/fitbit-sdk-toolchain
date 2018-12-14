import fs from 'fs';
import path from 'path';

import { Plugin } from 'rollup';

export default function brokenImports(): Plugin {
  return {
    name: 'broken-imports',

    resolveId(importee, importer) {
      // Entry point paths were never broken, so no need to fix them
      if (!importer) return;

      if (importer.startsWith('\0')) return;

      // https://nodejs.org/docs/latest/api/modules.html#modules_loading_from_node_modules_folders
      if (/^\.{0,2}\//.test(importee)) return;

      const relativeImportee = path.join(path.dirname(importer), importee);
      const importeeJS = importee.endsWith('.js')
        ? relativeImportee
        : `${relativeImportee}.js`;
      if (fs.existsSync(importeeJS)) {
        this.warn(
          // tslint:disable-next-line:max-line-length
          `Import in ${path.relative(
            process.cwd(),
            importer,
          )} has non-relative path but should be relative: replace '${importee}' with './${importee}'.`,
        );
        return importeeJS;
      }
    },
  };
}
