import { create } from './capabilities';

describe('SupportedDeviceCapabilities', () => {
  describe('create()', () => {
    it('returns supported capabilities for * as JS API version', () => {
      expect(create('atlas')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );

      expect(create('vulcan')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );
    });

    it('returns undefined for an unknown device', () => {
      expect(create('unknown')).toBeUndefined();
    });
  });
});
