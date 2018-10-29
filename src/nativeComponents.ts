import fs from 'fs';

import elfy from 'elfy';
import lodash from 'lodash';
import PluginError from 'plugin-error';
import pumpify from 'pumpify';
import vinylFS from 'vinyl-fs';

import gulpSetProperty from './gulpSetProperty';

const PLUGIN_NAME = 'nativeComponents';

function formatUUID(uuid: string) {
  return[
    uuid.substr(0, 8),
    uuid.substr(8, 4),
    uuid.substr(12, 4),
    uuid.substr(16, 4),
    uuid.substr(20, 12),
  ].join('-');
}

function readMetadata(elfPath: string) {
  const elfData = fs.readFileSync(elfPath);
  const elf = elfy.parse(elfData);

  function findSection(name: string) {
    const sections = elf.body.sections.filter(section => section.name === `.${name}`);
    if (sections.length === 0) {
      throw new PluginError(PLUGIN_NAME, `ELF section '${name}' is missing`, { fileName: elfPath });
    }
    return sections[0];
  }

  const buildIDData = findSection('buildid').data;
  buildIDData.swap64();

  const appIDData = findSection('appuuid').data;
  const familyData = findSection('appfamily').data;
  const platformData = findSection('appplatform').data;

  return {
    path: elfPath,
    appID: formatUUID(appIDData.toString('hex')),
    buildID: `0x${buildIDData.toString('hex')}`,
    family: familyData.toString(),
    platform: platformData.toString(),
  };
}

export default function nativeComponents(
  appID: string,
  componentPaths: string[],
) {
  const components = componentPaths.map((componentPath) => {
    return {
      ...readMetadata(componentPath),
      path: componentPath,
    };
  });

  const buildId = components[0].buildID;

  // Assert that all app IDs of native components match
  if (lodash.uniqBy([...components, { appID }], c => c.appID).length > 1) {
    const appIDPairs = components.map(c => `${c.family} = ${c.appID}`).join('\n');
    throw new PluginError(
      PLUGIN_NAME,
      `App IDs of native components do not match package.json:\n${appIDPairs}`,
    );
  }

  // Assert that all build IDs of native components match
  if (lodash.uniqBy(components, c => c.buildID).length > 1) {
    const buildIDPairs = components.map(c => `${c.family}=${c.buildID}`);
    throw new PluginError(
      PLUGIN_NAME,
      `Build IDs of native components do not match: ${buildIDPairs}`,
    );
  }

  return {
    buildId,
    nativeAppComponents: components.map(
      ({ path, family, platform }) => new pumpify.obj(
        vinylFS.src(path),
        gulpSetProperty({
          componentBundle: {
            family,
            type: 'device',
            platform: [platform],
            isNative: true,
          },
        }),
      ),
    ),
  };
}
