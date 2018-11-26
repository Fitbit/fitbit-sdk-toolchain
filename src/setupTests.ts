import 'jest-date-mock';
import PluginError from 'plugin-error';

expect.addSnapshotSerializer({
    // tslint:disable-next-line:no-any
    test(value: any): boolean {
        return value instanceof Error && 'plugin' in value;
    },
    // tslint:disable-next-line:no-any
    print(val: PluginError, serialize: (value: any) => string): string {
        // List of props that PluginError allows one to override, excluding
        // those that we wouldn't want to include in a snapshot:
        // showProperties, showStack, stack.
        const props = ['fileName', 'lineNumber', 'message', 'name', 'plugin'];

        // Do some clever stuff to trick pretty-format into serializing a
        // plain object with the label "PluginError" instead of "Object"
        // so that we don't have to write a fully-custom serializer.
        const newObj: Record<string, unknown> = {};
        // tslint:disable-next-line:no-function-expression
        Object.defineProperty(newObj, 'constructor', { value: function PluginError(): void {} });

        props.forEach(property => {
            if (property in val) {
                // tslint:disable-next-line:no-any
                newObj[property] = (val as any)[property];
            }
        });

        return serialize(newObj);
    },
});
