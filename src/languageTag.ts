export const supportedTags = [
  'de-DE',
  'en-US',
  'es-ES',
  'fr-FR',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'sv-SE',
  'zh-CN',
  'zh-TW',
];

export function validateLanguageTag(tagString: string) {
  return supportedTags.includes(tagString);
}
