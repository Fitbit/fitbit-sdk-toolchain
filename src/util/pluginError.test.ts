import PluginError from 'plugin-error';

import pluginError from './pluginError';
import { Diagnostic, DiagnosticMessage } from '../diagnostics';

describe('isPluginError', () => {
    it.each([
        ['with a string message', new PluginError('foo', 'message')],
        ['constructed from an Error', new PluginError('bar', new Error('asdf'))],
        ['with showStack enabled', new PluginError('a', new Error('foo'), { showStack: true })],
    ])('correctly identifies a PluginError %s', (_, error) => {
        expect(pluginError.isPluginError(error)).toBe(true);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['an object', {}],
        ['an object with no prototype', Object.create(null)],
        ['an array', [1, 2, 3]],
        ['a number', 3],
        ['a string', 'foo'],
        ['a plain Error', new Error('foo')],
        ['a TypeError', new TypeError('nope')],
        [
            'an Error object with the same properties as a PluginError',
            Object.assign(new Error('foo'), {
                showStack: false,
                showProperties: true,
                plugin: 'foo',
            }),
        ],
    ])('correctly identifies %s not to be a PluginError', (_, value) => {
        expect(pluginError.isPluginError(value)).toBe(false);
    });
});

describe('isProjectBuildError', () => {
    it('returns true for PluginError with default options', () => {
        expect(pluginError.isProjectBuildError(new PluginError('foo', 'bar'))).toBe(true);
    });

    it('returns false for PluginError with showStack set', () => {
        expect(pluginError.isProjectBuildError(new PluginError('foo', 'bar', { showStack: true }))).toBe(false);
    });
});

describe('convertToDiagnostic', () => {
    it('deals with PluginErrors constructed from another Error', () =>
        expect(pluginError.convertToDiagnostic(new PluginError('foo', new TypeError('ouch')))).toMatchSnapshot());

    describe('when the error has fileName set', () => {
        it('copies the fileName into the diagnostic', () => {
            const fileName = 'app/foo.js';
            const error = new PluginError('asdf', 'blah', { fileName });
            expect(pluginError.convertToDiagnostic(error)).toHaveProperty('file.path', fileName);
        });
    });

    describe('when the error has only columnNumber set but no fileName', () => {
        it('does not copy any position info', () => {
            const error: PluginError<{ columnNumber?: number }> = new PluginError('foo', 'bar');
            error.columnNumber = 5;
            expect(pluginError.convertToDiagnostic(error)).not.toHaveProperty('file');
        });
    });

    describe('when the error has lineNumber and columnNumber set but no fileName', () => {
        it('does not copy any position info', () => {
            const error: PluginError<{ columnNumber?: number }> = new PluginError('foo', 'bar', { lineNumber: 7 });
            error.columnNumber = 5;
            expect(pluginError.convertToDiagnostic(error)).not.toHaveProperty('file');
        });
    });

    describe('when the error has all the position info set', () => {
        it('converts the position info', () => {
            const fileName = 'companion/bar.js';
            const error: PluginError<{ columnNumber?: number }> = new PluginError('foo', 'bar', { fileName, lineNumber: 7 });
            error.columnNumber = 5;
            expect(pluginError.convertToDiagnostic(error)).toHaveProperty('file', {
                path: fileName,
                position: {
                    // PluginError is 1-based; Diagnostic is 0-based.
                    start: { line: 6, character: 4 },
                },
            });
        });
    });

    it('ignores runtime-inserted error position info', () => {
        const error = new PluginError('blah', 'blah', { fileName: 'foo' });
        Object.defineProperties(error, {
            lineNumber: { value: 5, enumerable: false },
            columnNumber: { value: 12, enumerable: false },
        });
        const diagnostic = pluginError.convertToDiagnostic(error);
        expect(diagnostic).toHaveProperty('file', { path: 'foo' });
    });

    it('ignores runtime-inserted error file name', () => {
        const error = new PluginError('blah', 'blah');
        Object.defineProperties(error, {
            fileName: { value: 'node_modules/dont/care.js', enumerable: false },
        });
        const diagnostic = pluginError.convertToDiagnostic(error);
        expect(diagnostic).not.toHaveProperty('file');
    });

    describe('when there are custom properties', () => {
        // tslint:disable-next-line:no-any
        let error: PluginError<{ [key: string]: any }>;
        let diagnostic: Diagnostic;

        beforeEach(() => {
            // tslint:disable-next-line:no-any
            error = new PluginError('foo', 'message') as any;
            error.customProp = 'custom property';
            error.another = 'one here';
            error.haiku = 'This one has newlines\nembedded in the value\nrefridgerator';
            error.lineNumber = 12;
            error.columnNumber = 3;
            error.fileName = 'path/to/some/file.js';

            diagnostic = pluginError.convertToDiagnostic(error);
        });

        it('constructs a diagnostic', () => expect(diagnostic).toMatchSnapshot());

        it('includes the details in a second part of the message', () => {
            expect(diagnostic).toHaveProperty('messageText', expect.any(Array));
            expect(diagnostic.messageText).toHaveLength(2);
        });

        it('outputs the detail property names and values', () => {
            const details = (diagnostic.messageText as DiagnosticMessage[])[1].messageText;
            expect(details).toMatch(/customProp: custom property/);
            expect(details).toMatch(/another: one here/);
        });

        it.each(['fileName', 'lineNumber', 'columnNumber', 'plugin', 'stack', '_stack'])('does not output %s', prop => {
            const details = (diagnostic.messageText as DiagnosticMessage[])[1].messageText;
            expect(details).not.toMatch(prop);
        });

        it('respects showProperties = false', () => {
            error.showProperties = false;
            diagnostic = pluginError.convertToDiagnostic(error);
            expect(diagnostic).toHaveProperty('messageText', expect.any(String));
        });
    });
});
