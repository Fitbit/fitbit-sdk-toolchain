function clamp(num: number, min: number, max: number) {
  return num <= min ? min : num >= max ? max : num;
}
export default function byteStringFormatter(
  byteCount: number,
  decimalCount = 2,
) {
  if (byteCount === 0) {
    return '0 Bytes';
  }

  const unitSize = 1024;
  const unitNames = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const index = Math.floor(Math.log(byteCount) / Math.log(unitSize));
  return `${parseFloat(
    (byteCount / Math.pow(unitSize, index)).toFixed(
      clamp(decimalCount, 0, 100),
    ),
  )} ${unitNames[index]}`;
}
