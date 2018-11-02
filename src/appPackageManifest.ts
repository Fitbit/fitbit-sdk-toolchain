import path from 'path';
import { Transform } from 'stream';

import * as t from 'io-ts';
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
      platform: string[];
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
      platform: t.array(t.string),
    }),
    t.partial({
      isNative: t.literal(true),
    }),
  ]),
  t.type({
    type: t.literal('companion'),
  }),
]);
type ComponentBundleTag = t.TypeOf<typeof ComponentBundleTag>;

export default function appPackageManifest({ projectConfig, buildId } : {
  projectConfig: ProjectConfiguration,
  buildId: string,
}) {
  const sourceMaps = {};
  const components: Components = {};
  let hasJS = false;
  let hasNative = false;

  const stream = new Transform({
    objectMode: true,
    transform(file: Vinyl, _, next) {
      if (file.componentMapKey) {
        lodash.merge(
          sourceMaps,
          lodash.set({}, file.componentMapKey, normalizeToPOSIX(file.relative)),
        );
      }

      if (file.componentBundle) {
        let bundleInfo: ComponentBundleTag;
        try {
          bundleInfo = ComponentBundleTag.decode(
            file.componentBundle,
          ).getOrElseL((errors) => {
            throw new Error(`Unknown bundle component tag: ${failure(errors).join('\n')}`);
          });
        } catch (ex) {
          return next(new PluginError(PLUGIN_NAME, ex, { fileName: file.relative }));
        }

        function throwDuplicateComponent(existingPath: string) {
          const componentType = bundleInfo.type === 'device' ?
            `${bundleInfo.type}/${bundleInfo.family}` : bundleInfo.type;
          next(
            new PluginError(
              PLUGIN_NAME,
              `Duplicate ${componentType} component bundles: ${file.relative} / ${existingPath}`,
            ),
          );
        }

        if (bundleInfo.type === 'device') {
          if (bundleInfo.isNative) hasNative = true;
          else hasJS = true;

          if (hasJS && hasNative) {
            return next(
              new PluginError(
                PLUGIN_NAME,
                'Cannot bundle mixed native/JS device components',
                { fileName: file.relative },
              ),
            );
          }

          if (!components.watch) components.watch = {};

          if (components.watch[bundleInfo.family]) {
            return throwDuplicateComponent(components.watch[bundleInfo.family].filename);
          }

          components.watch[bundleInfo.family] = {
            platform: bundleInfo.platform,
            filename: file.relative,
          };
        } else {
          if (components[bundleInfo.type] !== undefined) {
            return throwDuplicateComponent(components[bundleInfo.type]!.filename);
          }

          components[bundleInfo.type] = { filename: file.relative };
        }

      }
      next(undefined, file);
    },
    flush(callback) {
      const setSDKVersion = (components.watch && hasJS) || components.companion;
      const { deviceApi, companionApi } = apiVersions(projectConfig);
      const manifestJSON = JSON.stringify(
        {
          buildId,
          components,
          sourceMaps,
          manifestVersion: 6,
          ...(setSDKVersion && { sdkVersion: {
            ...(components.watch && hasJS && { deviceApi }),
            ...(components.companion && { companionApi }),
          }}),
          requestedPermissions: projectConfig.requestedPermissions,
          appId: projectConfig.appUUID,
        },
        undefined,
        2,
      );
      stream.push(new Vinyl({
        contents: Buffer.from(manifestJSON, 'utf8'),
        path: path.resolve(process.cwd(), manifestPath),
      }));
      callback();
    },
  });

  return stream;
}
