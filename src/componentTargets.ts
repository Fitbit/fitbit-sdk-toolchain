interface ComponentTarget {
  inputs: string[];
  notFoundIsFatal: boolean;
  translationsGlob: string;
  allowChunking: boolean;
}

export enum ComponentType {
  DEVICE = 'device',
  COMPANION = 'companion',
  SETTINGS = 'settings',
}

const componentTarget: { [component in ComponentType]: ComponentTarget } = {
  [ComponentType.DEVICE]: {
    inputs: ['app/index.ts', 'app/index.js'],
    notFoundIsFatal: true,
    translationsGlob: 'app/i18n/*.po',
    allowChunking: true,
  },
  [ComponentType.COMPANION]: {
    inputs: ['companion/index.ts', 'companion/index.js'],
    notFoundIsFatal: false,
    translationsGlob: 'companion/i18n/*.po',
    allowChunking: false,
  },
  [ComponentType.SETTINGS]: {
    inputs: ['tsx', 'ts', 'jsx', 'js'].map((ext) => `settings/index.${ext}`),
    notFoundIsFatal: false,
    translationsGlob: 'settings/i18n/*.po',
    allowChunking: false,
  },
};

export default componentTarget;
