import { ExistingRawSourceMap } from 'rollup';

interface MangleOptions {
  toplevel?: boolean;
}

interface OutputOptions {
  semicolons?: boolean;
}

export interface TerserOptions {
  ecma?: 5 | 6 | 7 | 8;
  compress?: Record<string, unknown> | false;
  mangle?: MangleOptions | false;
  output?: OutputOptions;
  safari10?: boolean;
  sourceMap?: boolean;
}

interface TerserResult {
  code: string;
  map: ExistingRawSourceMap;
}

export function minify(code: string, options?: TerserOptions): TerserResult;
