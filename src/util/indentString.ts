export default function(string: string, count: number) {
  return string.replace(/^(?!\s*$)/gm, ' '.repeat(count));
}
