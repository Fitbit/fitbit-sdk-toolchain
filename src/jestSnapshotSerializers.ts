export const normalizeSlash = (val: string) => val.replace(/[\\]/g, '/');

const normalizedCwd = normalizeSlash(process.cwd());
export const cwdSerializer: jest.SnapshotSerializerPlugin = {
  test: (val) =>
    typeof val === 'string' && normalizeSlash(val).includes(normalizedCwd),
  print: (val) => normalizeSlash(val).replace(normalizedCwd, '<cwd>'),
};
