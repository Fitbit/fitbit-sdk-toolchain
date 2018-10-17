const TAG = '~';
const TAG_SPLIT_REGEX = RegExp(`^([^${TAG}]*)(?:${TAG}([^.]+))?(.*)$`, 'u');

/**
 * Splits a tagged resource filename into the base name and tag parts.
 *
 * @param name File name to split
 * @returns The parsed name
 *
 * The tag is undefined if no tag was present in the name.
 */
export default function splitTaggedFilename(name: string): { basename: string; tag?: string; } {
  const split = TAG_SPLIT_REGEX.exec(name);
  if (split == null) {
    // Something went horribly wrong. The regex should always match.
    throw new Error(`Could not parse filename ${JSON.stringify(String(name))}`);
  }
  const [before, tag, after] = split.slice(1);
  return { tag, basename: before + after };
}
