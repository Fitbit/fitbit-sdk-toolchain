import ErrorSubclass from 'error-subclass';

import { Diagnostic, DiagnosticCategory } from '../diagnostics';

export default class BuildError extends ErrorSubclass {
    static displayName: string = 'BuildError';

    static is(error: Error): error is BuildError {
        return error instanceof BuildError;
    }

    toDiagnostic(): Diagnostic {
        return {
            category: DiagnosticCategory.Error,
            messageText: this.message,
        };
    }
}
