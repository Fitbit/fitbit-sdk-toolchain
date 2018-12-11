interface ComponentTarget {
  inputs: string[];
  output: string;
  notFoundIsFatal: boolean;
  translationsGlob: string;
}

export enum ComponentType {
  DEVICE = 'device',
  COMPANION = 'companion',
  SETTINGS = 'settings',
}

const componentTarget: {[component in ComponentType]: ComponentTarget} = {
  [ComponentType.DEVICE]: {
    inputs: [
      'app/index.ts',
      'app/index.js',
    ],
    output: 'app/index.js',
    notFoundIsFatal: true,
    translationsGlob: 'app/i18n/*.po',
  },
  [ComponentType.COMPANION]: {
    inputs: [
      'companion/index.ts',
      'companion/index.js',
    ],
    output: 'companion.js',
    notFoundIsFatal: false,
    translationsGlob: 'companion/i18n/*.po',
  },
  [ComponentType.SETTINGS]: {
    inputs: ['tsx', 'ts', 'jsx', 'js'].map(ext => `settings/index.${ext}`),
    output: 'settings.js',
    notFoundIsFatal: false,
    translationsGlob: 'settings/i18n/*.po',
  },
};

export default componentTarget;
