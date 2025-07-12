import { normalizeConfig, type SpreadsheetOptions } from '../../src/utils/configurationHandler';
import path from 'node:path';

describe('configurationHandler', () => {
	describe('normalizeConfig', () => {
		it('should apply default values when no options provided', () => {
			const config = normalizeConfig();
			
			expect(config.rowLimit).toBe(100);
			expect(config.waitSeconds).toBe(1);
			expect(config.dataJsonPath).toBe(path.join(process.cwd(), "src/lib/languageData.json"));
			expect(config.localesOutputPath).toBe("src/i18n/locales.ts");
			expect(config.translationsOutputDir).toBe("translations");
			expect(config.syncLocalChanges).toBe(true);
			expect(config.autoTranslate).toBe(false);
		});

		it('should override defaults with provided options', () => {
			const options: SpreadsheetOptions = {
				rowLimit: 200,
				waitSeconds: 3,
				dataJsonPath: 'custom/path/data.json',
				localesOutputPath: 'custom/locales.ts',
				translationsOutputDir: 'custom/translations',
				syncLocalChanges: false,
				autoTranslate: true,
			};

			const config = normalizeConfig(options);
			
			expect(config.rowLimit).toBe(200);
			expect(config.waitSeconds).toBe(3);
			expect(config.dataJsonPath).toBe('custom/path/data.json');
			expect(config.localesOutputPath).toBe('custom/locales.ts');
			expect(config.translationsOutputDir).toBe('custom/translations');
			expect(config.syncLocalChanges).toBe(false);
			expect(config.autoTranslate).toBe(true);
		});

		it('should handle partial options correctly', () => {
			const options: SpreadsheetOptions = {
				waitSeconds: 2,
				autoTranslate: true,
			};

			const config = normalizeConfig(options);
			
			expect(config.waitSeconds).toBe(2);
			expect(config.autoTranslate).toBe(true);
			// Defaults should be preserved for other options
			expect(config.rowLimit).toBe(100);
			expect(config.syncLocalChanges).toBe(true);
		});
	});
});
