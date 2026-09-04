import * as core from '@actions/core';
import { getSpreadSheetData } from '../src/getSpreadSheetData';
import { manageDriveTranslations } from '../src/utils/getDriveTranslations';
import {
	assertValidProviderRuntimeConfig,
	createProvidersFromRuntimeConfig,
	requiresGoogleAuthForRuntimeConfig,
	runProviderPipeline,
} from '../src/providers';
import { writeLanguageDataFile, writeLocalesFile, writeTranslationFiles } from '../src/utils/fileWriter';
import { readDataJson } from '../src/utils/readDataJson';

vi.mock('@actions/core', () => ({
	getInput: vi.fn(),
	setOutput: vi.fn(),
	setFailed: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
}));
vi.mock('../src/getSpreadSheetData', () => ({
	getSpreadSheetData: vi.fn().mockResolvedValue({}),
}));
vi.mock('../src/utils/getDriveTranslations', () => ({
	manageDriveTranslations: vi.fn().mockResolvedValue({ translations: {} }),
}));
vi.mock('../src/providers', () => ({
	assertValidProviderRuntimeConfig: vi.fn().mockImplementation((config) => config),
	createProvidersFromRuntimeConfig: vi.fn().mockReturnValue({
		inputProvider: { providerId: 'cryptpad-csv' },
	}),
	requiresGoogleAuthForRuntimeConfig: vi.fn().mockReturnValue(false),
	runProviderPipeline: vi.fn().mockResolvedValue({
		translations: { en: { home: { welcome: 'Welcome' } } },
		locales: ['en'],
		localeMapping: { en: 'en' },
		originalLocaleMapping: { en: 'en' },
		inputTableCount: 1,
	}),
}));
vi.mock('../src/utils/fileWriter', () => ({
	writeTranslationFiles: vi.fn(),
	writeLocalesFile: vi.fn(),
	writeLanguageDataFile: vi.fn(),
}));
vi.mock('../src/utils/readDataJson', () => ({
	readDataJson: vi.fn().mockReturnValue(null),
}));

// Import run after mocks are set up so the bottom-level call uses mocked deps
import { run } from '../src/action-entrypoint';

const mockGetInput = vi.mocked(core.getInput);
const mockSetOutput = vi.mocked(core.setOutput);
const mockSetFailed = vi.mocked(core.setFailed);
const mockInfo = vi.mocked(core.info);
const mockGetSpreadSheetData = vi.mocked(getSpreadSheetData);
const mockManageDriveTranslations = vi.mocked(manageDriveTranslations);
const mockAssertValidProviderRuntimeConfig = vi.mocked(assertValidProviderRuntimeConfig);
const mockCreateProvidersFromRuntimeConfig = vi.mocked(createProvidersFromRuntimeConfig);
const mockRequiresGoogleAuthForRuntimeConfig = vi.mocked(requiresGoogleAuthForRuntimeConfig);
const mockRunProviderPipeline = vi.mocked(runProviderPipeline);
const mockWriteTranslationFiles = vi.mocked(writeTranslationFiles);
const mockWriteLocalesFile = vi.mocked(writeLocalesFile);
const mockWriteLanguageDataFile = vi.mocked(writeLanguageDataFile);
const mockReadDataJson = vi.mocked(readDataJson);

/** Default set of valid action inputs */
function makeInputs(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		'google-client-email': 'svc@project.iam.gserviceaccount.com',
		'google-private-key': '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----',
		'google-spreadsheet-id': '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
		'sheet-titles': 'home,about',
		'row-limit': '50',
		'wait-seconds': '2',
		'translations-output-dir': 'translations',
		'locales-output-path': 'src/i18n/locales.ts',
		'data-json-path': 'src/lib/languageData.json',
		'sync-local-changes': 'true',
		'auto-create': 'true',
		'spreadsheet-title': 'my-translations',
		'source-locale': 'en',
		'target-locales': 'de,fr,es',
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	process.env.GITHUB_WORKSPACE = '/workspace';
	mockGetSpreadSheetData.mockResolvedValue({});
	mockManageDriveTranslations.mockResolvedValue({ translations: {} } as Awaited<ReturnType<typeof manageDriveTranslations>>);
	mockRequiresGoogleAuthForRuntimeConfig.mockReturnValue(false);
	mockReadDataJson.mockReturnValue(null);
});

