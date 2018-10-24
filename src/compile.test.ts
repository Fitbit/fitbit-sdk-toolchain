import stream from 'stream';
import path from 'path';

import { SourceMapConsumer } from 'source-map';
import ts from 'typescript';

import compile from './compile';
import sdkVersion from './sdkVersion';
import getFileFromStream from './testUtils/getFileFromStream';
import getVinylContents from './testUtils/getVinylContents';

jest.mock('./sdkVersion');

expect.addSnapshotSerializer({
  test: val => typeof val === 'string' && val.includes(process.cwd()),
  print: val => val.replace(process.cwd(), '<cwd>'),
});

let mockDiagnosticHandler: jest.Mock;
const mockSDKVersion = sdkVersion as jest.Mock;

beforeEach(() => {
  mockDiagnosticHandler = jest.fn();
  mockSDKVersion.mockReturnValue({ major: 2, minor: 0 });

  // We don't want to load the actual tsconfig.json for this project
  // during unit tests. Using a real tsconfig.json located within
  // the test assets folder speeds up unit tests too, by restricting
  // tsc to compiling within this directory.
  jest.spyOn(ts, 'findConfigFile').mockReturnValue(
    testResourcePath('tsconfig.json'),
  );
});

function testResourcePath(...paths: string[]) {
  return path.resolve(__dirname, '__test__', 'compile', ...paths);
}

async function compileFile(
  filename: string,
  { allowUnknownExternals }: { allowUnknownExternals?: boolean } = {},
) {
  return getFileFromStream(compile(
    testResourcePath(filename),
    'output.js',
    {
      allowUnknownExternals,
      external: ['_mock_external_import_'],
      onDiagnostic: mockDiagnosticHandler,
    },
  )).then(getVinylContents);
}

// Build and assert correct output
it.each([
  ['building a minimal app', 'basic.js'],
  ['tslib when imported', 'providesTslib.js'],
  ['known external imports are used', 'knownExternalImport.js'],
  ['require calls are unmodified', 'require.js'],
  ['importing an image file', 'importImage.js'],
  ['compiles a JS file with tslib helpers inline', 'inlineHelpers.js'],
  ['compiles a JS file with tslib helpers imported', 'importHelpers.js'],
])(
  'build passes when %s',
  (_, filename) => expect(compileFile(filename)).resolves.toMatchSnapshot(),
);

// Just check build is successful
it.each([
  ['importing a package', 'importPackage.js'],
])(
  'build passes when %s',
  (_, filename) => expect(compileFile(filename)).resolves.toBeDefined(),
);

describe('when targeting SDK 1.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 1, minor: 0 }));

  it('allows JSON imports', () =>
    expect(compileFile('importJSON.js')).resolves.toMatchSnapshot());

  it('allows unintentionally non-relative imports', async () => {
    await expect(compileFile('incorrectlyNonRelativeImport.js')).resolves.toMatchSnapshot();
    expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
  });
});

describe('when targeting SDK 2.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 2, minor: 0 }));

  it('does not allow JSON imports', () =>
    expect(compileFile('importJSON.js')).rejects.toThrowErrorMatchingSnapshot());

  it('does not allow unintentionally non-relative imports', () =>
    expect(compileFile('incorrectlyNonRelativeImport.js')).rejects.toThrowError());
});

describe('when targeting SDK 3.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 3, minor: 0 }));

  it('emits ES6 code', () =>
    expect(compileFile('ES6.js')).resolves.toMatchSnapshot());

});

it.each([
  ['an unrecognized binary file is imported', 'importBinary.js'],
  ['a non-existent relative import is specified', 'relativeImportNotFound.js'],
  ['unknown external imports are used', 'unknownExternalImport.js'],
  ['an absolute import is specified', 'absoluteImport.js'],
])(
  'build fails when %s',
  (_, filename) => expect(compileFile(filename)).rejects.toThrowErrorMatchingSnapshot(),
);

it.each([
  ['JS code with bad syntax', 'badSyntax.js'],
  ['TS code with a type error', 'typeError.ts'],
])(
  'emits diagnostics given %s',
  async (_, filename) => {
    await expect(compileFile(filename)).rejects.toThrowError();
    expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
  },
);

describe('when compiling a module with statements above an import declaration', () => {
  let buildStream: stream.Readable;

  beforeEach(() => {
    buildStream = compile(
      testResourcePath('statementsBeforeImport.js'),
      'output.js',
      {
        external: ['_mock_external_import_'],
        onDiagnostic: mockDiagnosticHandler,
      },
    );
  });

  it('builds', () => expect(
    getFileFromStream(buildStream).then(getVinylContents),
  ).resolves.toMatchSnapshot());

  // Test for a regression (IPD-78696) that caused invalid sourcemaps to be produced
  it('emits a sourcemap with the first statement after the import correctly mapped', async () => {
    const file = await getFileFromStream(buildStream);
    const code = await getVinylContents(file);

    const bundleLines = code.split('\n');
    const marker = 'console.log';
    const logLine = bundleLines.findIndex(line => line.includes(marker));
    const logColumn = bundleLines[logLine].indexOf(marker);

    const map = await new SourceMapConsumer(file.sourceMap);
    expect(map.originalPositionFor({ line: logLine + 1, column: logColumn }))
      .toMatchObject({ line: 3, column: 0 });
  });
});

describe('when allowUnknownExternals is enabled', () => {
  it('successfully builds an app with unknown external imports', async () => {
    await expect(compileFile(
      'unknownExternalImport.js',
      { allowUnknownExternals: true },
    )).resolves.toMatchSnapshot();
    expect(mockDiagnosticHandler.mock.calls).toMatchSnapshot();
  });
});
