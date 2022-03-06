import ts from 'typescript';
import lodash from 'lodash';

import { normalizeToPOSIX } from '../../pathUtils';

export default class LanguageServiceHost implements ts.LanguageServiceHost {
  private cwd = process.cwd();
  private snapshots: { [fileName: string]: ts.IScriptSnapshot } = {};
  private versions: { [fileName: string]: number } = {};
  private fileNames: Set<string>;

  constructor(private parsedConfig: ts.ParsedCommandLine) {
    this.fileNames = new Set(parsedConfig.fileNames);
  }

  public setSnapshot(fileName: string, data: string) {
    const normalizedFileName = normalizeToPOSIX(fileName);

    const snapshot = ts.ScriptSnapshot.fromString(data);
    this.snapshots[normalizedFileName] = snapshot;
    this.versions[normalizedFileName] =
      (this.versions[normalizedFileName] || 0) + 1;
    this.fileNames.add(normalizedFileName);
    return snapshot;
  }

  public getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    const normalizedFileName = normalizeToPOSIX(fileName);

    if (lodash.has(this.snapshots, normalizedFileName)) {
      return this.snapshots[normalizedFileName];
    }

    if (ts.sys.fileExists(normalizedFileName)) {
      const normalizedFileContent = ts.sys.readFile(normalizedFileName);
      if (typeof normalizedFileContent !== 'string') {
        throw new TypeError();
      }

      this.snapshots[normalizedFileName] = ts.ScriptSnapshot.fromString(
        normalizedFileContent,
      );
      this.versions[normalizedFileName] =
        (this.versions[normalizedFileName] || 0) + 1;
      return this.snapshots[normalizedFileName];
    }

    return undefined;
  }

  public getCurrentDirectory() {
    return this.cwd;
  }

  public getScriptVersion(fileName: string) {
    const normalizedFileName = normalizeToPOSIX(fileName);
    return (this.versions[normalizedFileName] || 0).toString();
  }

  public getScriptFileNames() {
    return Array.from(this.fileNames.values());
  }

  public getCompilationSettings() {
    return this.parsedConfig.options;
  }

  public getDefaultLibFileName(opts: ts.CompilerOptions) {
    // Webpack constant-folds (__dirname === '/') to (false) even when
    // __dirname does get substituted with '/' at runtime. The odd
    // condition is intended to defeat this (buggy?) behaviour.
    if (__dirname.length === 1) {
      // We've been Webpacked with node.__dirname = "mock".
      // getDefaultLibFilePath() is going to return a completely bogus
      // value ('//lib.d.ts') so we can't use that. Use an arbitrary
      // hardcoded path and expect the BrowserFS to be initialized
      // with the files already in the right place before starting a
      // build.
      //
      // The toolchain is "installed globally" in the browser so it does
      // not make a lot of sense to expect to find the lib files in the
      // project's node_modules. And it does not seem right to clutter
      // the root of the file system with the files either.
      return '/_typescript/' + ts.getDefaultLibFileName(opts);
    }
    return ts.getDefaultLibFilePath(opts);
  }

  public useCaseSensitiveFileNames() {
    return ts.sys.useCaseSensitiveFileNames;
  }

  public readDirectory(
    path: string,
    extensions?: string[],
    exclude?: string[],
    include?: string[],
  ) {
    return ts.sys.readDirectory(path, extensions, exclude, include);
  }

  public readFile(path: string, encoding?: string) {
    return ts.sys.readFile(path, encoding);
  }

  public fileExists(path: string) {
    return ts.sys.fileExists(path);
  }

  public getTypeRootsVersion() {
    return 0;
  }

  public directoryExists(directoryName: string) {
    return ts.sys.directoryExists(directoryName);
  }

  public getDirectories(directoryName: string) {
    return ts.sys.getDirectories(directoryName);
  }
}
