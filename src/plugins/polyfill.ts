import { Plugin } from 'rollup';

export type Polyfill = string | (() => string | Promise<string>);
export type PolyfillMap = Record<string, Polyfill>;

/**
 * Polyfill a module to make it seem like a builtin.
 */
export default function polyfill(modules: PolyfillMap): Plugin {
  return {
    name: 'polyfill',

    resolveId(importee, importer) {
      // Allow a module to wrap a module of the same name
      if (importer === '\0' + importee) return false;
      if (modules[importee]) return '\0' + importee;
    },

    load(id) {
      if (id[0] !== '\0') return null;
      const code = modules[id.slice(1)];
      if (code === undefined) return null;
      return typeof code === 'function' ? code() : code;
    },
  };
}
