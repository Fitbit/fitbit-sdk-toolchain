declare namespace rollupPluginUtils {
  type Filter = string | string[] | RegExp | RegExp[];
  function createFilter(
    include: Filter,
    exclude: Filter,
  ): (id: string) => boolean;

  interface DataToEsmOptions {
    compact?: boolean;
    indent?: string;
    preferConst?: boolean;
    objectShorthand?: boolean;
    namedExports?: boolean;
  }

  function dataToEsm(data: any, options?: DataToEsmOptions): string;
}
export = rollupPluginUtils;
