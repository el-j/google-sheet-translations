import { getMultipleSpreadSheetsData } from '../src/getMultipleSpreadSheetsData';
import { getSpreadSheetData } from '../src/getSpreadSheetData';

jest.mock('../src/getSpreadSheetData', () => ({
	getSpreadSheetData: jest.fn(),
	default: jest.fn(),
}));

const mockGetSpreadSheetData = getSpreadSheetData as jest.MockedFunction<typeof getSpreadSheetData>;

describe('getMultipleSpreadSheetsData', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('falls back to single spreadsheet when no spreadsheetIds provided', async () => {
		const data = { en: { home: { hello: 'Hello' } } };
		mockGetSpreadSheetData.mockResolvedValueOnce(data);

		const result = await getMultipleSpreadSheetsData(['home'], { spreadsheetId: 'sheet1' });

		expect(mockGetSpreadSheetData).toHaveBeenCalledTimes(1);
		expect(mockGetSpreadSheetData).toHaveBeenCalledWith(['home'], { spreadsheetId: 'sheet1' });
		expect(result).toEqual(data);
	});

	test('falls back to single spreadsheet when spreadsheetIds is empty array', async () => {
		mockGetSpreadSheetData.mockResolvedValueOnce({});

		const result = await getMultipleSpreadSheetsData(['home'], { spreadsheetIds: [] });

		expect(mockGetSpreadSheetData).toHaveBeenCalledTimes(1);
		expect(result).toEqual({});
	});

	test('handles single-item spreadsheetIds array', async () => {
		const data = { en: { home: { title: 'Title' } } };
		mockGetSpreadSheetData.mockResolvedValueOnce(data);

		const result = await getMultipleSpreadSheetsData(['home'], { spreadsheetIds: ['sheetA'] });

		expect(mockGetSpreadSheetData).toHaveBeenCalledTimes(1);
		expect(mockGetSpreadSheetData).toHaveBeenCalledWith(['home'], { spreadsheetId: 'sheetA' });
		expect(result).toEqual(data);
	});

	test('merges two spreadsheets with different locales', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({ en: { home: { hello: 'Hello' } } })
			.mockResolvedValueOnce({ fr: { home: { hello: 'Bonjour' } } });

		const result = await getMultipleSpreadSheetsData(['home'], {
			spreadsheetIds: ['sheet1', 'sheet2'],
		});

		expect(result).toEqual({
			en: { home: { hello: 'Hello' } },
			fr: { home: { hello: 'Bonjour' } },
		});
	});

	test('deep-merges two spreadsheets with same locale — later-wins by default', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({ en: { home: { title: 'First', subtitle: 'Sub' } } })
			.mockResolvedValueOnce({ en: { home: { title: 'Second', footer: 'Footer' } } });

		const result = await getMultipleSpreadSheetsData(['home'], {
			spreadsheetIds: ['sheet1', 'sheet2'],
		});

		expect(result).toEqual({
			en: { home: { title: 'Second', subtitle: 'Sub', footer: 'Footer' } },
		});
	});

	test('mergeStrategy later-wins overrides with last value', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({ en: { nav: { back: 'Back' } } })
			.mockResolvedValueOnce({ en: { nav: { back: 'Go Back' } } });

		const result = await getMultipleSpreadSheetsData(['nav'], {
			spreadsheetIds: ['s1', 's2'],
			mergeStrategy: 'later-wins',
		});

		expect(result.en.nav.back).toBe('Go Back');
	});

	test('mergeStrategy first-wins keeps first occurrence of each key', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({ en: { nav: { back: 'Back' } } })
			.mockResolvedValueOnce({ en: { nav: { back: 'Go Back', home: 'Home' } } });

		const result = await getMultipleSpreadSheetsData(['nav'], {
			spreadsheetIds: ['s1', 's2'],
			mergeStrategy: 'first-wins',
		});

		expect(result.en.nav.back).toBe('Back');
		expect(result.en.nav.home).toBe('Home');
	});

	test('passes per-spreadsheet options correctly — each call gets spreadsheetId: id', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({ en: { home: { a: '1' } } })
			.mockResolvedValueOnce({ en: { home: { b: '2' } } });

		await getMultipleSpreadSheetsData(['home'], {
			spreadsheetIds: ['idOne', 'idTwo'],
			publicSheet: true,
		});

		expect(mockGetSpreadSheetData).toHaveBeenNthCalledWith(1, ['home'], {
			spreadsheetId: 'idOne',
			publicSheet: true,
		});
		expect(mockGetSpreadSheetData).toHaveBeenNthCalledWith(2, ['home'], {
			spreadsheetId: 'idTwo',
			publicSheet: true,
		});
	});

	test('logs progress messages during fetch', async () => {
		mockGetSpreadSheetData
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({});

		await getMultipleSpreadSheetsData(undefined, { spreadsheetIds: ['a', 'b'] });

		expect(console.log).toHaveBeenCalledWith(
			'[getMultipleSpreadSheetsData] Fetching 2 spreadsheets...',
		);
		expect(console.log).toHaveBeenCalledWith('[getMultipleSpreadSheetsData] (1/2) "a"...');
		expect(console.log).toHaveBeenCalledWith('[getMultipleSpreadSheetsData] (2/2) "b"...');
	});
});
