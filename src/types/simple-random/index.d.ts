interface Options {
    secure?: boolean;
    chars?: string;
    length?: number;
}
declare function simpleRandom(options?: Options): string;
declare namespace simpleRandom {
    export const isSecureSupported: boolean;
}
export = simpleRandom;
