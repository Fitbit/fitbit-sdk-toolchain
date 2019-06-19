import MagicString from 'magic-string';
import { Plugin } from 'rollup';

// require is bugged in FbOS such that the loaded module has its scope
// merged with the global scope, which is bad news (and particularly
// so if you use a minifier as we do). In order to workaround this,
// this plugin wraps all non-entry chunks in an IIFE to maintain
// isolation of scopes.

export default function workaroundChunkScope(): Plugin {
  return {
    name: 'workaroundChunkScope',

    renderChunk(code, chunk) {
      // Only non-entry chunks need this fix (since those are loaded using require)
      if (chunk.isEntry) return null;

      const magic = new MagicString(code);
      magic.prepend('(function(){');
      magic.append('})()');

      return {
        code: magic.toString(),
        map: magic.generateMap({
          hires: true,
        }),
      };
    },
  };
}
