import path from 'path';

import ts from 'typescript';

import defaultTSConfigConst from './defaultTSConfig.const';

function loadTsConfig(
  configPath?: string,
  onDiagnostics?: (diagnostics: ts.Diagnostic[]) => void,
) {
  // If no tsconfig.json exists, lie to the compiler and pretend they
  // have our default one that just extends for now.
  if (configPath === undefined) {
    return {
      loadedConfig: defaultTSConfigConst,
      configFileName: 'tsconfig.json',
      baseDir: process.cwd(),
    };
  }

  const result = ts.readConfigFile(configPath, ts.sys.readFile);
  if (result.error !== undefined) {
    if (onDiagnostics) onDiagnostics([result.error]);
    throw new Error(`Failed to parse ${configPath}`);
  }

  return {
    loadedConfig: result.config,
    configFileName: configPath,
    baseDir: path.dirname(configPath),
  };
}

export function parseTsConfig(
  tsConfig?: string,
  tsconfigOverride?: ts.CompilerOptions,
  onDiagnostics?: (diagnostics: ts.Diagnostic[]) => void,
): ts.ParsedCommandLine {
  const fileName = ts.findConfigFile(process.cwd(), ts.sys.fileExists, tsConfig);

  if (tsConfig !== undefined && !fileName) {
    throw new Error(`Failed to open ${fileName}`);
  }

  const { loadedConfig, configFileName, baseDir } = loadTsConfig(fileName, onDiagnostics);

  const result = ts.parseJsonConfigFileContent(
    loadedConfig,
    ts.sys,
    baseDir,
    tsconfigOverride,
    configFileName,
  );
  if (result.errors.length > 0) {
    if (onDiagnostics) onDiagnostics(result.errors);
    throw new Error('Failed to parse tsconfig');
  }
  return result;
}
