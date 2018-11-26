import { PassThrough } from 'stream';

import { advanceTo } from 'jest-date-mock';
import Vinyl from 'vinyl';

import { makeDeviceManifest, makeCompanionManifest } from './componentManifest';
import ProjectConfiguration, { AppProjectConfiguration, AppType, ClockProjectConfiguration } from './ProjectConfiguration';
import { apiVersions } from './sdkVersion';

import getJSONFileFromStream from './testUtils/getJSONFileFromStream';

jest.mock('./packageVersion.const');

const buildId = '0x0f75775f470c1585';
const makeClockfaceProjectConfig = (): ClockProjectConfiguration => ({
    appUUID: 'b4ae822e-eca9-4fcb-8747-217f2a1f53a1',
    appType: AppType.CLOCKFACE,
    appDisplayName: 'My App',
    i18n: {
        en: { name: 'My App' },
        fr: { name: 'Mon application' },
    },
    buildTargets: ['higgs'],
    requestedPermissions: [],
});

const makeAppProjectConfig = (): AppProjectConfiguration => ({
    ...makeClockfaceProjectConfig(),
    appType: AppType.APP,
    wipeColor: '#ffaabb',
    iconFile: 'resources/icon.png',
});

// tslint:disable-next-line:no-any
function expectDeviceManifest(projectConfig: ProjectConfiguration = makeClockfaceProjectConfig()): jest.Matchers<Promise<Promise<any>>> {
    const manifest = makeDeviceManifest({
        buildId,
        projectConfig,
    });
    manifest.end();

    return expect(getJSONFileFromStream(manifest)).resolves;
}

// tslint:disable-next-line:no-any
function expectCompanionManifest(hasSettings: boolean = false): jest.Matchers<Promise<Promise<any>>> {
    return expect(
        getJSONFileFromStream(
            makeCompanionManifest({
                buildId,
                hasSettings,
                projectConfig: makeClockfaceProjectConfig(),
            })
        )
    ).resolves;
}

beforeEach(() => {
    advanceTo(new Date(Date.UTC(2018, 5, 27, 0, 0, 0)));
});

it('builds a device manifest for a clock', () => expectDeviceManifest().toMatchSnapshot());

it('builds a device manifest for an app', () => expectDeviceManifest(makeAppProjectConfig()).toMatchSnapshot());

it('builds a companion manifest', () => expectCompanionManifest().toMatchSnapshot());

it('builds a companion manifest with settings', () => expectCompanionManifest(true).toMatchSnapshot());

it('sets apiVersion in app manifest', () => expectDeviceManifest().toHaveProperty('apiVersion', apiVersions({}).deviceApi));

it('sets apiVersion in companion manifest', () => expectCompanionManifest().toHaveProperty('apiVersion', apiVersions({}).companionApi));

describe('when there are compiled language files', () => {
    let sources: PassThrough;

    beforeEach(() => {
        sources = new PassThrough({ objectMode: true });

        sources.write(
            new Vinyl({
                path: 'lang/english',
                translationLanguage: 'en',
                contents: Buffer.from('foo'),
            })
        );

        sources.write(
            new Vinyl({
                path: 'app/index.js',
                contents: Buffer.from('foo'),
            })
        );

        sources.write(
            new Vinyl({
                path: 'spanish/language',
                translationLanguage: 'es',
                contents: Buffer.from('foo'),
            })
        );

        sources.end();
    });

    it('sets the i18n[lang].resources key for language files that pass through', () => {
        return expect(
            getJSONFileFromStream(
                sources.pipe(
                    makeDeviceManifest({
                        buildId,
                        projectConfig: makeClockfaceProjectConfig(),
                    })
                ),
                'manifest.json'
            )
        ).resolves.toMatchSnapshot();
    });

    it('passes all files through', done => {
        const files: string[] = [];

        sources
            .pipe(makeDeviceManifest({ buildId, projectConfig: makeClockfaceProjectConfig() }))
            .on('error', done.fail)
            .on('data', (file: Vinyl) => files.push(file.relative))
            .on('end', () => {
                expect(files).toEqual(['lang/english', 'app/index.js', 'spanish/language', 'manifest.json']);
                done();
            });
    });
});
