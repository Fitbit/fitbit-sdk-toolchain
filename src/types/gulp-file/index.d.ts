import stream from 'stream';

declare function gulpFile(path: string, content: string): stream.Readable;
declare namespace gulpFile { }
export = gulpFile;
