import sdkVersion from './sdkVersion';

export const svgMain = `resources/index.${
  sdkVersion().major < 5 ? 'gui' : 'view'
}`;
export const svgWidgets = `resources/widgets.${
  sdkVersion().major < 5 ? 'gui' : 'defs'
}`;