describe('action-entrypoint', () => {
	describe('happy path', () => {
		it('calls getSpreadSheetData with correct options from inputs', async () => {
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockGetSpreadSheetData.mockResolvedValue({ en: {}, de: {} });

			await run();

			expect(mockGetSpreadSheetData).toHaveBeenCalledTimes(1);
			const [sheetTitles, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(sheetTitles).toEqual(['home', 'about']);
			expect(options).toMatchObject({
				rowLimit: 50,
				waitSeconds: 2,
				syncLocalChanges: true,
				spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
				autoCreate: true,
				spreadsheetTitle: 'my-translations',
				sourceLocale: 'en',
				targetLocales: ['de', 'fr', 'es'],
			});
			expect(mockSetFailed).not.toHaveBeenCalled();
		});

		it('logs success with locale count', async () => {
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockGetSpreadSheetData.mockResolvedValue({ en: {}, de: {}, fr: {} });

			await run();

			expect(mockInfo).toHaveBeenCalledWith('✅ Fetched translations for 3 locales');
		});

		it('sets env vars from inputs before calling getSpreadSheetData', async () => {
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(process.env.GOOGLE_CLIENT_EMAIL).toBe('svc@project.iam.gserviceaccount.com');
			expect(process.env.GOOGLE_PRIVATE_KEY).toBe(
				'-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----',
			);
		});

		it('succeeds without google-client-email/google-private-key when GOOGLE_APPLICATION_CREDENTIALS is set (WIF)', async () => {
			process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/wif-creds.json';
			const inputs = makeInputs({ 'google-client-email': '', 'google-private-key': '' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockGetSpreadSheetData.mockResolvedValue({ en: {} });

			await run();

			expect(mockSetFailed).not.toHaveBeenCalled();
			expect(mockInfo).toHaveBeenCalledWith('✅ Fetched translations for 1 locales');
			delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
		});
	});

	describe('error handling', () => {
		it('calls core.setFailed for an invalid row-limit', async () => {
			const inputs = makeInputs({ 'row-limit': '0' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith(
				expect.stringContaining('Invalid row-limit value'),
			);
			expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
		});

		it('calls core.setFailed for an invalid wait-seconds value', async () => {
			const inputs = makeInputs({ 'wait-seconds': 'abc' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith(
				expect.stringContaining('Invalid wait-seconds value'),
			);
			expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
		});

		it('calls core.setFailed with the error message when getSpreadSheetData throws an Error', async () => {
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockGetSpreadSheetData.mockRejectedValue(new Error('API quota exceeded'));

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith('API quota exceeded');
			expect(mockInfo).not.toHaveBeenCalled();
		});

		it('calls core.setFailed with stringified value when a non-Error is thrown', async () => {
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockGetSpreadSheetData.mockRejectedValue('network timeout');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith('network timeout');
		});

		it('calls core.setFailed when neither WIF nor service-account key credentials are provided', async () => {
			delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
			const inputs = makeInputs({ 'google-client-email': '', 'google-private-key': '' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith(
				expect.stringContaining('Authentication required'),
			);
		});

		it('calls core.setFailed in provider mode when selected providers require Google auth but creds are missing', async () => {
			delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
			mockRequiresGoogleAuthForRuntimeConfig.mockReturnValue(true);
			const providerConfig = JSON.stringify({ input: { provider: 'google-sheets' } });
			const inputs = makeInputs({
				'google-client-email': '',
				'google-private-key': '',
				'provider-config': providerConfig,
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith(
				expect.stringContaining('Authentication required for selected provider configuration'),
			);
		});

		it('calls core.setFailed when manageDriveTranslations throws', async () => {
			const inputs = makeInputs({ 'drive-folder-id': 'folder-123' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockManageDriveTranslations.mockRejectedValueOnce(new Error('Drive sync failed'));

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith('Drive sync failed');
		});
	});

	describe('provider mode', () => {
		it('uses provider pipeline when provider-config input is set', async () => {
			const providerConfig = JSON.stringify({
				input: { provider: 'cryptpad-csv', options: { sources: [] } },
			});
			const inputs = makeInputs({
				'provider-config': providerConfig,
				'google-client-email': '',
				'google-private-key': '',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockAssertValidProviderRuntimeConfig).toHaveBeenCalled();
			expect(mockCreateProvidersFromRuntimeConfig).toHaveBeenCalled();
			expect(mockRunProviderPipeline).toHaveBeenCalled();
			expect(mockWriteTranslationFiles).toHaveBeenCalled();
			expect(mockWriteLocalesFile).toHaveBeenCalled();
			expect(mockWriteLanguageDataFile).toHaveBeenCalled();
			expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
		});

		it('allows no-auth provider mode when Google auth is not required', async () => {
			delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
			mockRequiresGoogleAuthForRuntimeConfig.mockReturnValue(false);
			const providerConfig = JSON.stringify({ input: { provider: 'cryptpad-csv', options: { sources: [] } } });
			const inputs = makeInputs({
				'google-client-email': '',
				'google-private-key': '',
				'provider-config': providerConfig,
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).not.toHaveBeenCalled();
			expect(mockRunProviderPipeline).toHaveBeenCalled();
		});

		it('fails when both provider-config and provider-config-path are set', async () => {
			const inputs = makeInputs({
				'provider-config': '{"input":{"provider":"cryptpad-csv","options":{"sources":[]}}}',
				'provider-config-path': 'provider.config.json',
				'google-client-email': '',
				'google-private-key': '',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetFailed).toHaveBeenCalledWith(
				'Use either provider-config or provider-config-path, not both.',
			);
		});

		it('wires asset sync provider and options from action inputs and logs result', async () => {
			const mockAssetSyncProvider = { providerId: 'cryptpad-assets', syncAssets: vi.fn(), capabilities: {} };
			mockCreateProvidersFromRuntimeConfig.mockReturnValueOnce({
				inputProvider: { providerId: 'cryptpad-csv' } as any,
				assetSyncProvider: mockAssetSyncProvider as any,
			});
			mockRunProviderPipeline.mockResolvedValueOnce({
				translations: { en: { home: { welcome: 'Welcome' } } },
				locales: ['en'],
				localeMapping: { en: 'en' },
				originalLocaleMapping: { en: 'en' },
				inputTableCount: 1,
				assetSyncResult: {
					manifestCount: 2,
					downloaded: ['img1.png'],
					updated: [],
					deleted: [],
					skipped: ['img2.png'],
				},
			});

			const providerConfig = JSON.stringify({
				input: { provider: 'cryptpad-csv', options: { sources: [] } },
				assetSync: { provider: 'cryptpad-assets', options: { manifestPath: 'assets.json' } },
			});
			const inputs = makeInputs({
				'provider-config': providerConfig,
				'google-client-email': '',
				'google-private-key': '',
				'asset-target-dir': 'public/assets',
				'asset-delete-missing': 'true',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockRunProviderPipeline).toHaveBeenCalledWith(
				expect.objectContaining({
					assetSyncProvider: mockAssetSyncProvider,
					assetSync: {
						targetDirectory: '/workspace/public/assets',
						deleteMissing: true,
					},
				}),
			);
			expect(mockInfo).toHaveBeenCalledWith(
				expect.stringContaining('Asset sync completed: 2 manifest entries, 1 downloaded, 0 updated, 0 deleted, 1 skipped.'),
			);
		});

		it('uses config-driven assetSync targetDirectory when action input is not provided', async () => {
			const mockAssetSyncProvider = { providerId: 'cryptpad-assets', syncAssets: vi.fn(), capabilities: {} };
			mockCreateProvidersFromRuntimeConfig.mockReturnValueOnce({
				inputProvider: { providerId: 'cryptpad-csv' } as any,
				assetSyncProvider: mockAssetSyncProvider as any,
			});

			const providerConfig = JSON.stringify({
				input: { provider: 'cryptpad-csv', options: { sources: [] } },
				assetSync: {
					provider: 'cryptpad-assets',
					options: { manifestPath: 'assets.json', targetDirectory: 'config/assets', deleteMissing: true },
				},
			});
			const inputs = makeInputs({
				'provider-config': providerConfig,
				'google-client-email': '',
				'google-private-key': '',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockRunProviderPipeline).toHaveBeenCalledWith(
				expect.objectContaining({
					assetSyncProvider: mockAssetSyncProvider,
					assetSync: {
						targetDirectory: '/workspace/config/assets',
						deleteMissing: true,
					},
				}),
			);
		});
	});

	describe('drive-folder mode', () => {
		it('uses manageDriveTranslations when drive-folder-id is provided', async () => {
			const inputs = makeInputs({
				'drive-folder-id': 'folder-123',
				'sync-images': 'true',
				'image-output-path': './public/images',
				'spreadsheet-ids': 'sheet-a,sheet-b',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockManageDriveTranslations.mockResolvedValueOnce({
				translations: { en: {}, de: {} },
				spreadsheetIds: ['sheet-a', 'sheet-b'],
			} as Awaited<ReturnType<typeof manageDriveTranslations>>);

			await run();

			expect(mockManageDriveTranslations).toHaveBeenCalledWith(
				expect.objectContaining({
					driveFolderId: 'folder-123',
					spreadsheetIds: ['sheet-a', 'sheet-b'],
					syncImages: true,
					imageOutputPath: './public/images',
					docTitles: ['home', 'about'],
				}),
			);
			expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
			expect(mockInfo).toHaveBeenCalledWith('✅ Fetched translations for 2 locales');
		});
	});

	describe('sheet-titles parsing', () => {
		it('trims whitespace from each title and filters empty entries', async () => {
			const inputs = makeInputs({ 'sheet-titles': ' home , about , , pricing ' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [sheetTitles] = mockGetSpreadSheetData.mock.calls[0];
			expect(sheetTitles).toEqual(['home', 'about', 'pricing']);
		});

		it('handles a single title without commas', async () => {
			const inputs = makeInputs({ 'sheet-titles': 'landing' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [sheetTitles] = mockGetSpreadSheetData.mock.calls[0];
			expect(sheetTitles).toEqual(['landing']);
		});

		it('uses documented defaults for optional path and title inputs when they are absent', async () => {
			const inputs = makeInputs({
				'translations-output-dir': '',
				'locales-output-path': '',
				'data-json-path': '',
				'row-limit': '',
				'wait-seconds': '',
				'spreadsheet-title': '',
				'source-locale': '',
				'drive-folder-id': '',
				'spreadsheet-ids': '',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.translationsOutputDir).toContain('/workspace/translations');
			expect(options?.localesOutputPath).toContain('/workspace/src/i18n/locales.ts');
			expect(options?.dataJsonPath).toContain('/workspace/src/lib/languageData.json');
			expect(options?.spreadsheetTitle).toBe('google-sheet-translations');
			expect(options?.sourceLocale).toBe('en');
		});
		it('uses manageDriveTranslations when spreadsheet-ids are provided without drive-folder-id', async () => {
			const inputs = makeInputs({
				'drive-folder-id': '',
				'spreadsheet-ids': 'sheet-a,sheet-b',
				'sync-images': 'false',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');
			mockManageDriveTranslations.mockResolvedValueOnce({
				translations: { en: {}, de: {} },
				spreadsheetIds: ['sheet-a', 'sheet-b'],
			} as Awaited<ReturnType<typeof manageDriveTranslations>>);

			await run();

			expect(mockManageDriveTranslations).toHaveBeenCalledWith(
				expect.objectContaining({
					driveFolderId: undefined,
					spreadsheetIds: ['sheet-a', 'sheet-b'],
					syncImages: false,
					imageOutputPath: undefined,
				}),
			);
			expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
		});
	});

	describe('boolean option parsing', () => {
		it('sets syncLocalChanges to false when sync-local-changes input is "false"', async () => {
			const inputs = makeInputs({ 'sync-local-changes': 'false' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.syncLocalChanges).toBe(false);
		});

		it('sets syncLocalChanges to true for any value other than "false"', async () => {
			const inputs = makeInputs({ 'sync-local-changes': 'true' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.syncLocalChanges).toBe(true);
		});

		it('sets autoCreate to false when auto-create input is "false"', async () => {
			const inputs = makeInputs({ 'auto-create': 'false' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.autoCreate).toBe(false);
		});

		it('sets autoCreate to true for any value other than "false"', async () => {
			const inputs = makeInputs({ 'auto-create': 'true' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.autoCreate).toBe(true);
		});

		it('sets autoTranslate to true when auto-translate input is "true"', async () => {
			const inputs = makeInputs({ 'auto-translate': 'true' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.autoTranslate).toBe(true);
		});

		it('sets autoTranslate to false when auto-translate input is absent or "false"', async () => {
			// Missing key → empty string → false
			const inputs = makeInputs();
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.autoTranslate).toBe(false);
		});
	});

	describe('target-locales parsing', () => {
		it('splits and trims the target-locales CSV', async () => {
			const inputs = makeInputs({ 'target-locales': ' de , fr , es , it ' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.targetLocales).toEqual(['de', 'fr', 'es', 'it']);
		});

		it('filters empty entries from target-locales', async () => {
			const inputs = makeInputs({ 'target-locales': 'de,,fr,' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.targetLocales).toEqual(['de', 'fr']);
		});
	});

	describe('outputs', () => {
		it('sets translations-dir as absolute path resolved from workspace', async () => {
			const inputs = makeInputs({ 'translations-output-dir': 'out/translations' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetOutput).toHaveBeenCalledWith(
				'translations-dir',
				'/workspace/out/translations',
			);
		});

		it('sets locales-file as absolute path resolved from workspace', async () => {
			const inputs = makeInputs({ 'locales-output-path': 'src/i18n/locales.ts' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetOutput).toHaveBeenCalledWith(
				'locales-file',
				'/workspace/src/i18n/locales.ts',
			);
		});

		it('sets data-json-file as absolute path resolved from workspace', async () => {
			const inputs = makeInputs({ 'data-json-path': 'src/lib/languageData.json' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetOutput).toHaveBeenCalledWith(
				'data-json-file',
				'/workspace/src/lib/languageData.json',
			);
		});

		it('resolves output paths relative to cwd when GITHUB_WORKSPACE is unset', async () => {
			delete process.env.GITHUB_WORKSPACE;
			const inputs = makeInputs({ 'translations-output-dir': 'translations' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			expect(mockSetOutput).toHaveBeenCalledWith(
				'translations-dir',
				expect.stringContaining('translations'),
			);
		});
	});

	describe('spreadsheet-id handling', () => {
		it('passes spreadsheetId as undefined in options when google-spreadsheet-id is empty', async () => {
			const inputs = makeInputs({ 'google-spreadsheet-id': '' });
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.spreadsheetId).toBeUndefined();
		});

		it('passes spreadsheetId in options when google-spreadsheet-id is provided', async () => {
			const inputs = makeInputs({
				'google-spreadsheet-id': '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
			});
			mockGetInput.mockImplementation((name) => inputs[name] ?? '');

			await run();

			const [, options] = mockGetSpreadSheetData.mock.calls[0];
			expect(options?.spreadsheetId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
		});
	});
});
