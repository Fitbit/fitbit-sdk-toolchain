import path from 'path';

export default function buildFilePath(
  rootPath: string | undefined,
  filePartialPath: string,
): string {
  const rootPathString = rootPath || '';
  const finalPath = path.join(rootPathString, filePartialPath);
  console.log(`-->>> in build file path ${finalPath}`);
  return finalPath;
}
