export function dirname(path) {
  let dir = path.split('/').slice(0, -1).join('/');
  if (dir === '') dir = '/';
  return dir;
}

export function basename(path) {
  return path.replace(/\\/g, '/').replace(/.*\//, '');
}

export function split(path) {
  return [dirname(path), basename(path)];
}
