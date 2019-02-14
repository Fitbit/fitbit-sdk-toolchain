import path from 'path';

import { SourceMapConsumer } from 'source-map';
import ts from 'typescript';
import Vinyl from 'vinyl';

import compile from './compile';
import sdkVersion from './sdkVersion';
import getFileFromStream from './testUtils/getFileFromStream';
import getVinylContents from './testUtils/getVinylContents';
import { ComponentType } from './componentTargets';

jest.mock('./sdkVersion');

expect.addSnapshotSerializer({
  test: (val) => typeof val === 'string' && val.includes(process.cwd()),
  print: (val) => val.replace(process.cwd(), '<cwd>'),
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
  jest
    .spyOn(ts, 'findConfigFile')
    .mockReturnValue(testResourcePath('tsconfig.json'));
});

function testResourcePath(...paths: string[]) {
  return path.resolve(__dirname, '__test__', 'compile', ...paths);
}

function compileFile(
  filename: string,
  {
    allowUnknownExternals = undefined as boolean | undefined,
    component = ComponentType.COMPANION,
    outputDir = undefined as string | undefined,
    polyfills = {},
  } = {},
  expectFilename?: string,
) {
  return getFileFromStream(
    compile({
      component,
      allowUnknownExternals,
      outputDir,
      polyfills,
      entryPoint: testResourcePath(filename),
      onDiagnostic: mockDiagnosticHandler,
      defaultLanguage: 'en-US',
    }),
    expectFilename,
  );
}

// Build and assert correct output
it.each([
  ['building a minimal app', 'basic.js'],
  ['tslib when imported', 'providesTslib.js'],
  ['known external imports are used', 'knownExternalImport.js'],
  ['require calls are unmodified', 'require.js'],
  ['compiles a JS file with tslib helpers inline', 'inlineHelpers.js'],
  ['compiles a JS file with tslib helpers imported', 'importHelpers.js'],
])('build passes when %s', (_, filename) =>
  expect(
    compileFile(filename).then(getVinylContents),
  ).resolves.toMatchSnapshot(),
);

it('emits files in a specified output directory', () =>
  expect(
    compileFile(
      'basic.js',
      { outputDir: 'some_directory' },
      'some_directory/basic.js',
    ),
  ).resolves.toBeDefined());

// Just check build is successful
it.each([['importing a package', 'importPackage.js']])(
  'build passes when %s',
  (_, filename) =>
    expect(compileFile(filename).then(getVinylContents)).resolves.toBeDefined(),
);

it('allows importing image files when building settings', () =>
  expect(
    compileFile('importImage.js', { component: ComponentType.SETTINGS }).then(
      getVinylContents,
    ),
  ).resolves.toMatchSnapshot());

describe('when targeting SDK 1.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 1, minor: 0 }));

  it('allows JSON imports', () =>
    expect(
      compileFile('importJSON.js').then(getVinylContents),
    ).resolves.toMatchSnapshot());

  it('allows unintentionally non-relative imports', async () => {
    await expect(
      compileFile('incorrectlyNonRelativeImport.js').then(getVinylContents),
    ).resolves.toMatchSnapshot();
    expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
  });

  it.each([ComponentType.DEVICE, ComponentType.COMPANION])(
    'allows importing image files when building %s',
    (component: ComponentType) =>
      expect(
        compileFile('importImage.js', { component }),
      ).resolves.toBeDefined(),
  );
});

describe('when targeting SDK 2.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 2, minor: 0 }));

  it('does not allow JSON imports', () =>
    expect(
      compileFile('importJSON.js').then(getVinylContents),
    ).rejects.toThrowErrorMatchingSnapshot());

  it('does not allow unintentionally non-relative imports', () =>
    expect(
      compileFile('incorrectlyNonRelativeImport.js').then(getVinylContents),
    ).rejects.toThrowError());

  it.each([ComponentType.DEVICE, ComponentType.COMPANION])(
    'allows importing image files when building %s',
    (component: ComponentType) =>
      expect(
        compileFile('importImage.js', { component }),
      ).resolves.toBeDefined(),
  );
});

