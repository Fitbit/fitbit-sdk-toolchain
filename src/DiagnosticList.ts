import { Diagnostic, DiagnosticCategory } from './diagnostics';

export default class DiagnosticList {
  fatalError = false;

  constructor(public diagnostics = [] as Diagnostic[]) {
    if (!Array.isArray(diagnostics)) {
      throw new TypeError(
        `diagnostics must be array, not ${typeof diagnostics}`,
      );
    }
  }

  extend(otherDiagnosticList: DiagnosticList) {
    // Add "target" and timestamp iff (if and only if) they don't already exist.
    this.diagnostics.push(...otherDiagnosticList.diagnostics);
    if (otherDiagnosticList.fatalError) this.fatalError = true;
  }

  push(diagnostic: Diagnostic) {
    if (
      diagnostic.messageText === undefined ||
      diagnostic.category === undefined
    ) {
      throw new TypeError(
        'Diagnostic is missing `messageText` or `category` keys',
      );
    }
    this.diagnostics.push(diagnostic);
  }

  pushMessage(text: string) {
    this.push({
      messageText: text,
      category: DiagnosticCategory.Message,
    });
  }

  pushWarning(text: string) {
    this.push({
      messageText: text,
      category: DiagnosticCategory.Warning,
    });
  }

  pushError(text: string) {
    this.push({
      messageText: text,
      category: DiagnosticCategory.Error,
    });
  }

  pushFatalError(text: string) {
    this.pushError(text);
    this.fatalError = true;
  }
}
