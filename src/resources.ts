import sdkVersion from './sdkVersion';

export const svgMain = `resources/index.${
  sdkVersion().major < 5 ? 'gui' : 'view'
}`;
export const svgWidgets = `resources/${
  sdkVersion().major < 5 ? 'widgets.gui' : 'widget.defs'
}`;
