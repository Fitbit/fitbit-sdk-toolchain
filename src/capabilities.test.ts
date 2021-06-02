import { SupportedDeviceCapabilities } from './capabilities';

describe('SupportedDeviceCapabilities', () => {
  describe('create()', () => {
    it('returns supported capabilities for * as JS API version', () => {
      expect(SupportedDeviceCapabilities.create('higgs')).toEqual(
        expect.objectContaining({
          screenSize: { w: 348, h: 250 },
        }),
      );

      expect(SupportedDeviceCapabilities.create('mira')).toEqual(
        expect.objectContaining({
          screenSize: { w: 300, h: 300 },
        }),
      );
    });
  });
});
