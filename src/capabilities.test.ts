import semver from 'semver';

import { SupportedDeviceCapabilities } from './capabilities';

describe('SupportedDeviceCapabilities', () => {
  describe('create()', () => {
    it('returns supported capabilities for * as JS API version', () => {
      expect(SupportedDeviceCapabilities.create('*', 'mira')).toEqual(
        expect.objectContaining({
          screenSize: { w: 300, h: 300 },
        }),
      );
    });

    it('returns supported capabilities for JS API versions greater than the threshold version', () => {
      expect(
        SupportedDeviceCapabilities.create(
          SupportedDeviceCapabilities.presentSince,
          'higgs',
        ),
      ).toEqual(
        expect.objectContaining({
          screenSize: { w: 348, h: 250 },
        }),
      );
    });

    it('does not return any supported capabilities for JS API versions lower than the threshold version', () => {
      const illegibleVersion = () => {
        const presentSince = semver.parse(
          SupportedDeviceCapabilities.presentSince,
        );
        if (!presentSince) throw new Error('Failed to parse version.');
        presentSince.major -= 1;
        return presentSince.format();
      };

      expect(
        SupportedDeviceCapabilities.create(illegibleVersion(), 'higgs'),
      ).toBeUndefined();
    });

    it('throws an error if the target JS API version string is not valid', () => {
      expect(() =>
        SupportedDeviceCapabilities.create('..', 'mira'),
      ).toThrowError();
    });
  });
});
