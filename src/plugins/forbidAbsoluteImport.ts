import path from 'path';

import { Plugin } from 'rollup';

export default function forbidAbsoluteImports(): Plugin {
    return {
        name: 'forbidAbsoluteImports',
        resolveId(importee: string, importer: string): void {
            if (!importer) {
                return;
            }
            if (importer.startsWith('\0')) {
                return;
            }
            if (path.isAbsolute(importee)) {
                throw new Error(`${importee} is imported by ${importer}, but absolute imports are disallowed`);
            }
        },
    };
}
