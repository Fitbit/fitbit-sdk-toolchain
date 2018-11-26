import { DiagnosticCategory, Diagnostic } from './diagnostics';
import DiagnosticList from './DiagnosticList';

it('pushes a message to the diagnostic list', () => {
    const list = new DiagnosticList();
    list.pushMessage('I am a message');
    expect(list.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'I am a message',
            category: DiagnosticCategory.Message,
        }),
    ]);
    expect(list.fatalError).toEqual(false);
});

it('pushes a warning to the diagnostic list', () => {
    const list = new DiagnosticList();
    list.pushWarning('I am a warning');
    expect(list.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'I am a warning',
            category: DiagnosticCategory.Warning,
        }),
    ]);
    expect(list.fatalError).toEqual(false);
});

it('pushes an error to the diagnostic list', () => {
    const list = new DiagnosticList();
    list.pushError('I am error');
    expect(list.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'I am error',
            category: DiagnosticCategory.Error,
        }),
    ]);
    expect(list.fatalError).toEqual(false);
});

it('pushes a fatal error to the diagnostic list', () => {
    const list = new DiagnosticList();
    list.pushFatalError('I ded');
    expect(list.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'I ded',
            category: DiagnosticCategory.Error,
        }),
    ]);
    expect(list.fatalError).toEqual(true);
});

it('pushes a Diagnostic directly to the list', () => {
    const list = new DiagnosticList();
    const diagnostic = {
        messageText: 'Message text',
        category: DiagnosticCategory.Warning,
    };
    list.push(diagnostic);
    expect(list.diagnostics).toEqual([expect.objectContaining(diagnostic)]);
});

it('tries to push a diagnostic to the list without category', () => {
    const list = new DiagnosticList();
    function tryPushBadMessage(): void {
        list.push({ messageText: 'Message!' } as Diagnostic);
    }
    expect(tryPushBadMessage).toThrowErrorMatchingSnapshot();
});

it('tries to push a diagnostic to the list without messageText', () => {
    const list = new DiagnosticList();
    function tryPushBadMessage(): void {
        list.push({ category: DiagnosticCategory.Error } as Diagnostic);
    }
    expect(tryPushBadMessage).toThrowErrorMatchingSnapshot();
});

it('pushes multiple diagnostics to the list', () => {
    const list = new DiagnosticList();
    list.pushMessage('Message 1');
    list.pushError("I'm sorry Dave, I can't let you do that");
    list.pushMessage('Message 2');
    list.pushWarning('Uh oh');
    expect(list.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'Message 1',
            category: DiagnosticCategory.Message,
        }),
        expect.objectContaining({
            messageText: "I'm sorry Dave, I can't let you do that",
            category: DiagnosticCategory.Error,
        }),
        expect.objectContaining({
            messageText: 'Message 2',
            category: DiagnosticCategory.Message,
        }),
        expect.objectContaining({
            messageText: 'Uh oh',
            category: DiagnosticCategory.Warning,
        }),
    ]);
    expect(list.fatalError).toEqual(false);
});

it('merges two lists together', () => {
    const listA = new DiagnosticList();
    const listB = new DiagnosticList();
    listA.pushMessage('List A message 1');
    listA.pushMessage('List A message 2');
    listB.pushMessage('List B message 1');
    listA.extend(listB);
    expect(listA.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'List A message 1',
            category: DiagnosticCategory.Message,
        }),
        expect.objectContaining({
            messageText: 'List A message 2',
            category: DiagnosticCategory.Message,
        }),
        expect.objectContaining({
            messageText: 'List B message 1',
            category: DiagnosticCategory.Message,
        }),
    ]);
    expect(listA.fatalError).toEqual(false);
});

it('merges two empty lists', () => {
    const listA = new DiagnosticList();
    const listB = new DiagnosticList();
    listA.extend(listB);
    expect(listA.diagnostics).toEqual([]);
    expect(listA.fatalError).toEqual(false);
});

it('merges an empty list into a nonempty list', () => {
    const listA = new DiagnosticList();
    const listB = new DiagnosticList();
    listA.pushMessage('A message');
    listA.extend(listB);
    expect(listA.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'A message',
            category: DiagnosticCategory.Message,
        }),
    ]);
    expect(listA.fatalError).toEqual(false);
});

it('merges a nonempty list into an empty list', () => {
    const listA = new DiagnosticList();
    const listB = new DiagnosticList();
    listB.pushMessage('A message');
    listA.extend(listB);
    expect(listA.diagnostics).toEqual([
        expect.objectContaining({
            messageText: 'A message',
            category: DiagnosticCategory.Message,
        }),
    ]);
    expect(listA.fatalError).toEqual(false);
});

it('merges a list with a fatal error', () => {
    const listA = new DiagnosticList();
    const listB = new DiagnosticList();
    listB.pushFatalError('Blarg im ded');
    listA.extend(listB);
    expect(listA.fatalError).toEqual(true);
});
