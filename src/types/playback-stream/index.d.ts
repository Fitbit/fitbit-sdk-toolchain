import * as stream from 'stream';

declare class PlaybackStream extends stream.Transform {
    newReadableSide(opts?: stream.TransformOptions): stream.PassThrough;
}

export = PlaybackStream;