describe('when targeting SDK 3.0', () => {
  beforeEach(() => mockSDKVersion.mockReturnValue({ major: 3, minor: 0 }));

  it('emits ES6 code', () =>
    expect(
      compileFile('ES6.js').then(getVinylContents),
    ).resolves.toMatchSnapshot());

  it('emits ES5 code for device', () =>
    expect(
      compileFile('ES6.js', { component: ComponentType.DEVICE }).then(
        getVinylContents,
      ),
    ).resolves.toMatchSnapshot());

  it.each([ComponentType.DEVICE, ComponentType.COMPANION])(
    'does not allow importing image files when building %s',
    (component: ComponentType) =>
      expect(
        compileFile('importImage.js', { component }),
      ).rejects.toBeDefined(),
  );
});

it.each([
  ['an unrecognized binary file is imported', 'importBinary.js'],
  ['a non-existent relative import is specified', 'relativeImportNotFound.js'],
  ['unknown external imports are used', 'unknownExternalImport.js'],
  ['an absolute import is specified', 'absoluteImport.js'],
])('build fails when %s', (_, filename) =>
  expect(compileFile(filename)).rejects.toThrowErrorMatchingSnapshot(),
);

it.each([
  ['JS code with bad syntax', 'badSyntax.js'],
  ['TS code with a type error', 'typeError.ts'],
])('emits diagnostics given %s', async (_, filename) => {
  await expect(compileFile(filename)).rejects.toThrowError();
  expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
});

describe('when compiling a module with statements above an import declaration', () => {
  let buildOutput: Promise<Vinyl>;

  beforeEach(() => {
    buildOutput = compileFile('statementsBeforeImport.js');
  });

  it('builds', () =>
    expect(buildOutput.then(getVinylContents)).resolves.toMatchSnapshot());

  // Test for a regression (IPD-78696) that caused invalid sourcemaps to be produced
  it('emits a sourcemap with the first statement after the import correctly mapped', async () => {
    const file = await buildOutput;
    const code = await getVinylContents(file);

    const bundleLines = code.split('\n');
    const marker = 'console.log';
    const logLine = bundleLines.findIndex((line) => line.includes(marker));
    const logColumn = bundleLines[logLine].indexOf(marker);

    const map = await new SourceMapConsumer(file.sourceMap);
    expect(
      map.originalPositionFor({ line: logLine + 1, column: logColumn }),
    ).toMatchObject({ line: 3, column: 0 });
  });
});

describe('when allowUnknownExternals is enabled', () => {
  it('successfully builds an app with unknown external imports', async () => {
    await expect(
      compileFile('unknownExternalImport.js', {
        allowUnknownExternals: true,
      }).then(getVinylContents),
    ).resolves.toMatchSnapshot();
    expect(mockDiagnosticHandler.mock.calls).toMatchSnapshot();
  });
});

describe('when building a device component which uses gettext', () => {
  let file: string;

  beforeEach(async () => {
    mockSDKVersion.mockReturnValue({ major: 3, minor: 0 });
    file = await compileFile('i18n.js', {
      component: ComponentType.DEVICE,
    }).then(getVinylContents);
  });

  it('polyfills gettext on device', () => expect(file).toMatchSnapshot());

  it('builds without diagnostic messages', () =>
    expect(mockDiagnosticHandler).not.toBeCalled());

  it('emits an error if targeting SDK version lower than 3.0', async () => {
    mockSDKVersion.mockReturnValue({ major: 2, minor: 0 });
    await expect(compileFile('i18n.js')).rejects.toThrowError();
    expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
  });
});

it('emits sourcemaps with source paths relative to the project root', async () => {
  const file = await compileFile('sourcemap/index.js', { outputDir: 'app' });
  expect(file.sourceMap.sources).toMatchSnapshot();
});

it('applies specified polyfills', () => {
  return expect(
    compileFile('polyfill.js', {
      polyfills: {
        cbor: "export * from 'cbor'; export const encode = false;",
      },
    }).then(getVinylContents),
  ).resolves.toMatchSnapshot();
});
