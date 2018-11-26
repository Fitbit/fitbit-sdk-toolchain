import { Transform } from 'stream';

import Vinyl from 'vinyl';
import { NextTransformCallback } from './appPackageManifest';

export default function gulpSetProperty(properties: {}): Transform {
    return new Transform({
        objectMode: true,
        transform(file: Vinyl, _: unknown, next: NextTransformCallback): void {
            if (!file.isNull()) {
                Object.assign(file, properties);
            }
            next(undefined, file);
        },
    });
}
