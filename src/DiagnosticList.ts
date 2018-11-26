import { Diagnostic, DiagnosticCategory } from './diagnostics';

export default class DiagnosticList {
    public fatalError: boolean;

    constructor(public diagnostics: Diagnostic[] = []) {
        this.fatalError = false;
        if (!Array.isArray(diagnostics)) {
            throw new TypeError(`diagnostics must be array, not ${typeof diagnostics}`);
        }
    }

    extend(otherDiagnosticList: DiagnosticList): void {
        // Add "target" and timestamp iff (if and only if) they don't already exist.
        this.diagnostics.push(...otherDiagnosticList.diagnostics);
        if (otherDiagnosticList.fatalError) {
            this.fatalError = true;
        }
    }

    push(diagnostic: Diagnostic): void {
        if (diagnostic.messageText === undefined || diagnostic.category === undefined) {
            throw new TypeError('Diagnostic is missing `messageText` or `category` keys');
        }
        this.diagnostics.push(diagnostic);
    }

    pushMessage(text: string): void {
        this.push({
            messageText: text,
            category: DiagnosticCategory.Message,
        });
    }

    pushWarning(text: string): void {
        this.push({
            messageText: text,
            category: DiagnosticCategory.Warning,
        });
    }

    pushError(text: string): void {
        this.push({
            messageText: text,
            category: DiagnosticCategory.Error,
        });
    }

    pushFatalError(text: string): void {
        this.pushError(text);
        this.fatalError = true;
    }
}
