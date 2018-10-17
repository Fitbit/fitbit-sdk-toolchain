declare namespace rollupPluginUtils {
  type Filter = string | string[] | RegExp | RegExp[];
  function createFilter(include: Filter, exclude: Filter): (id: string) => boolean;
}
export = rollupPluginUtils;
