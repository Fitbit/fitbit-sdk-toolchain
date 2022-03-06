import { Readable } from 'stream';

import Vinyl from 'vinyl';

import { DiagnosticHandler } from './diagnostics';
import validateFileSizes from './validateFileSizes';

const TEST_FILENAME = 'test.bin';

const mockDiagnosticHandler = jest.fn();
let validateFileSizesParams: {
  maxSizes: Record<string, number>;
  onDiagnostic: DiagnosticHandler;
};

beforeEach(() => {
  validateFileSizesParams = {
    maxSizes: {
      [TEST_FILENAME]: 3 * 1024 * 1024,
    },
    onDiagnostic: mockDiagnosticHandler,
  };
});

describe('in streaming mode', () => {
  it('throws an error', (done) => {
    expect.assertions(1);
    const fileStream = new Readable({
      read() {
        done();
      },
    });
    // Node 8 will never fire the read above if there isn't
    // at least 1 byte pushed here
    fileStream.push(Buffer.alloc(1));

    const validator = validateFileSizes(validateFileSizesParams);

    validator
      .on('data', () => {
        return;
      })
      .on('error', (error) => expect(error).toMatchSnapshot())
      .end(
        new Vinyl({
          path: 'test.bin',
          contents: fileStream,
        }),
      );
  });
});

describe('in buffered mode', () => {
  it('passes through all files untouched', (done) => {
    const files = [
      new Vinyl({
        path: 'a.js',
        contents: Buffer.of(),
      }),
      new Vinyl({
        path: 'directory',
        stat: {
          isDirectory: () => true,
        } as any,
      }),
    ];

    const handleData = jest.fn();

    const validator = validateFileSizes(validateFileSizesParams);

    validator
      .on('error', done.fail)
      .on('data', handleData)
      .on('end', () => {
        expect(handleData).toHaveBeenCalledTimes(files.length);
        files.forEach((value, index) =>
          expect(handleData).toHaveBeenNthCalledWith(index + 1, value),
        );
        done();
      });

    files.forEach((file) => validator.write(file));
    validator.end();
  });

  // FIXME: Jest typings are broken and can't deal with the done callback parameter properly
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34617
  it.each<any>([
    ['one byte over the allowed size', 3 * 1024 * 1024 + 1],
    ['much larger than the allowed size', 10 * 1024 * 1024],
  ])('logs a warning if a file is %s', (_, fileSize, done) => {
    expect.assertions(1);

    const validator = validateFileSizes(validateFileSizesParams);

    validator
      .on('error', done.fail)
      .on('data', jest.fn())
      .on('end', () => {
        expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
        done();
      });

    validator.write(
      new Vinyl({
        path: TEST_FILENAME,
        contents: Buffer.alloc(fileSize),
      }),
    );
    validator.end();
  });
});
