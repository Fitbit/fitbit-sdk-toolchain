import { Plugin } from 'rollup';

interface Options {
  preferBuiltins?: boolean;
}
declare function rollupPluginNodeResolve(options?: Options): Plugin;
declare namespace rollupPluginNodeResolve { }
export = rollupPluginNodeResolve;
