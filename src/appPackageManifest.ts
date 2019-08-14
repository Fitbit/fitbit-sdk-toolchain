import path from 'path';
import { Transform, TransformCallback } from 'stream';

import * as t from 'io-ts';
import * as fp from 'fp-ts';
import { failure } from 'io-ts/lib/PathReporter';
import lodash from 'lodash';
import PluginError from 'plugin-error';
import Vinyl from 'vinyl';

import { normalizeToPOSIX } from './pathUtils';
import ProjectConfiguration from './ProjectConfiguration';
import { apiVersions } from './sdkVersion';

const manifestPath = 'manifest.json';
const PLUGIN_NAME = 'appPackageManifest';

interface Components {
  watch?: {
    [platform: string]: {
      filename: string;
      platform?: string[];
    };
  };
  companion?: {
    filename: string;
  };
}

// tslint:disable-next-line:variable-name
const ComponentBundleTag = t.taggedUnion('type', [
  t.intersection([
    t.interface({
      type: t.literal('device'),
      family: t.string,
    }),
    t.partial({
      platform: t.array(t.string),
      isNative: t.literal(true),
    }),
  ]),
  t.type({
    type: t.literal('companion'),
  }),
]);
type ComponentBundleTag = t.TypeOf<typeof ComponentBundleTag>;

function getBundleInfo(file: Vinyl): ComponentBundleTag {
  return fp.pipeable.pipe(
    ComponentBundleTag.decode(file.componentBundle),
    fp.either.fold((errors) => {
      throw new PluginError(
        PLUGIN_NAME,
        `Unknown bundle component tag: ${failure(errors).join('\n')}`,
        { fileName: file.relative },
      );
    }, fp.function.identity),
  );
}

class AppPackageManifestTransform extends Transform {
  sourceMaps = {};
  components: Components = {};
  hasJS = false;
  hasNative = false;

  constructor(
    public projectConfig: ProjectConfiguration,
    public buildID: string,
  ) {
    super({ objectMode: true });
  }

  // tslint:disable-next-line:cognitive-complexity
  private transformComponentBundle(file: Vinyl) {
    const bundleInfo = getBundleInfo(file);

    function throwDuplicateComponent(existingPath: string) {
      const componentType =
        bundleInfo.type === 'device'
          ? `${bundleInfo.type}/${bundleInfo.family}`
          : bundleInfo.type;
      throw new PluginError(
        PLUGIN_NAME,
        `Duplicate ${componentType} component bundles: ${file.relative} / ${existingPath}`,
      );
    }

    if (bundleInfo.type === 'device') {
      if (bundleInfo.isNative) this.hasNative = true;
      else this.hasJS = true;

      if (this.hasJS && this.hasNative) {
        throw new PluginError(
          PLUGIN_NAME,
          'Cannot bundle mixed native/JS device components',
          { fileName: file.relative },
        );
      }

      if (!this.components.watch) this.components.watch = {};

      if (this.components.watch[bundleInfo.family]) {
        throwDuplicateComponent(
          this.components.watch[bundleInfo.family].filename,
        );
      }

      this.components.watch[bundleInfo.family] = {
        filename: file.relative,
      };

      if (bundleInfo.platform) {
        this.components.watch[bundleInfo.family].platform = bundleInfo.platform;
      }
    } else {
      if (this.components[bundleInfo.type] !== undefined) {
        throwDuplicateComponent(this.components[bundleInfo.type]!.filename);
      }

      this.components[bundleInfo.type] = { filename: file.relative };
    }
  }

  // tslint:disable-next-line:function-name
  _transform(file: Vinyl, _: unknown, next: TransformCallback) {
    if (file.componentMapKey) {
      lodash.merge(
        this.sourceMaps,
        lodash.set({}, file.componentMapKey, normalizeToPOSIX(file.relative)),
      );
    }

    if (file.componentBundle) {
      try {
        this.transformComponentBundle(file);
      } catch (ex) {
        return next(ex);
      }
    }

    return next(undefined, file);
  }

  // tslint:disable-next-line:function-name
  _flush(callback: TransformCallback) {
    const setSDKVersion =
      (this.components.watch && this.hasJS) || this.components.companion;
    const { deviceApi, companionApi } = apiVersions(this.projectConfig);
    const manifestJSON = JSON.stringify(
      {
        buildId: this.buildID,
        components: this.components,
        sourceMaps: this.sourceMaps,
        manifestVersion: 6,
        ...(setSDKVersion && {
          sdkVersion: {
            ...(this.components.watch && this.hasJS && { deviceApi }),
            ...(this.components.companion && { companionApi }),
          },
        }),
        requestedPermissions: this.projectConfig.requestedPermissions,
        appId: this.projectConfig.appUUID,
      },
      undefined,
      2,
    );
    this.push(
      new Vinyl({
        contents: Buffer.from(manifestJSON, 'utf8'),
        path: path.resolve(process.cwd(), manifestPath),
      }),
    );
    callback();
  }
}

export default function appPackageManifest({
  projectConfig,
  buildId,
}: {
  projectConfig: ProjectConfiguration;
  buildId: string;
}) {
  return new AppPackageManifestTransform(projectConfig, buildId);
}
