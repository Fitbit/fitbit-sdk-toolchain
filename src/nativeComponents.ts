import fs from 'fs';
import stream from 'stream';

import elfy from 'elfy';
import lodash from 'lodash';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

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
    data: elfData,
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
  const components = componentPaths.map(readMetadata);
  const buildId = components[0].buildID;

  // Assert that all app IDs of native components match
  const divergentAppIDComponents = components.filter(
    c => c.appID.toLowerCase() !== appID.toLowerCase(),
  );
  if (divergentAppIDComponents.length > 0) {
    throw new PluginError(
      PLUGIN_NAME,
      `App IDs of native components do not match package.json.
    Expected appID ${appID}.
    ${divergentAppIDComponents.map(
        ({ path, family, appID }) => `${path} (${family}) has appID ${appID}`).join('\n  ')}`,
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

  const componentStream = new stream.PassThrough({ objectMode: true });
  components.forEach(({ path, family, platform, data }) => componentStream.push(
    new Vinyl({
      data,
      path,
      componentBundle: { family, type: 'device', platform: [platform], isNative: true },
    }),
  ));
  componentStream.push(null);

  return {
    buildId,
    nativeAppComponents: componentStream,
  };
}
