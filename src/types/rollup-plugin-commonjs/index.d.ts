import { Plugin } from 'rollup';

interface Options {
    ignore?: string[];
    include?: string[];
}
declare function rollupPluginCommonjs(options?: Options): Plugin;
declare namespace rollupPluginCommonjs {

}
export = rollupPluginCommonjs;
