import { Readable } from 'stream';

import getFileFromStream from './getFileFromStream';
import getVinylContents from './getVinylContents';

// tslint:disable-next-line:no-any
export default function getJSONFileFromStream(stream: Readable, filename?: string): Promise<any> {
    return getFileFromStream(stream, filename)
        .then(getVinylContents)
        .then(JSON.parse);
}
