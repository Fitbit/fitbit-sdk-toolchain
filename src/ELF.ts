import fs from 'fs';

import elfy from 'elfy';

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

  let appID = appIDData.toString('hex');
  // tslint:disable-next-line:max-line-length
  appID = `${appID.substr(0, 8)}-${appID.substr(8, 4)}-${appID.substr(12, 4)}-${appID.substr(16, 4)}-${appID.substr(20, 12)}`;

  return {
    appID,
    buildID: `0x${buildIDData.toString('hex')}`,
    family: familyData.toString(),
    platform: platformData.toString(),
  };
}
