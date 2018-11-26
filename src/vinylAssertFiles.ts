import path from 'path';
import stream from 'stream';

import humanizeList from 'humanize-list';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';
import { NextTransformCallback } from './appPackageManifest';

const PLUGIN_NAME = 'vinyl-assert-files';

export default function vinylAssertFiles(expected: string[]): stream.Transform {
    const expectedPaths = new Set(expected.map(path.normalize));
    return new stream.Transform({
        objectMode: true,
        // tslint:disable-next-line:no-any
        transform(this: stream.Transform, file: Vinyl, underscore: unknown, callback: NextTransformCallback): void {
            if (!file.isNull()) {
                expectedPaths.delete(file.relative);
            }
            callback(undefined, file);
        },
        flush(this: stream.Transform, callback: NextTransformCallback): void {
            if (expectedPaths.size !== 0) {
                // tslint:disable-next-line:no-invalid-this
                this.emit(
                    'error',
                    new PluginError(
                        PLUGIN_NAME,
                        `One or more required files do not exist in the project: ${humanizeList([...expectedPaths])}`
                    )
                );
            }
            callback();
        },
    });
}
