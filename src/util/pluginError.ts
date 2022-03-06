import PluginError from 'plugin-error';

import {
  Diagnostic,
  DiagnosticCategory,
  DiagnosticTarget,
} from '../diagnostics';
import indentString from './indentString';

export function isPluginError(value: unknown): value is PluginError {
  // We can't just do an instanceof check as the error object might be
  // constructed from a different version of PluginError. So we need to
  // employ some heuristics.
  if (!(value instanceof Error)) return false;
  const { showStack, plugin, toString } = value as PluginError;
  return (
    typeof showStack === 'boolean' &&
    typeof plugin === 'string' &&
    toString !== Error.prototype.toString
  );
}

/**
 * Determine heuristically whether the error is likely to be from a
 * user error rather than a bug in the toolchain.
 *
 * @param error caught error object
 */
function isProjectBuildError(error: PluginError): boolean {
  return !error.showStack;
}

function hasEnumerableProp<T, K extends string | number | symbol>(
  obj: { [P in K]?: T },
  prop: K,
): obj is { [P in K]: T } {
  // eslint-disable-next-line no-prototype-builtins
  return obj.propertyIsEnumerable(prop) && obj[prop] !== undefined;
}

const ignoredPluginErrorProps = new Set([
  '__safety',
  '_stack',
  'columnNumber',
  'fileName',
  'lineNumber',
  'message',
  'name',
  'plugin',
  'showProperties',
  'showStack',
  'stack',
  'target',
]);

function hasDiagnosticTarget<T extends PluginError>(
  err: T,
): err is T & { target: DiagnosticTarget } {
  return Object.values(DiagnosticTarget).indexOf((err as any).target) !== -1;
}

function convertToDiagnostic(
  error: PluginError<{ columnNumber?: number }>,
): Diagnostic {
  const diagnostic: Diagnostic = {
    category: DiagnosticCategory.Error,
    messageText: `${error.name}: ${error.message}`,
  };

  if (hasDiagnosticTarget(error)) {
    diagnostic.target = error.target;
  }

  // Our own spin on PluginError.prototype._messageDetails().
  if (error.showProperties) {
    const detailKeys = Object.keys(error).filter(
      (key) => !ignoredPluginErrorProps.has(key),
    );
    if (detailKeys.length) {
      const detailsText = detailKeys
        .map((key) => {
          const value = (error as any)[key];

          if (typeof value === 'string' && value.includes('\n')) {
            return `    ${key}:\n${indentString(value, 6)}\n`;
          }

          return `    ${key}: ${value}\n`;
        })
        .join('');

      diagnostic.messageText = [
        {
          category: DiagnosticCategory.Error,
          messageText: diagnostic.messageText as string,
        },
        {
          category: DiagnosticCategory.Message,
          messageText: 'Details:\n' + detailsText,
        },
      ];
    }
  }

  // Some JS runtimes add `fileName` and `lineNumber` properties to all
  // Error instances. These are the location where the error itself was
  // instantiated, which we do not actually want. We are only interested
  // in the error location **in the project sources**. Luckily the
  // runtime-injected properties are non-enumerable so they are easy to
  // detect.
  if (hasEnumerableProp(error, 'fileName')) {
    diagnostic.file = {
      path: error.fileName,
    };
    if (hasEnumerableProp(error, 'lineNumber')) {
      diagnostic.file.position = {
        start: {
          line: error.lineNumber - 1,
          character: hasEnumerableProp(error, 'columnNumber')
            ? error.columnNumber - 1
            : undefined,
        },
      };
    }
  }
  return diagnostic;
}

const pluginError = {
  convertToDiagnostic,
  isPluginError,
  isProjectBuildError,
};
export default pluginError;
