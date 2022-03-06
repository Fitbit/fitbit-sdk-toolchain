import { readJSONSync } from 'fs-extra';
import path from 'path';

import chalk from 'chalk';
import { Settings, UpdateNotifier } from 'update-notifier';

type UpdateNotifierFunc = (settings?: Settings) => UpdateNotifier;

export default function checkForUpdate(updateNotifier: UpdateNotifierFunc) {
  const packageJSON = readJSONSync(path.join(__dirname, '../package.json'));

  const { update } = updateNotifier({ pkg: packageJSON });

  if (!update) return;

  if (update.type === 'patch') {
    const message = `${update.name} update available ${update.current} → ${update.latest}`;
    console.log(chalk.red(message));
  } else {
    const message =
      "You're targeting an older version of the Fitbit SDK. Consider updating to access new features.";
    console.log(chalk.keyword('orange')(message));
  }
}
