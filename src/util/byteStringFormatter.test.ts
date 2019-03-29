import byteStringFormatter from './byteStringFormatter';

describe('byteStringFormatter', () => {
  it('handles 0 bytes accordingly', () => {
    expect(byteStringFormatter(0, 0)).toBe('0 Bytes');
    expect(byteStringFormatter(0, 3)).toBe('0 Bytes');
    expect(byteStringFormatter(0, -1)).toBe('0 Bytes');
  });

  it('handles decimals', () => {
    expect(byteStringFormatter(5, 0)).toBe('5 Bytes');
    expect(byteStringFormatter(5, 5)).toBe('5 Bytes');
    expect(byteStringFormatter(5, -1)).toBe('5 Bytes');
    expect(byteStringFormatter(5, 10000000)).toBe('5 Bytes');

    expect(byteStringFormatter(340000, 0)).toBe('332 KB');
    expect(byteStringFormatter(340000, 2)).toBe('332.03 KB');
    expect(byteStringFormatter(340000)).toBe('332.03 KB');
    expect(byteStringFormatter(340000, 5)).toBe('332.03125 KB');

    expect(byteStringFormatter(1048576, 0)).toBe('1 MB');
    expect(byteStringFormatter(1048576, 2)).toBe('1 MB');
    expect(byteStringFormatter(1048576)).toBe('1 MB');
    expect(byteStringFormatter(1048576, 5)).toBe('1 MB');
  });

  it('converts to different unit types', () => {
    expect(byteStringFormatter(10, 0)).toBe('10 Bytes');
    expect(byteStringFormatter(307200)).toBe('300 KB');
    expect(byteStringFormatter(2097152)).toBe('2 MB');
    expect(byteStringFormatter(2411724.8)).toBe('2.3 MB');
    expect(byteStringFormatter(500170752)).toBe('477 MB');
    expect(byteStringFormatter(11811160067, 0)).toBe('11 GB');
  });
});
