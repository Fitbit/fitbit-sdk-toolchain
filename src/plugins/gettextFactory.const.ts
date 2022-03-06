import fs from 'fs';
import gettextFactoryPackage from '@fitbit-sdk/companion-gettext/package.json';

const modulePath = require.resolve(
  `@fitbit-sdk/companion-gettext/${gettextFactoryPackage.module}`,
);

export default fs.readFileSync(modulePath, 'utf8');
