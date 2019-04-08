import lodash from 'lodash';

export default function byteStringFormatter(
  byteCount: number,
  decimalCount = 4,
) {
  if (byteCount === 0) {
    return '0 B';
  }

  const unitSize = 1024;
  const unitNames = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const index = Math.floor(Math.log(byteCount) / Math.log(unitSize));
  return `${parseFloat(
    (byteCount / Math.pow(unitSize, index)).toFixed(
      lodash.clamp(decimalCount, 0, 20),
    ),
  )} ${unitNames[index]}`;
}
