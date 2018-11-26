import { Plugin } from 'rollup';

export type Polyfill = string | (() => string | Promise<string>);

type PolyfillLoadReturnType = null | undefined | string | Promise<string>;

/**
 * Polyfill a module to make it seem like a builtin.
 */
export default function polyfill(modules: { [name: string]: Polyfill }): Plugin {
    return {
        name: 'polyfill',

        resolveId(importee: string): string | undefined {
            if (modules[importee]) {
                return '\0' + importee;
            }
        },

        load(id: string): PolyfillLoadReturnType {
            if (id[0] !== '\0') {
                return undefined;
            }
            const code = modules[id.slice(1)];
            if (code === undefined) {
                return null;
            }
            return typeof code === 'function' ? code() : code;
        },
    };
}
