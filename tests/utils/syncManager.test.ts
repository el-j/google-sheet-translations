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
});
