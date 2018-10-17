export function normalizeToPOSIX(fileName: string) {
  return fileName.split('\\').join('/');
}
