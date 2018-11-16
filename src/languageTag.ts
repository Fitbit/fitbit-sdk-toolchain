export function normalizeLanguageTag(tagString: string) {
  const match = /^([a-z]{2})(-[a-z]{2})?$/i.exec(tagString);
  if (match === null) return null;
  const [, language, region] = match;
  return language.toLowerCase() + (region || '').toUpperCase();
}
