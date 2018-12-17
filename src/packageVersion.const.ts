import path from 'path';

import fsExtra from 'fs-extra';

const packageJSON = fsExtra.readJSONSync(
  path.join(__dirname, '../package.json'),
);
const version: string = packageJSON.version;

export default version;
