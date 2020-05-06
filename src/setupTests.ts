import 'jest-date-mock';
import PluginError from 'plugin-error';

expect.addSnapshotSerializer({
  test(val: any) {
    return val instanceof Error && 'plugin' in val;
  },
  print(val, serialize, indent, opts) {
    const err = val as PluginError;

    // List of props that PluginError allows one to override, excluding
    // those that we wouldn't want to include in a snapshot:
    // showProperties, showStack, stack.
    const props = ['fileName', 'lineNumber', 'message', 'name', 'plugin'];

    // Do some clever stuff to trick pretty-format into serializing a
    // plain object with the label "PluginError" instead of "Object"
    // so that we don't have to write a fully-custom serializer.
    const newObj: { [key: string]: any } = {};
    Object.defineProperty(newObj, 'constructor', {
      value: function PluginError() {},
    });

    props.forEach((prop) => {
      if (prop in err) newObj[prop] = (err as any)[prop];
    });

    return serialize(newObj);
  },
});
