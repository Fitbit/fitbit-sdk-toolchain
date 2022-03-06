import fs from 'fs';

let source: string;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tslibPackage = require('tslib/package.json');
  const tslibPath = require.resolve(`tslib/${tslibPackage.module}`);
  source = fs.readFileSync(tslibPath, 'utf8');
} catch (e) {
  console.warn('Error loading tslib helper library.');
  throw e;
}

export default {
  source,
  sentinel: '\0tslib',
};
