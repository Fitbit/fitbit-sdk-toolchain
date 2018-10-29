import externals from './externals';

it('allows a known import', () =>
  expect(externals.device('file-transfer')).toEqual(true));

it('allows an internal import', () =>
  expect(externals.device('internal/foo')).toEqual(true));

it('does not allow an unknown import', () =>
  expect(externals.device('foo')).toBeUndefined());
