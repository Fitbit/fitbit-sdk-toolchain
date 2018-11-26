import { Plugin } from 'rollup';
import { TransformOptions } from 'babel-core';

interface Options extends TransformOptions {
    include?: string[];
    exclude?: string[];
    externalHelpers?: boolean;
    externalHelpersWhitelist?: string[];
    extensions?: string[];
}
declare function rollupPluginBabel(options?: Options): Plugin;
declare namespace rollupPluginBabel {

}
export = rollupPluginBabel;
