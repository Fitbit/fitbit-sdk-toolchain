import { relative } from 'path';

import chalk from 'chalk';
import dateformat from 'dateformat';
import indentString from 'indent-string';

interface LineAndCharacter {
  line: number;
  character: number;
}

export interface DiagnosticMessage {
  messageText: string;
  category: DiagnosticCategory;
}

export interface Diagnostic {
  messageText: string | DiagnosticMessage[];
  category: DiagnosticCategory;
  target?: DiagnosticTarget;
  file?: {
    path: string;
    position?:
      | {
          start: { line: number };
        }
      | {
          start: LineAndCharacter;
          end?: LineAndCharacter;
        };
  };
}

export enum DiagnosticCategory {
  Warning = 0,
  Error = 1,
  Suggestion = 2,
  Message = 3,
}

export enum DiagnosticTarget {
  App = 'app',
  Companion = 'companion',
  Settings = 'settings',
}

export type DiagnosticHandler = (diagnostic: Diagnostic) => void;

const consoleColors = {
  [DiagnosticCategory.Warning]: chalk.keyword('orange'),
  [DiagnosticCategory.Error]: chalk.red,
  [DiagnosticCategory.Message]: chalk,
  [DiagnosticCategory.Suggestion]: chalk,
};

const categoryNames = {
  [DiagnosticCategory.Warning]: 'warn',
  [DiagnosticCategory.Error]: 'error',
  [DiagnosticCategory.Message]: 'info',
  [DiagnosticCategory.Suggestion]: 'suggestion',
};

export const logDiagnosticToConsole: DiagnosticHandler = (diagnostic) => {
  const { category, messageText, target } = diagnostic;

  let filePosition = '';
  if (diagnostic.file) {
    const { path, position } = diagnostic.file;
    filePosition += ` ${relative(process.cwd(), path)}`;
    if (position) {
      filePosition += `:${position.start.line + 1}`;
      if ('character' in position.start) {
        filePosition += `,${position.start.character + 1}`;
      }
    }
  }

  const now = new Date();
  const timestamp = dateformat(now, 'HH:MM:ss');

  const colorizer = consoleColors[category];
  const categoryName = categoryNames[category];
  const targetString = target ? target : 'build';
  const message =
    typeof messageText === 'string' ? messageText : messageText[0].messageText;

  console.log(
    colorizer(
      `[${timestamp}][${categoryName}][${targetString}]${filePosition} ${message}`,
    ),
  );

  if (typeof messageText !== 'string') {
    for (let i = 1; i < messageText.length; i += 1) {
      console.log(
        consoleColors[messageText[i].category](
          indentString(messageText[i].messageText, 4),
        ),
      );
    }
  }
};
