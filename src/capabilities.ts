import semver from 'semver';

import buildTargets from './buildTargets';

/**
 * Names for known device capabilities.
 */
export enum DeviceCapability {
  SCREEN_SIZE = 'screenSize',
}

/**
 * Structure describing the supported device capabilities, as included in the app manifest.
 */
export interface SupportedDeviceCapabilities {
  /** Array of screen sizes supported by the application. */
  [DeviceCapability.SCREEN_SIZE]: { w: number; h: number };
}

export namespace SupportedDeviceCapabilities {
  /**
   * Device capabilities supported by the application being built will not be
   * included into the manifest when targeting a JS API version lower than this.
   */
  export const presentSince = '7.0.0';

  /**
   * Creates and populates an object describing the supported device capabilities.
   * @param targetJsApiVersion The JS API version required by the application.
   * @param targetDevice Device family name.
   *
   * If the target JS API version is lower than `7.0.0`, then we will not include
   * the supported device capabilities into the app manifest to avoid introducing
   * any issues when parsed on device. This function signals this case by
   * returning `undefined` instead of an instance of `SupportedDeviceCapabilities`.
   *
   * @returns an instance of `SupportedDeviceCapabilities` or `undefined`
   */
  export function create(
    targetJsApiVersion: string,
    targetDevice: string,
  ): SupportedDeviceCapabilities | undefined {
    let isVersionEligibleForCaps = false;

    if (targetJsApiVersion === '*') {
      isVersionEligibleForCaps = true;
    } else {
      const parsedDeviceApi = semver.parse(targetJsApiVersion);

      if (!parsedDeviceApi) {
        throw new Error(`Failed to parse version "${targetJsApiVersion}".`);
      }

      isVersionEligibleForCaps = semver.gte(parsedDeviceApi, presentSince);
    }

    if (isVersionEligibleForCaps) {
      const { screenSize } = buildTargets[targetDevice].specs;

      return {
        [DeviceCapability.SCREEN_SIZE]: {
          w: screenSize.width,
          h: screenSize.height,
        },
      };
    }

    return undefined;
  }
}
