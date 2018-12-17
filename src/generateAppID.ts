import os from 'os';

import fsExtra from 'fs-extra';
import lodash from 'lodash';
import uuid from 'uuid';

export default function generateAppID() {
  const configPath = 'package.json';
  const config = fsExtra.readJSONSync(configPath);
  if (!lodash.isPlainObject(config)) {
    throw new TypeError('Project configuration root must be an object');
  }

  if (config.fitbit === undefined) config.fitbit = {};

  if (!lodash.isPlainObject(config.fitbit)) {
    throw new TypeError(
      "Project configuration 'fitbit' property must be an object",
    );
  }

  config.fitbit.appUUID = uuid.v4();

  fsExtra.writeJSONSync(configPath, config, { spaces: 2, EOL: os.EOL });

  console.log(`Wrote new app ID: ${config.fitbit.appUUID}`);
}
