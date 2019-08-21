import stream from 'stream';

import Vinyl from 'vinyl';

export default function getFilesFromStream(
  stream: stream.Readable,
  numFiles = 1,
) {
  const files: Vinyl[] = [];
  return new Promise<Vinyl[]>((resolve, reject) => {
    stream.on('data', (file: Vinyl) => {
      if (file.contents) {
        files.push(file);
        if (files.length === numFiles) resolve(files);
      }
    });
    stream.on('finish', () => reject(new Error('No file in stream matched')));
    stream.on('error', reject);
  });
}
