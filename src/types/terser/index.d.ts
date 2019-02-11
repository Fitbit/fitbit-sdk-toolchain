interface CompressOptions {}

interface MangleOptions {
  toplevel?: boolean;
}

interface OutputOptions {
  semicolons?: boolean;
}

export interface TerserOptions {
  // tslint:disable-next-line max-union-size
  ecma?: 5 | 6 | 7 | 8;
  compress?: CompressOptions | false;
  mangle?: MangleOptions | false;
  output?: OutputOptions;
  safari10?: boolean;
}

interface TerserResult {}

export default function terser(options?: TerserOptions): TerserResult;
