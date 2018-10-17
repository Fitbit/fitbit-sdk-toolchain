import buildTargets from './buildTargets';

jest.mock(
  '@fitbit/sdk-build-targets',
  () => ({ default: { foo: 'Foo', bar: 'Bar' } }),
  { virtual: true },
);

it('merges the build target descriptors', () => {
  expect(buildTargets).toMatchObject({
    higgs: {
      displayName: 'Fitbit Ionic',
      platform: expect.any(Array),
      resourceFilterTag: '348x250',
    },
    // Unfortunately, due to the way that module mocking works, the
    // extra build targets constant cannot be deduped easily.
    foo: 'Foo',
    bar: 'Bar',
  });
});
