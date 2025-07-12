import fs from 'node:fs';
import path from 'node:path';
import { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from '../../src/utils/fileWriter';
import type { TranslationData } from '../../src/types';

// Mock fs module
jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('fileWriter', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFs.existsSync.mockReturnValue(false);
	});

	describe('writeTranslationFiles', () => {
		it('should create directory and write translation files for each locale', () => {
			const translations: TranslationData = {
				'en': { 'sheet1': { 'hello': 'Hello', 'world': 'World' } },
				'de': { 'sheet1': { 'hello': 'Hallo', 'world': 'Welt' } }
			};
			const locales = ['en', 'de'];
			const outputDir = 'translations';

			writeTranslationFiles(translations, locales, outputDir);

			expect(mockFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
			expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				'translations/en.json',
				JSON.stringify(translations.en, null, 2),
				'utf8'
			);
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				'translations/de.json',
				JSON.stringify(translations.de, null, 2),
				'utf8'
			);
		});

		it('should skip empty translations and log warnings', () => {
			const translations: TranslationData = {
				'en': { 'sheet1': { 'hello': 'Hello' } },
				'de': {}
			};
			const locales = ['en', 'de'];
			const outputDir = 'translations';

			// Mock console.warn
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

			writeTranslationFiles(translations, locales, outputDir);

			expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
			expect(consoleSpy).toHaveBeenCalledWith('No translations found for locale "de"');

			consoleSpy.mockRestore();
		});
	});

	describe('writeLocalesFile', () => {
		it('should create directory and write locales file', () => {
			const locales = ['en', 'de', 'fr'];
			const outputPath = 'src/i18n/locales.ts';

			writeLocalesFile(locales, outputPath);

			expect(mockFs.mkdirSync).toHaveBeenCalledWith('src/i18n', { recursive: true });
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				outputPath,
				'export const locales = ["en","de","fr"];\nexport default locales;',
				'utf8'
			);
		});

		it('should filter out empty locale strings', () => {
			const locales = ['en', '', 'de', '   ', 'fr'];
			const outputPath = 'src/i18n/locales.ts';

			writeLocalesFile(locales, outputPath);

			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				outputPath,
				'export const locales = ["en","de","fr"];\nexport default locales;',
				'utf8'
			);
		});

		it('should handle empty locales array', () => {
			const locales: string[] = [];
			const outputPath = 'src/i18n/locales.ts';

			writeLocalesFile(locales, outputPath);

			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				outputPath,
				'export const locales = [];\nexport default locales;',
				'utf8'
			);
		});
	});

	describe('writeLanguageDataFile', () => {
		it('should create directory and write language data file', () => {
			const translations: TranslationData = {
				'en': { 'sheet1': { 'hello': 'Hello' } },
				'de': { 'sheet1': { 'hello': 'Hallo' } }
			};
			const locales = ['en', 'de'];
			const outputPath = 'src/lib/languageData.json';

			writeLanguageDataFile(translations, locales, outputPath);

			expect(mockFs.mkdirSync).toHaveBeenCalledWith('src/lib', { recursive: true });
			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				outputPath,
				expect.stringContaining('"en"'),
				'utf8'
			);
		});
	});
});
