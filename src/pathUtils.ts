export function normalizeToPOSIX(fileName: string): string {
    return fileName.split('\\').join('/');
}
