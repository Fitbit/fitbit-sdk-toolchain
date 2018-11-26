import path from 'path';
import stream from 'stream';

import PluginError from 'plugin-error';
import { PNG } from '@fitbit/pngjs';
import Vinyl from 'vinyl';

import { DiagnosticCategory, DiagnosticHandler } from './diagnostics';
import ProjectConfiguration, { AppType } from './ProjectConfiguration';
import { NextTransformCallback } from './appPackageManifest';

const EXPECTED_ICON_HEIGHT = 80;
const EXPECTED_ICON_WIDTH = 80;
const PLUGIN_NAME = 'validateIcon';

interface ImageDimensions {
    width: number;
    height: number;
}

function getPNGDimensions(buffer: Buffer): Promise<ImageDimensions> {
    return new Promise<ImageDimensions>((resolve, reject) => {
        const png = new PNG();
        png.on('metadata', metadata => {
            png.on('parsed', parsed =>
                resolve({
                    width: png.width,
                    height: png.height,
                })
            );
        });
        png.on('error', reject);
        png.parse(buffer);
    });
}

export default function validateIcon({
    projectConfig,
    onDiagnostic,
}: {
    projectConfig: ProjectConfiguration;
    onDiagnostic: DiagnosticHandler;
}): stream.Transform {
    if (projectConfig.appType === AppType.CLOCKFACE) {
        return new stream.PassThrough({ objectMode: true });
    }

    let iconExists = false;

    return new stream.Transform({
        objectMode: true,
        transform(
            this: stream.Transform,
            file: Vinyl,
            _: unknown,
            callback: (pluginError: PluginError | undefined, file?: Vinyl) => void
        ): void {
            if (file.isNull() || file.relative !== path.normalize(projectConfig.iconFile)) {
                return callback(undefined, file);
            }

            iconExists = true;

            if (file.isBuffer()) {
                getPNGDimensions(file.contents)
                    .then(metadata => {
                        const iconHeight = metadata.height;
                        const iconWidth = metadata.width;
                        if (iconWidth !== EXPECTED_ICON_WIDTH || iconHeight !== EXPECTED_ICON_HEIGHT) {
                            // tslint:disable-next-line:max-line-length
                            const errorMessage = `Icon was of invalid size, expected ${EXPECTED_ICON_WIDTH}x${EXPECTED_ICON_HEIGHT}, got ${iconWidth}x${iconHeight}`;
                            return callback(new PluginError(PLUGIN_NAME, errorMessage, { fileName: file.relative }));
                        }

                        callback(undefined, file);
                    })
                    .catch(err => callback(new PluginError(PLUGIN_NAME, err, { fileName: file.relative })));
            } else {
                // Error if file is not a buffer, may in the future support file streams
                callback(new PluginError(PLUGIN_NAME, 'Icon file is not a buffer', { fileName: file.relative }));
            }
        },
        flush(callback: NextTransformCallback): void {
            if (!iconExists) {
                onDiagnostic({
                    category: DiagnosticCategory.Warning,
                    // tslint:disable-next-line:max-line-length
                    messageText: `There is no app icon present in this project. To set an app icon, add a ${EXPECTED_ICON_WIDTH}x${EXPECTED_ICON_HEIGHT} PNG file named ${
                        projectConfig.iconFile
                    } to your project.`,
                });
            }
            callback();
        },
    });
}
