import { Readable } from 'stream';
import { join } from 'path';
import { readFileSync } from 'fs';

import Vinyl from 'vinyl';

import { DiagnosticHandler } from './diagnostics';
import ProjectConfiguration, { AppType } from './ProjectConfiguration';
import validateIcon from './validateIcon';

const corruptImage = join(
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
  buildTargets: ['hera'],
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
    .on('error', done)
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
    expect.assertions(1);
    const fileStream = new Readable({
      read() {
        done();
      },
    });
    fileStream.push('someIcon');

    const validator = validateIcon(validateIconParams);

    validator
      .on('data', (file: Vinyl) => {})
      .on('error', (error) => expect(error).toMatchSnapshot())
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
    const validIcon = join(__dirname, '__test__', '80x80.png');
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
        path: 'resources/index.view',
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
      .on('error', done)
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
    ['corrupt', readFileSync(corruptImage)],
    [
      'an invalid width and height',
      readFileSync(join(__dirname, '__test__', 'tiny.png')),
    ],
    ['an empty file', Buffer.of()],
    ['truncated', Buffer.from('89504E470D0A1A0A', 'hex')],
  ])('errors if the icon PNG is %s', (_, contents, done) => {
    expect.assertions(1);

    const validator = validateIcon(validateIconParams);

    validator
      .on('error', (error) => {
        expect(error).toMatchSnapshot();
        done();
      })
      .on('data', () => done('Got an unexpected file'));

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
      .on('error', done)
      .on('data', jest.fn())
      .on('end', () => {
        expect(mockDiagnosticHandler.mock.calls[0]).toMatchSnapshot();
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
