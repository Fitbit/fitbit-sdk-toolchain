// DO NOT RENAME THIS FILE
// It is used by create-fitbit-app to scaffold a new project

import os from 'os';
import path from 'path';

import fsExtra from 'fs-extra';
import inquirer from 'inquirer';
import lodash from 'lodash';
import * as uuid from 'uuid';

import buildTargets from './buildTargets';
import {
  AppType,
  normalizeProjectConfig,
  validateDisplayName,
} from './ProjectConfiguration';

interface ProjectCreationArgs {
  appType: AppType;
  appDisplayName: string;
  withCompanion: boolean;
  withSettings: boolean;
  enabledBuildTargets: string[];
}

/**
 * Copies file/folders from the scaffold directory to the CWD.
 * @param scaffold: File/directory within the scaffold folder to be copied
 */
function scaffoldDirectory(scaffold: string) {
  const scaffoldPath = path.join(__dirname, '..', 'scaffold', scaffold);
  fsExtra.copySync(scaffoldPath, scaffold);
}

export default async function newProject() {
  const packageJSONPath = 'package.json';
  const packageJSON = fsExtra.readJSONSync(packageJSONPath);
  const config = normalizeProjectConfig(packageJSON);

  // Extract the member to a variable so that type guards work properly.
  const packageName = packageJSON.name;

  const defaultDisplayName =
    typeof packageName === 'string' ? lodash.startCase(packageName) : undefined;

  const {
    appType,
    appDisplayName,
    withCompanion,
    withSettings,
    enabledBuildTargets,
  }: ProjectCreationArgs = await inquirer.prompt<ProjectCreationArgs>([
    {
      name: 'appType',
      type: 'list',
      choices: Object.values(AppType),
      message: 'What type of application should be created?',
    },
    {
      name: 'appDisplayName',
      message: 'What should the name of this application be?',
      // Inquirer will not allow a default that fails validation
      // to be submited.
      default: defaultDisplayName,
      validate: validateDisplayName,
    },
    {
      name: 'withCompanion',
      type: 'confirm',
      message: 'Should this application contain a companion component?',
    },
    {
      name: 'withSettings',
      type: 'confirm',
      when: (args) => args.withCompanion,
      message: 'Should this application contain a settings component?',
    },
    {
      name: 'enabledBuildTargets',
      type: 'checkbox',
      choices: Object.keys(buildTargets).map((platform: string) => ({
        name: buildTargets[platform].displayName,
        value: platform,
      })),
      default: Object.keys(buildTargets),
      message: 'Which platforms should this application be built for?',
    },
  ]);

  console.log('Creating device component');
  scaffoldDirectory('app');
  scaffoldDirectory('resources');
  scaffoldDirectory('tsconfig.json');

  if (withCompanion) {
    console.log('Creating companion component');
    scaffoldDirectory('companion');
  }
  if (withSettings) {
    console.log('Creating settings component');
    scaffoldDirectory('settings');
  }

  packageJSON.fitbit = {
    ...config,
    appType,
    appDisplayName,
    appUUID: uuid.v4(),
    buildTargets: enabledBuildTargets,
    wipeColor: '#ffffff',
  };

  packageJSON.scripts = {
    build: 'fitbit-build',
    debug: 'fitbit',
  };

  fsExtra.writeJSONSync(packageJSONPath, packageJSON, {
    spaces: 2,
    EOL: os.EOL,
  });
}
