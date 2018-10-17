import path from 'path';

import ts from 'typescript';

/**
 * Load the base tsconfig directly so that a globally installed (or
 * `yarn link`ed) toolchain will succeed in building a project.
 */
const configPath = path.join(__dirname, '..', '..', '..', 'sdk-tsconfig.json');

const result = ts.readConfigFile(configPath, ts.sys.readFile);
if (result.error) {
  throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
}

export default result.config;
