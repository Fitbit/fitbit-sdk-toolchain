import fs from 'fs';
import stream from 'stream';

import elfy from 'elfy';
import lodash from 'lodash';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

const PLUGIN_NAME = 'nativeComponents';

function checkBufferLength(
  buffer: Buffer,
  expectedLength: number,
  name: string,
) {
  if (buffer.length !== expectedLength) {
    throw new PluginError(
      PLUGIN_NAME,
      `${name} must be ${expectedLength} bytes, found ${buffer.length} in ${buffer}`,
    );
  }
}

function formatUUID(buffer: Buffer) {
  const uuid = buffer.toString('hex');
  return [
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

  const elfSections = lodash.groupBy(elf.body.sections, (s) => s.name);

  function findSection(name: string) {
    const sectionName = `.${name}`;

    const sections = elfSections[sectionName];
    if (!sections) {
      throw new PluginError(PLUGIN_NAME, `ELF section '${name}' is missing`, {
        fileName: elfPath,
      });
    }

    if (sections.length > 1) {
      throw new PluginError(
        PLUGIN_NAME,
        `ELF section '${name}' is present more than once`,
        { fileName: elfPath },
      );
    }

    return sections[0].data;
  }

  const buildIDData = findSection('buildid');
  checkBufferLength(buildIDData, 8, 'Build ID');

  const appIDData = findSection('appuuid');
  checkBufferLength(appIDData, 16, 'App UUID');

  const platformJSON = findSection('appplatform').toString();

  let platform;
  try {
    platform = JSON.parse(platformJSON);
  } catch (ex) {
    throw new PluginError(
      PLUGIN_NAME,
      `Could not parse platform specification in .appplatform section: ${ex.message}`,
      { fileName: elfPath },
    );
  }

  if (!Array.isArray(platform)) {
    throw new PluginError(
      PLUGIN_NAME,
      `Platform specification should be an array, but found a ${typeof platform}`,
      { fileName: elfPath },
    );
  }

  return {
    platform,
    path: elfPath,
    data: elfData,
    appID: formatUUID(appIDData),
    buildID: `0x${Buffer.from(buildIDData)
      .swap64()
      .toString('hex')}`,
    family: findSection('appfamily').toString(),
  };
}

export default function nativeComponents(
  appID: string,
  componentPaths: string[],
) {
  const components = componentPaths.map(readMetadata);
  const buildId = components[0].buildID;

  // Check that all app IDs of native components match
  const divergentAppIDComponents = components.filter(
    (c) => c.appID.toLowerCase() !== appID.toLowerCase(),
  );
  if (divergentAppIDComponents.length > 0) {
    const divergentAppIDsList = divergentAppIDComponents
      .map(
        ({ path, family, appID }) => `${path} (${family}) has appID ${appID}`,
      )
      .join('\n    ');

    throw new PluginError(
      PLUGIN_NAME,
      `App IDs of native components do not match package.json.
    Expected appID ${appID}.
    ${divergentAppIDsList}`,
    );
  }

  // Check that all build IDs of native components match
  if (lodash.uniqBy(components, (c) => c.buildID).length > 1) {
    const mismatchedBuildIDs = components
      .map(
        ({ path, family, buildID }) =>
          `${path} (${family}) has buildID ${buildID}`,
      )
      .join('\n    ');

    throw new PluginError(
      PLUGIN_NAME,
      `Build IDs of native components do not match.
    ${mismatchedBuildIDs}`,
    );
  }

  const componentStream = new stream.PassThrough({ objectMode: true });
  components.forEach(({ family, platform, data }) =>
    componentStream.push(
      new Vinyl({
        contents: data,
        path: `${family}.bundle`,
        componentBundle: { family, platform, type: 'device', isNative: true },
      }),
    ),
  );
  componentStream.push(null);

  return {
    buildId,
    existingDeviceComponents: componentStream,
  };
}
