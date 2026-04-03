import * as core from '@actions/core';
import { getSpreadSheetData } from '../src/getSpreadSheetData';

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

// Import run after mocks are set up so the bottom-level call uses mocked deps
import { run } from '../src/action-entrypoint';

const mockGetInput = vi.mocked(core.getInput);
const mockSetOutput = vi.mocked(core.setOutput);
const mockSetFailed = vi.mocked(core.setFailed);
const mockInfo = vi.mocked(core.info);
const mockGetSpreadSheetData = vi.mocked(getSpreadSheetData);

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
	});

	describe('error handling', () => {
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
