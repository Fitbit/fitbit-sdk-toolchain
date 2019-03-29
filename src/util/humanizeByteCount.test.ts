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

  it('handles decimal point accordingly when the conversion value is not an integer', () => {
    expect(humanizeByteCount(340000, 0)).toBe('332 KB');
    expect(humanizeByteCount(340000, 2)).toBe('332.03 KB');
    expect(humanizeByteCount(340000, 4)).toBe('332.0313 KB');
    expect(humanizeByteCount(340000)).toBe('332.0313 KB');
    expect(humanizeByteCount(340000, 5)).toBe('332.03125 KB');
  });

  it('converts to different unit types', () => {
    expect(humanizeByteCount(10, 0)).toBe('10 B');
    expect(humanizeByteCount(307200)).toBe('300 KB');
    expect(humanizeByteCount(2097152)).toBe('2 MB');
    expect(humanizeByteCount(2411724.8)).toBe('2.3 MB');
    expect(humanizeByteCount(500170752)).toBe('477 MB');
    expect(humanizeByteCount(11811160067, 0)).toBe('11 GB');
  });
});
