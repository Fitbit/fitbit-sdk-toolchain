import fs from 'fs';

import elfy from 'elfy';

function formatUUID(uuid: string) {
  return[
    uuid.substr(0, 8),
    uuid.substr(8, 4),
    uuid.substr(12, 4),
    uuid.substr(16, 4),
    uuid.substr(20, 12),
  ].join('-');
}

export function readMetadata(elfPath: string) {
  const elfData = fs.readFileSync(elfPath);
  const elf = elfy.parse(elfData);

  function findSection(name: string) {
    const sections = elf.body.sections.filter(section => section.name === `.${name}`);
    if (sections.length === 0) {
      throw new Error(`ELF section '${name}' is missing`);
    }
    return sections[0];
  }

  const buildIDData = findSection('buildid').data;
  buildIDData.swap64();

  const appIDData = findSection('appuuid').data;
  const familyData = findSection('appfamily').data;
  const platformData = findSection('appplatform').data;

  return {
    appID: formatUUID(appIDData.toString('hex')),
    buildID: `0x${buildIDData.toString('hex')}`,
    family: familyData.toString(),
    platform: platformData.toString(),
  };
}
