import { getSpreadSheetData } from '../../src/getSpreadSheetData';
import { writeLocalesFile } from '../../src/utils/fileWriter';
import fs from 'node:fs';

// Mock dependencies
jest.mock('../../src/utils/auth');
jest.mock('../../src/utils/validateEnv');
jest.mock('../../src/utils/syncManager');
jest.mock('../../src/utils/fileWriter');
jest.mock('google-spreadsheet');
jest.mock('node:fs');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockWriteLocalesFile = writeLocalesFile as jest.MockedFunction<typeof writeLocalesFile>;

describe('Locale filtering for non-i18n sheets', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		
		// Mock file system
		mockFs.existsSync.mockReturnValue(false);
		mockFs.mkdirSync.mockReturnValue(undefined);
		mockFs.writeFileSync.mockReturnValue(undefined);

		// Mock validateEnv
		require('../../src/utils/validateEnv').validateEnv.mockReturnValue({
			GOOGLE_SPREADSHEET_ID: 'test-id',
			GOOGLE_CLIENT_EMAIL: 'test@test.com',
			GOOGLE_PRIVATE_KEY: 'test-key'
		});

		// Mock auth
		require('../../src/utils/auth').createAuthClient.mockReturnValue({});

		// Mock sync manager
		require('../../src/utils/syncManager').handleBidirectionalSync.mockResolvedValue({
			shouldRefresh: false,
			hasChanges: false
		});
	});

	it('should only include locales with actual translations in non-i18n sheets', async () => {
		// Mock Google Spreadsheet
		const mockDoc = {
			loadInfo: jest.fn().mockResolvedValue(undefined),
			sheetsByTitle: {
				'content': {
					getRows: jest.fn().mockResolvedValue([
						{
							toObject: () => ({ 
								key: 'hello', 
								en: 'Hello', 
								de: 'Hallo', 
								fr: '' // Empty translation for French
							})
						}
					])
				},
				'i18n': {
					getRows: jest.fn().mockResolvedValue([
						{
							toObject: () => ({ 
								key: 'config', 
								en: 'Config', 
								de: 'Konfiguration', 
								fr: 'Configuration',
								es: 'Configuración' // Spanish only exists in i18n sheet
							})
						}
					])
				}
			}
		};

		require('google-spreadsheet').GoogleSpreadsheet.mockImplementation(() => mockDoc);

		await getSpreadSheetData(['content']);

		// Verify writeLocalesFile was called with only locales that have content in non-i18n sheets
		expect(mockWriteLocalesFile).toHaveBeenCalledWith(
			expect.arrayContaining(['en-GB', 'de-DE']), // Should include normalized locales that have content in 'content' sheet
			expect.any(Object), // locale mapping
			expect.any(String)
		);

		// Verify it excludes locales that only exist in i18n or have no content
		const calledLocales = mockWriteLocalesFile.mock.calls[0][0];
		expect(calledLocales).not.toContain('fr'); // Has header but no content in 'content' sheet
		expect(calledLocales).not.toContain('es'); // Only exists in i18n sheet
	});

	it('should fallback to all locales if no content sheets have translations', async () => {
		// Mock Google Spreadsheet with only i18n sheet having content
		const mockDoc = {
			loadInfo: jest.fn().mockResolvedValue(undefined),
			sheetsByTitle: {
				'empty': {
					getRows: jest.fn().mockResolvedValue([]) // Empty sheet
				},
				'i18n': {
					getRows: jest.fn().mockResolvedValue([
						{
							toObject: () => ({ 
								key: 'config', 
								en: 'Config', 
								de: 'Konfiguration'
							})
						}
					])
				}
			}
		};

		require('google-spreadsheet').GoogleSpreadsheet.mockImplementation(() => mockDoc);

		await getSpreadSheetData(['empty']);

		// Should fallback to all locales found
		expect(mockWriteLocalesFile).toHaveBeenCalledWith(
			expect.arrayContaining(['en-GB', 'de-DE']), // Normalized locales
			expect.any(Object), // locale mapping
			expect.any(String)
		);
	});
});
