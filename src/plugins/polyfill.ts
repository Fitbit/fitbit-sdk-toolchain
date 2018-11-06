import { Plugin } from 'rollup';

/**
 * Polyfill a module to make it seem like a builtin.
 */
export default function polyfill(modules: { [name: string]: string }): Plugin {
  return {
    name: 'polyfill',

    resolveId(importee) {
      if (modules[importee]) return '\0' + importee;
    },

    load(id) {
      if (id[0] !== '\0') return;
      const code = modules[id.slice(1)];
      return code !== undefined ? code : null;
    },
  };
}
