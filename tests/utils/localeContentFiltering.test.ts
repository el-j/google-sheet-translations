import { getSpreadSheetData } from '../../src/getSpreadSheetData';
import { writeLocalesFile } from '../../src/utils/fileWriter';
import fs from 'node:fs';
import { validateEnv } from '../../src/utils/validateEnv';
import { createAuthClient } from '../../src/utils/auth';
import { handleBidirectionalSync } from '../../src/utils/syncManager';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// Mock dependencies
vi.mock('../../src/utils/auth');
vi.mock('../../src/utils/validateEnv');
vi.mock('../../src/utils/syncManager');
vi.mock('../../src/utils/fileWriter');
vi.mock('google-spreadsheet');
vi.mock('node:fs');

const mockFs = fs as Mocked<typeof fs>;
const mockWriteLocalesFile = writeLocalesFile as MockedFunction<typeof writeLocalesFile>;

describe('Locale filtering for non-i18n sheets', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.GOOGLE_SPREADSHEET_ID = 'test-id';
		mockFs.existsSync.mockReturnValue(false);
		mockFs.mkdirSync.mockReturnValue(undefined);
		mockFs.writeFileSync.mockReturnValue(undefined);

		// Mock validateEnv
		vi.mocked(validateEnv).mockReturnValue({
			GOOGLE_SPREADSHEET_ID: 'test-id',
			GOOGLE_CLIENT_EMAIL: 'test@test.com',
			GOOGLE_PRIVATE_KEY: 'test-key'
		});

		// Mock auth
		vi.mocked(createAuthClient).mockReturnValue({} as any);

		// Mock sync manager
		vi.mocked(handleBidirectionalSync).mockResolvedValue({
			shouldRefresh: false,
			hasChanges: false
		});
	});

	afterEach(() => {
		delete process.env.GOOGLE_SPREADSHEET_ID;
	});

	it('should only include locales with actual translations in non-i18n sheets', async () => {
		// Mock Google Spreadsheet
		const mockDoc = {
			loadInfo: vi.fn().mockResolvedValue(undefined),
			sheetsByTitle: {
				'content': {
					getRows: vi.fn().mockResolvedValue([
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
					getRows: vi.fn().mockResolvedValue([
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

		vi.mocked(GoogleSpreadsheet).mockImplementation(class { constructor() { return mockDoc as any; } } as any);

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
			loadInfo: vi.fn().mockResolvedValue(undefined),
			sheetsByTitle: {
				'empty': {
					getRows: vi.fn().mockResolvedValue([]) // Empty sheet
				},
				'i18n': {
					getRows: vi.fn().mockResolvedValue([
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

		vi.mocked(GoogleSpreadsheet).mockImplementation(class { constructor() { return mockDoc as any; } } as any);

		await getSpreadSheetData(['empty']);

		// Should fallback to all locales found
		expect(mockWriteLocalesFile).toHaveBeenCalledWith(
			expect.arrayContaining(['en-GB', 'de-DE']), // Normalized locales
			expect.any(Object), // locale mapping
			expect.any(String)
		);
	});
});

