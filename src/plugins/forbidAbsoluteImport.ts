import path from 'path';

import { Plugin } from 'rollup';

export default function forbidAbsoluteImports(): Plugin {
  return {
    name: 'forbidAbsoluteImports',
    resolveId(importee, importer) {
      if (!importer) return null;
      if (importer.startsWith('\0')) return null;
      if (path.isAbsolute(importee)) {
        throw new Error(
          `${importee} is imported by ${importer}, but absolute imports are disallowed`,
        );
      }
      return null;
    },
  };
}
