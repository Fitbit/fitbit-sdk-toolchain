import nativeComponents from './nativeComponents';
import { join } from 'path';
import getFileFromStream from './testUtils/getFileFromStream';

/* The ELF files are created from a simple "Hello, world!" C object to
 * which we added the binary sections that we expect to read in the
 * nativeComponents.ts file.
 *
 * Example of adding section .appfamily to an object:
 * 1. write section contents to a binary file
 * e.g: a Python script:
 *    with open("family.bin","wb") as f:
 *       f.write("hera")
 * 2. add the section to the object
 * $  objcopy --add-section .appfamily=family.bin \
 *        --set-section-flags .appfamily=noload,readonly hello.o hello2.o
 */

const APP_UUID = 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1';
const WITH_API_VERS_ELF_NAME = 'with_c_api.elf';
const WITHOUT_API_VERS_ELF_NAME = 'without_c_api.elf';

it('native component with app api version', () => {
  const path = join(__dirname, '__test__', WITH_API_VERS_ELF_NAME);
  const result = nativeComponents(APP_UUID, [path]).existingDeviceComponents;
  return expect(getFileFromStream(result)).resolves.toMatchSnapshot();
});

it('native component without app api version', () => {
  const path = join(__dirname, '__test__', WITHOUT_API_VERS_ELF_NAME);
  const result = nativeComponents(APP_UUID, [path]).existingDeviceComponents;
  return expect(getFileFromStream(result)).resolves.toMatchSnapshot();
});
