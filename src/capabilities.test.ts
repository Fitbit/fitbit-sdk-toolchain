import { SupportedDeviceCapabilities } from './capabilities';

describe('SupportedDeviceCapabilities', () => {
  describe('create()', () => {
    it('returns supported capabilities for * as JS API version', () => {
      expect(SupportedDeviceCapabilities.create('atlas')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );

      expect(SupportedDeviceCapabilities.create('vulcan')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );
    });
  });
});
