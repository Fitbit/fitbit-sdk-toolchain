import * as stream from 'stream';

declare class DropStream extends stream.Transform {
    static obj(options?: stream.TransformOptions): DropStream;
}

export = DropStream;
