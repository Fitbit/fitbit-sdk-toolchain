import humanizeByteCount from './humanizeByteCount';

describe('humanizeByteCount', () => {
  it.each([[0, 0], [0, 3], [0, -1]])(
    'handles 0 bytes accordingly',
    (byteCount, decimalCount) => {
      expect(humanizeByteCount(byteCount, decimalCount)).toBe('0 B');
    },
  );

  it.each([[5, 0], [5, 5], [5, -1], [5, undefined], [5, 10000000]])(
    'handles an exact number of bytes and shows no decimal places',
    (byteCount, decimalCount) => {
      expect(humanizeByteCount(byteCount, decimalCount)).toBe('5 B');
    },
  );

  it.each([[1048576, 0], [1048576, 2], [1048576, undefined], [1048576, 5]])(
    'converts bytes to an exact megabyte and shows no decimal point, even when we request it',
    (byteCount, decimalCount) => {
      expect(humanizeByteCount(byteCount, decimalCount)).toBe('1 MB');
    },
  );

  it.each([
    [340000, 0, '332 KB'],
    [340000, 2, '332.03 KB'],
    [340000, 4, '332.0313 KB'],
    [340000, undefined, '332.0313 KB'],
    [340000, 5, '332.03125 KB'],
  ])(
    'handles decimal point accordingly when the conversion value is not an integer',
    (byteCount, decimalCount, result) => {
      expect(humanizeByteCount(byteCount, decimalCount)).toBe(result);
    },
  );

  it.each([
    [10, 0, '10 B'],
    [307200, undefined, '300 KB'],
    [2097152, undefined, '2 MB'],
    [2411724.8, undefined, '2.3 MB'],
    [500170752, undefined, '477 MB'],
    [11811160067, 0, '11 GB'],
  ])('converts to different unit types', (byteCount, decimalCount, result) => {
    expect(humanizeByteCount(byteCount, decimalCount)).toBe(result);
  });
});
