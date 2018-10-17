import os from 'os';

import fsExtra from 'fs-extra';
import uuid from 'uuid';

import generateAppID from './generateAppID';

jest.mock('fs-extra');
jest.mock('uuid');

const CONFIG_PATH = 'package.json';
const MOCK_UUID = '8d8daf4a-6d92-4df7-a5d2-2655bc2eadae';

let configWriteSpy: jest.MockInstance<typeof fsExtra.writeJSONSync>;

function mockConfigContent(config: any) {
  jest.spyOn(fsExtra, 'readJSONSync').mockReturnValueOnce(config);
}

beforeEach(() => {
  configWriteSpy = jest.spyOn(fsExtra, 'writeJSONSync');
  jest.spyOn(uuid, 'v4').mockReturnValue(MOCK_UUID);
});

it('throws an error if package.json is not an object', () => {
  mockConfigContent('foo');
  expect(generateAppID).toThrowErrorMatchingSnapshot();
});

it('throws an error if package.json fitbit section is not an object', () => {
  mockConfigContent({ fitbit: false });
  expect(generateAppID).toThrowErrorMatchingSnapshot();
});

it.each([
  ['no fitbit key exists', {}],
  ['a fitbit key exists', { fitbit: {} }],
  ['an existing app ID is present', { fitbit: { appUUID: 'foo' } }],
])('writes a new UUID when %s', (_, configContent) => {
  mockConfigContent(configContent);
  generateAppID();
  expect(configWriteSpy).toBeCalledWith(
    CONFIG_PATH,
    expect.objectContaining({
      fitbit: {
        appUUID: MOCK_UUID,
      },
    }),
    {
      spaces: 2,
      EOL: os.EOL,
    },
  );
});
