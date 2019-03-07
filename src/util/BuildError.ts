import {
  Diagnostic,
  DiagnosticCategory,
  DiagnosticTarget,
} from '../diagnostics';

export default class BuildError extends Error {
  target?: DiagnosticTarget;

  static is(error: Error): error is BuildError {
    return error instanceof BuildError;
  }

  toDiagnostic(): Diagnostic {
    return {
      category: DiagnosticCategory.Error,
      messageText: this.message,
      ...(this.target && { target: this.target }),
    };
  }
}
