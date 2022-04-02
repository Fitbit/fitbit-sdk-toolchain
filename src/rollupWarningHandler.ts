import { relative } from 'path';

import { RollupWarning, WarningHandler } from 'rollup';

import {
  DiagnosticCategory,
  DiagnosticMessage,
  logDiagnosticToConsole,
} from './diagnostics';

export type CodeCategoryMap = { [code: string]: DiagnosticCategory | false };

const defaultCodeCategories: CodeCategoryMap = {
  EMPTY_BUNDLE: DiagnosticCategory.Error,
  MISSING_EXPORT: DiagnosticCategory.Error,
  NAMESPACE_CONFLICT: DiagnosticCategory.Error,
  // TypeScript emits `var _this = this;` at the top level for
  // transpiled fat-arrow functions. Filter out the noise so as not to
  // confuse users with a warning that they can't do anything about.
  THIS_IS_UNDEFINED: false,
  UNRESOLVED_IMPORT: DiagnosticCategory.Error,
};

const messageFormatter: { [code: string]: (w: RollupWarning) => string } = {
  UNRESOLVED_IMPORT: (w) =>
    `${w.source} is imported by ${w.importer}, but could not be resolved`,
};

function relativeId(id: string) {
  if (
    typeof process === 'undefined' ||
    !/^(?:\/|(?:[A-Za-z]:)?[\\|/])/.test(id)
  ) {
    return id;
  }
  return relative(process.cwd(), id);
}

function defaultFormatter(w: RollupWarning) {
  return w.loc && w.loc.file
    ? `${relativeId(w.loc.file)} (${w.loc.line}:${w.loc.column}) ${w.message}`
    : w.message;
}

const rollupWarningToDiagnostic =
  (codeCategories: CodeCategoryMap) => (warning: RollupWarning | string) => {
    if (typeof warning === 'string') {
      return {
        category: DiagnosticCategory.Warning,
        messageText: warning,
      };
    }

    const { code } = warning;

    let category = DiagnosticCategory.Warning;
    if (code) {
      const codeCategory = codeCategories[code];
      if (codeCategory === false) {
        // Suppress the diagnostic message
        return;
      }
      if (codeCategory !== undefined) category = codeCategory;
    }

    let formatter = defaultFormatter;
    if (code && messageFormatter[code]) formatter = messageFormatter[code];

    let messageText: string | DiagnosticMessage[] = formatter(warning);
    if (warning.frame) {
      const context = {
        messageText: warning.frame,
        category: DiagnosticCategory.Message,
      };
      messageText = [{ messageText, category }, context];
    }

    return { messageText, category };
  };

export default function rollupWarningHandler({
  codeCategories = {} as CodeCategoryMap,
  onDiagnostic = logDiagnosticToConsole,
}): WarningHandler {
  const toDiagnostic = rollupWarningToDiagnostic({
    ...defaultCodeCategories,
    ...codeCategories,
  });

  return (w: RollupWarning | string) => {
    const diagnostic = toDiagnostic(w);
    if (!diagnostic) return;
    onDiagnostic(diagnostic);
    if (diagnostic.category === DiagnosticCategory.Error) {
      throw new Error('Compile failed.');
    }
  };
}
