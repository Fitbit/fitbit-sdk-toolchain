import { SupportedDeviceCapabilities } from './capabilities';

describe('SupportedDeviceCapabilities', () => {
  describe('create()', () => {
    it('returns supported capabilities for * as JS API version', () => {
      expect(SupportedDeviceCapabilities.create('hera')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );

      expect(SupportedDeviceCapabilities.create('rhea')).toEqual(
        expect.objectContaining({
          screenSize: { w: 336, h: 336 },
        }),
      );
    });

    it('returns undefined for an unknown device', () => {
      expect(SupportedDeviceCapabilities.create('unknown')).toBeUndefined();
    });
  });
});
