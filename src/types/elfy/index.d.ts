interface ELFSection {
    name: string;
    data: Buffer;
}

interface ELF {
    body: {
        sections: ELFSection[];
    };
}

declare namespace elfy {
    export function parse(elfData: Buffer): ELF;
}

export = elfy;
