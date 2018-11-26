import { MangleOptions } from 'uglify-js';

interface CompressOptions {}

interface MangleOptions {
    toplevel?: boolean;
}

interface OutputOptions {
    semicolons?: boolean;
}

export interface TerserOptions {
    ecma?: 5 | 6 | 7 | 8;
    compress?: CompressOptions | false;
    mangle?: MangleOptions | false;
    output?: OutputOptions;
}

interface TerserResult {}

export default function terser(options?: TerserOptions): TerserResult;
