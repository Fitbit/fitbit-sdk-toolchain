import { Readable } from 'stream';
import path from 'path';
import { readFileSync } from 'fs';

import Vinyl from 'vinyl';

import { DiagnosticHandler } from './diagnostics';
import ProjectConfiguration, { AppType } from './ProjectConfiguration';
import validateIcon from './validateIcon';
import PluginError from 'plugin-error';

const corruptImage = path.join(
  __dirname,
  '__test__',
  'PngSuite-2017jul19',
  'xs1n0g01.png',
);
const iconPath = 'resources/icon.png';

const projectConfig: ProjectConfiguration = {
  appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
  appDisplayName: 'My App',
  appType: AppType.APP,
  wipeColor: '#FFFFFF',
  iconFile: iconPath,
  i18n: {
    en: { name: 'My App' },
    fr: { name: 'Mon application' },
  },
  buildTargets: ['higgs'],
  requestedPermissions: ['permission'],
  defaultLanguage: 'en-US',
};

let mockDiagnosticHandler: jest.Mock;
let validateIconParams: {
  projectConfig: ProjectConfiguration;
  onDiagnostic: DiagnosticHandler;
};

beforeEach(() => {
  mockDiagnosticHandler = jest.fn();
  validateIconParams = {
    projectConfig,
    onDiagnostic: mockDiagnosticHandler,
  };
});

it('it returns a pass through if appType is CLOCKFACE', (done) => {
  expect.assertions(1);

  const file = new Vinyl({
    path: 'index.js',
    contents: Buffer.of(),
  });

  const handleData = jest.fn();
  const validator = validateIcon({
    projectConfig: {
      ...projectConfig,
      appType: AppType.CLOCKFACE,
    } as ProjectConfiguration,
    onDiagnostic: mockDiagnosticHandler,
  });

  validator
    .on('error', done.fail)
    .on('data', handleData)
    .on('end', () => {
      expect(handleData).toHaveBeenCalledWith(file);
      done();
    });

  validator.write(file);
  validator.end();
});

describe('in streaming mode', () => {
  it('throws an error as icon validation is not supported in streaming mode', (done) => {
    expect.assertions(4);
    const fileStream = new Readable({
      read() {
        done();
      },
    });
    fileStream.push('someIcon');

    const validator = validateIcon(validateIconParams);

    validator
      .on('data', (file: Vinyl) => {})
      .on('error', (error: PluginError) => {
        expect(error.fileName).toBe(path.join('resources', 'icon.png'));
        expect(error.message).toBe('Icon file is not a buffer');
        expect(error.name).toBe('Error');
        expect(error.plugin).toBe('validateIcon');
      })
      .end(
        new Vinyl({
          path: iconPath,
          contents: fileStream,
        }),
      );
  });
});

describe('in buffered mode', () => {
  it('passes through all files untouched', (done) => {
    const validIcon = path.join(__dirname, '__test__', '80x80.png');
    const files = [
      new Vinyl({
        path: 'index.js',
        contents: Buffer.of(),
      }),
      new Vinyl({
        path: 'directory.png',
        stat: {
          isDirectory: () => true,
        } as any,
      }),
      new Vinyl({
        path: 'resources/index.gui',
        contents: Buffer.of(),
      }),
      new Vinyl({
        path: iconPath,
        contents: readFileSync(validIcon),
      }),
    ];

    const handleData = jest.fn();

    const validator = validateIcon(validateIconParams);

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
    [
      'corrupt',
      readFileSync(corruptImage),
      {
        fileName: path.join('resources', 'icon.png'),
        message: 'Invalid file signature',
        name: 'Error',
        plugin: 'validateIcon',
      },
    ],
    [
      'an invalid width and height',
      readFileSync(path.join(__dirname, '__test__', 'tiny.png')),
      {
        fileName: path.join('resources', 'icon.png'),
        message: 'Icon was of invalid size, expected 80x80, got 2x2',
        name: 'Error',
        plugin: 'validateIcon',
      },
    ],
    [
      'an empty file',
      Buffer.of(),
      {
        fileName: path.join('resources', 'icon.png'),
        message: 'Unexpected end of input',
        name: 'Error',
        plugin: 'validateIcon',
      },
    ],
    [
      'truncated',
      Buffer.from('89504E470D0A1A0A', 'hex'),
      {
        fileName: path.join('resources', 'icon.png'),
        message: 'Unexpected end of input',
        name: 'Error',
        plugin: 'validateIcon',
      },
    ],
  ])('errors if the icon PNG is %s', (_, contents, expectedError, done) => {
    expect.assertions(4);

    const validator = validateIcon(validateIconParams);

    validator
      .on('error', (error: PluginError) => {
        expect(error.fileName).toBe(expectedError.fileName);
        expect(error.message).toBe(expectedError.message);
        expect(error.name).toBe(expectedError.name);
        expect(error.plugin).toBe(expectedError.plugin);
        done();
      })
      .on('data', () => done.fail('Got an unexpected file'));

    validator.write(
      new Vinyl({
        contents,
        path: iconPath,
      }),
    );
    validator.end();
  });

  it('logs a warning if the AppType is APP and no icon file exists', (done) => {
    expect.assertions(1);

    const validator = validateIcon(validateIconParams);

    validator
      .on('error', done.fail)
      .on('data', jest.fn())
      .on('end', () => {
        expect(mockDiagnosticHandler.mock.calls[0]).toEqual([
          {
            category: 0,
            messageText:
              'There is no app icon present in this project. To set an app icon, add a 80x80 PNG file named resources/icon.png to your project.',
          },
        ]);
        done();
      });

    validator.write(
      new Vinyl({
        path: 'index.js',
        contents: Buffer.of(),
      }),
    );
    validator.end();
  });
});
