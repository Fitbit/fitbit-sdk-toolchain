import MagicString from 'magic-string';

/**
 * FW-65870: Works around a bug where a return, followed by
 * only tabs or spaces and then a curly brace, cannot be parsed on devices.
 */
export function errataPrimaryExpressionInSwitch(
  code: string,
  magic: MagicString,
) {
  const returnRegex = /return[ \t]*}/g;
  let match;
  while ((match = returnRegex.exec(code))) {
    magic.appendRight(match.index + 'return'.length, ';');
  }
}
