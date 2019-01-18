interface ComponentTarget {
  inputs: string[];
  outputDir?: string;
  notFoundIsFatal: boolean;
  translationsGlob: string;
}

export enum ComponentType {
  DEVICE = 'device',
  COMPANION = 'companion',
  SETTINGS = 'settings',
}

const componentTarget: { [component in ComponentType]: ComponentTarget } = {
  [ComponentType.DEVICE]: {
    inputs: ['app/index.ts', 'app/index.js'],
    outputDir: 'app',
    notFoundIsFatal: true,
    translationsGlob: 'app/i18n/*.po',
  },
  [ComponentType.COMPANION]: {
    inputs: ['companion/index.ts', 'companion/index.js'],
    notFoundIsFatal: false,
    translationsGlob: 'companion/i18n/*.po',
  },
  [ComponentType.SETTINGS]: {
    inputs: ['tsx', 'ts', 'jsx', 'js'].map((ext) => `settings/index.${ext}`),
    notFoundIsFatal: false,
    translationsGlob: 'settings/i18n/*.po',
  },
};

export default componentTarget;
