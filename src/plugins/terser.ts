import { Plugin } from 'rollup';
import { minify, TerserOptions } from 'terser';

export default function terser(options: TerserOptions): Plugin {
  return {
    name: 'terser',

    renderChunk(code) {
      return minify(code, {
        ...options,
        sourceMap: true,
      });
    },
  };
}
