import Vinyl from 'vinyl';

import gulpMagicString from './gulpMagicString';
import getFileFromStream from './testUtils/getFileFromStream';

it('emits a valid sourcemap', async () => {
    const stream = gulpMagicString((code, magic) => magic.appendRight(code.length, ';'));

    const inputCode = 'console.log("hi!");\n';
    const inputPath = 'index.js';

    stream.write(
        new Vinyl({
            path: inputPath,
            contents: Buffer.from(inputCode),
            sourceMap: {
                version: 3,
                sources: [inputPath],
                names: ['console', 'log'],
                mappings: ';AAAAA,QAAAC,IAAY',
                file: inputPath,
                sourcesContent: [inputCode],
            },
        })
    );

    const { sourceMap } = await getFileFromStream(stream, inputPath);
    expect(sourceMap).toMatchSnapshot();
});
