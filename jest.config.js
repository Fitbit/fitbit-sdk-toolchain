'use strict';

module.exports = {
  rootDir: 'src',
  transform: {
    '^(?!.*\\.(d\\.ts)$).+\\.(js|ts)$': 'ts-jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|mjs)$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.test\\.ts$',
  coverageDirectory: '<rootDir>/../coverage',
  collectCoverageFrom: ['**/*.ts', '!**/*.d.ts'],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['./setupTests.ts'],
  snapshotSerializers: ['jest-serializer-path'],
};
