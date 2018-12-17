import { Readable } from 'stream';

import getFileFromStream from './getFileFromStream';
import getVinylContents from './getVinylContents';

export default function getJSONFileFromStream(
  stream: Readable,
  filename?: string,
) {
  return getFileFromStream(stream, filename)
    .then(getVinylContents)
    .then(JSON.parse);
}
