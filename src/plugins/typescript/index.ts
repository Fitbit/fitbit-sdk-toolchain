import { Plugin } from 'rollup';
import { createFilter } from '@rollup/pluginutils';
import ts from 'typescript';

import LanguageServiceHost from './LanguageServiceHost';
import { normalizeToPOSIX } from '../../pathUtils';
import { parseTsConfig } from './parse-tsconfig';
import { default as tslib } from './tslib.const';

import { Diagnostic, DiagnosticMessage } from '../../diagnostics';

type Filter = RegExp | RegExp[];

interface IOptions {
  include: Filter;
  exclude: Filter;
  tsconfig?: string;
  tsconfigOverride?: ts.CompilerOptions;
  tsconfigSearchPath?: string;
  onDiagnostic: (diagnostic: Diagnostic) => void;
}

const formatTSDiagMessage = (tsDiagnostic: {
  code: number;
  messageText: string;
}) => `TS${tsDiagnostic.code}: ${tsDiagnostic.messageText}`;

const generateMessage = (tsDiagnostic: ts.Diagnostic) => {
  if (typeof tsDiagnostic.messageText === 'string') {
    return formatTSDiagMessage({
      code: tsDiagnostic.code,
      messageText: tsDiagnostic.messageText,
    });
  }
  const messages: DiagnosticMessage[] = [];

  function convertMessageChain(tsChains: ts.DiagnosticMessageChain[]) {
    for (const tsChain of tsChains) {
      messages.push({
        messageText: formatTSDiagMessage(tsChain),
        category: tsChain.category,
      });
      if (tsChain.next) convertMessageChain(tsChain.next);
    }
  }

  convertMessageChain([tsDiagnostic.messageText]);

  return messages;
};

export default function typescript(options?: Partial<IOptions>): Plugin {
  const pluginOptions: IOptions = {
    // Defined as a regex to avoid buggy scoping where regex special chars in CWD
    // are incorrectly considered as part of the match pattern.
    // https://github.com/rollup/rollup-pluginutils/issues/39
    include: /\.[tj]sx?$/,
    exclude: [/\.d\.ts$/, /\/node_modules\//],
    tsconfig: undefined,
    tsconfigOverride: undefined,
    onDiagnostic: () => {
      return;
    },
    ...options,
  };

  let filter: (id: string) => boolean;
  let parsedConfig: ts.ParsedCommandLine;
  let service: ts.LanguageService;

  function emitDiagnostics(diagnostics: ts.Diagnostic[]) {
    for (const tsDiagnostic of diagnostics) {
      const diagnostic: Diagnostic = {
        category: tsDiagnostic.category,
        messageText: generateMessage(tsDiagnostic),
      };
      if (tsDiagnostic.file) {
        diagnostic.file = {
          path: tsDiagnostic.file.fileName,
        };
        if (
          tsDiagnostic.start !== undefined &&
          tsDiagnostic.length !== undefined
        ) {
          diagnostic.file.position = {
            start: tsDiagnostic.file.getLineAndCharacterOfPosition(
              tsDiagnostic.start,
            ),
            end: tsDiagnostic.file.getLineAndCharacterOfPosition(
              tsDiagnostic.start + tsDiagnostic.length,
            ),
          };
        }
      }

      pluginOptions.onDiagnostic(diagnostic);
    }
  }

  return {
    name: 'rollup-typescript',

    options() {
      parsedConfig = parseTsConfig(
        pluginOptions.tsconfig,
        pluginOptions.tsconfigOverride,
        emitDiagnostics,
        pluginOptions.tsconfigSearchPath,
      );
      filter = createFilter(pluginOptions.include, pluginOptions.exclude);

      service = ts.createLanguageService(
        new LanguageServiceHost(parsedConfig),
        ts.createDocumentRegistry(),
      );

      emitDiagnostics(service.getCompilerOptionsDiagnostics());

      return null;
    },

    resolveId(importee, importer) {
      if (importee === 'tslib') return tslib.sentinel;
      if (!importer) return;

      const result = ts.nodeModuleNameResolver(
        importee,
        normalizeToPOSIX(importer),
        parsedConfig.options,
        ts.sys,
      );

      if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
        if (result.resolvedModule.resolvedFileName.endsWith('.d.ts')) {
          return;
        }
        return result.resolvedModule.resolvedFileName;
      }
    },

    load(id) {
      /**
       * We treat tslib specially so that we are not dependent on
       * @rollup/plugin-node-resolve to load tslib. Even if that plugin
       * is present, we cannot rely on it to resolve tslib: the tslib
       * package is a dependency of the package containing this plugin,
       * not the project being built. The user's package manager could
       * install tslib to node_modules/@fitbit/sdk/node_modules/tslib,
       * which is outside of the module search path for the modules
       * being built. To ensure that tslib is always resolvable
       * regardless of the rollup plugins used and the node_modules
       * deduping and hoisting behaviour of whichever package manager
       * the user happens to use, we resolve that module ourselves.
       */
      if (id === tslib.sentinel) return tslib.source;
      return null;
    },

    transform(code, id) {
      if (!filter(id)) return undefined;

      const output = service.getEmitOutput(id);

      emitDiagnostics(service.getSyntacticDiagnostics(id));
      emitDiagnostics(service.getSemanticDiagnostics(id));
      if (output.emitSkipped) this.error(`Failed to compile ${id}`);

      return {
        code: output.outputFiles.filter((e) => e.name.endsWith('.js'))[0].text,
        map: output.outputFiles.filter((e) => e.name.endsWith('.map'))[0].text,
      };
    },
  };
}
