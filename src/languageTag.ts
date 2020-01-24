import { Locales } from './ProjectConfiguration';

export function validateLanguageTag(tagString: string) {
  return Object.keys(Locales).includes(tagString);
}
