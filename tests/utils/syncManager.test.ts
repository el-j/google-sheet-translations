import { handleBidirectionalSync } from '../../src/utils/syncManager';
import { mock } from 'jest-mock-extended';
import type { GoogleSpreadsheet } from 'google-spreadsheet';

jest.mock('../../src/utils/readDataJson');
jest.mock('../../src/utils/isDataJsonNewer');
jest.mock('../../src/utils/dataConverter/findLocalChanges');
jest.mock('../../src/utils/spreadsheetUpdater');

import { readDataJson } from '../../src/utils/readDataJson';
import { isDataJsonNewer } from '../../src/utils/isDataJsonNewer';
import { findLocalChanges } from '../../src/utils/dataConverter/findLocalChanges';
import { updateSpreadsheetWithLocalChanges } from '../../src/utils/spreadsheetUpdater';

const mockReadDataJson = readDataJson as jest.MockedFunction<typeof readDataJson>;
const mockIsDataJsonNewer = isDataJsonNewer as jest.MockedFunction<typeof isDataJsonNewer>;
const mockFindLocalChanges = findLocalChanges as jest.MockedFunction<typeof findLocalChanges>;
const mockUpdateSpreadsheet = updateSpreadsheetWithLocalChanges as jest.MockedFunction<typeof updateSpreadsheetWithLocalChanges>;

describe('handleBidirectionalSync', () => {
	const mockDoc = mock<GoogleSpreadsheet>();

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('should return { shouldRefresh: false, hasChanges: false } and not call updateSpreadsheetWithLocalChanges when localData and spreadsheetData have the same keys', async () => {
		const sharedData = {
			'en': { 'home': { 'hello': 'Hello' } }
		};

		mockReadDataJson.mockReturnValue(sharedData);
		mockIsDataJsonNewer.mockReturnValue(true);
		// No differences found between local and spreadsheet data
		mockFindLocalChanges.mockReturnValue({});

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			sharedData,
			0
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	test('should return early with no changes when syncLocalChanges is false', async () => {
		mockReadDataJson.mockReturnValue({ 'en': { 'home': { 'hello': 'Hello' } } });

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			false,
			false,
			{},
			0
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	test('should return early with no changes when localData is null', async () => {
		mockReadDataJson.mockReturnValue(null);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			{},
			0
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	// ── cleanPush ─────────────────────────────────────────────────────────────

	test('cleanPush: should push ALL localData without calling findLocalChanges', async () => {
		const localData = { 'en': { 'home': { 'hello': 'Hello', 'bye': 'Goodbye' } } };
		mockReadDataJson.mockReturnValue(localData);
		// Timestamp guard returns false – but cleanPush should bypass it
		mockIsDataJsonNewer.mockReturnValue(false);
		mockUpdateSpreadsheet.mockResolvedValue(undefined);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			false, // syncLocalChanges=false – cleanPush overrides this
			false,
			{},
			0,
			{},
			false,
			true, // cleanPush
		);

		expect(result).toEqual({ shouldRefresh: true, hasChanges: true });
		// findLocalChanges must NOT have been called – full data is used directly
		expect(mockFindLocalChanges).not.toHaveBeenCalled();
		// updateSpreadsheet must have been called with the full localData
		expect(mockUpdateSpreadsheet).toHaveBeenCalledWith(
			mockDoc,
			localData,
			0,
			false,
			{},
			false,
		);
	});

	test('cleanPush: should bypass isDataJsonNewer timestamp check', async () => {
		const localData = { 'en': { 'shop': { 'cart': 'Cart' } } };
		mockReadDataJson.mockReturnValue(localData);
		// Normally this would prevent the sync
		mockIsDataJsonNewer.mockReturnValue(false);
		mockUpdateSpreadsheet.mockResolvedValue(undefined);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			{},
			0,
			{},
			false,
			true, // cleanPush
		);

		expect(result.hasChanges).toBe(true);
		expect(mockIsDataJsonNewer).not.toHaveBeenCalled();
	});

	test('cleanPush: should return no changes when localData is null', async () => {
		mockReadDataJson.mockReturnValue(null);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			false,
			false,
			{},
			0,
			{},
			false,
			true, // cleanPush
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	test('cleanPush: false falls back to normal incremental sync behaviour', async () => {
		const localData = { 'en': { 'home': { 'hello': 'Hello' } } };
		const spreadsheetData = { 'en': { 'home': { 'hello': 'Hello' } } };
		mockReadDataJson.mockReturnValue(localData);
		mockIsDataJsonNewer.mockReturnValue(true);
		// No differences
		mockFindLocalChanges.mockReturnValue({});

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			spreadsheetData,
			0,
			{},
			false,
			false, // cleanPush = false → normal path
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockFindLocalChanges).toHaveBeenCalledWith(localData, spreadsheetData);
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	// ── missing sheets ──────────────────────────────────────────────────────────

	test('missing sheets: should trigger sync when localData has a sheet absent from spreadsheetData', async () => {
		// localData has a "nav" sheet; spreadsheetData has no sheets at all (fresh spreadsheet)
		const localData = { 'en': { 'nav': { 'home': 'Home' } } };
		mockReadDataJson.mockReturnValue(localData);
		// Timestamp guard returns false (simulates equal CI checkout timestamps)
		mockIsDataJsonNewer.mockReturnValue(false);
		mockFindLocalChanges.mockReturnValue(localData);
		mockUpdateSpreadsheet.mockResolvedValue(undefined);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			{}, // spreadsheetData is empty — "nav" sheet is missing
			0,
		);

		expect(result).toEqual({ shouldRefresh: true, hasChanges: true });
		// findLocalChanges must have been called to build the diff
		expect(mockFindLocalChanges).toHaveBeenCalledWith(localData, {});
		// updateSpreadsheetWithLocalChanges must have been called
		expect(mockUpdateSpreadsheet).toHaveBeenCalled();
	});

	test('missing sheets: should NOT trigger sync when syncLocalChanges is false', async () => {
		const localData = { 'en': { 'nav': { 'home': 'Home' } } };
		mockReadDataJson.mockReturnValue(localData);
		mockIsDataJsonNewer.mockReturnValue(false);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			false, // syncLocalChanges = false
			false,
			{}, // spreadsheetData is empty
			0,
		);

		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	test('missing sheets: should NOT trigger sync when all local sheets already exist in spreadsheet', async () => {
		const localData = { 'en': { 'nav': { 'home': 'Home' } } };
		const spreadsheetData = { 'en': { 'nav': { 'home': 'Home' } } };
		mockReadDataJson.mockReturnValue(localData);
		mockIsDataJsonNewer.mockReturnValue(false);
		// All keys are the same → no diff
		mockFindLocalChanges.mockReturnValue({});

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			spreadsheetData, // "nav" already exists in spreadsheet
			0,
		);

		// hasMissingSheets=false + isDataJsonNewer=false → no sync
		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});

	test('missing sheets: i18n sheet in localData should not trigger sync on its own', async () => {
		// localData only has the reserved "i18n" sheet — that sheet must be skipped
		const localData = { 'en': { 'i18n': { 'en': 'English' } } };
		mockReadDataJson.mockReturnValue(localData);
		mockIsDataJsonNewer.mockReturnValue(false);

		const result = await handleBidirectionalSync(
			mockDoc,
			'path/to/languageData.json',
			'translations/',
			true,
			false,
			{}, // no spreadsheet data
			0,
		);

		// i18n is reserved; having only i18n locally should NOT trigger sync
		expect(result).toEqual({ shouldRefresh: false, hasChanges: false });
		expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
	});
