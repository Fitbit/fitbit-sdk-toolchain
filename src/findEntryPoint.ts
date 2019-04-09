import fs from 'fs';

import humanizeList from 'humanize-list';

import BuildError from './util/BuildError';
import { DiagnosticCategory, DiagnosticHandler } from './diagnostics';
import buildFilePath from './buildFilePath';

export default function findEntryPoint(
  rootPath: string | undefined,
  possibilities: string[],
  options: {
    notFoundIsFatal?: boolean;
    component: string;
    onDiagnostic: DiagnosticHandler;
  },
) {
  const { onDiagnostic, notFoundIsFatal, component } = {
    notFoundIsFatal: true,
    ...options,
  };

  const remappedPossibilities = possibilities.map((path) =>
    buildFilePath(rootPath, path),
  );

  const foundEntryPoints = remappedPossibilities.filter((path) => {
    return fs.existsSync(path);
  });

  let entryPoint;
  if (foundEntryPoints.length === 1) entryPoint = foundEntryPoints[0];
  else if (foundEntryPoints.length === 0) {
    const possibilitiesStr = humanizeList(remappedPossibilities, {
      conjunction: 'or',
    });
    if (notFoundIsFatal) {
      throw new BuildError(
        // tslint:disable-next-line:max-line-length
        `No ${component} entry point found! None of ${possibilitiesStr} are present in the project.`,
      );
    } else {
      onDiagnostic({
        category: DiagnosticCategory.Warning,
        // tslint:disable-next-line:max-line-length
        messageText: `This project is being built without a ${component} component. Create a file named ${possibilitiesStr} to add a ${component} component to your project.`,
      });
    }
  } else if (foundEntryPoints.length > 1) {
    throw new BuildError(
      // tslint:disable-next-line:max-line-length
      `Multiple ${component} entry points found! ${humanizeList(
        foundEntryPoints,
      )} are all valid entry points; rename all but one and try again.`,
    );
  }

  return entryPoint;
}
