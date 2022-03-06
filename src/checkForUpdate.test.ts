import chalk from 'chalk';

import checkForUpdate from './checkForUpdate';

let consoleSpy: jest.SpyInstance;
let mockUpdateNotifier: jest.Mock;

beforeEach(() => {
  consoleSpy = jest.spyOn(global.console, 'log');
  mockUpdateNotifier = jest.fn();
});

it('outputs a red update prompt if there is a new patch update', () => {
  mockUpdateNotifier.mockReturnValueOnce({
    update: {
      name: '@fitbit/sdk',
      current: '0.0.1',
      latest: '0.0.9',
      type: 'patch',
    },
  });

  checkForUpdate(mockUpdateNotifier);

  const expectedMessage = '@fitbit/sdk update available 0.0.1 → 0.0.9';
  expect(consoleSpy).toBeCalledWith(chalk.red(expectedMessage));
});

it('outputs an orange warning prompt if there is a new non-patch update', () => {
  mockUpdateNotifier.mockReturnValueOnce({
    update: {
      name: '@fitbit/sdk',
      current: '0.0.1',
      latest: '1.0.0',
      type: 'major',
    },
  });

  checkForUpdate(mockUpdateNotifier);

  const expectedMessage =
    "You're targeting an older version of the Fitbit SDK. Consider updating to access new features.";
  expect(consoleSpy).toBeCalledWith(chalk.keyword('orange')(expectedMessage));
});

it('does not output a console message if there is no new update', () => {
  mockUpdateNotifier.mockReturnValueOnce({});

  checkForUpdate(mockUpdateNotifier);
  expect(consoleSpy).not.toBeCalled();
});
