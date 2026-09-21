import fs from 'node:fs';
import path from 'node:path';
import {
  writeTranslationFiles,
  writeLocalesFile,
  writeLanguageDataFile,
} from '../../src/utils/fileWriter';
import type { TranslationData } from '../../src/types';

// Mock fs module
vi.mock('node:fs');
const mockFs = fs as Mocked<typeof fs>;

describe('fileWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
  });

  describe('writeTranslationFiles', () => {
    it('should create directory and write translation files for each locale', () => {
      const translations: TranslationData = {
        en: { sheet1: { hello: 'Hello', world: 'World' } },
        de: { sheet1: { hello: 'Hallo', world: 'Welt' } },
      };
      const locales = ['en', 'de'];
      const outputDir = 'translations';

      writeTranslationFiles(translations, locales, outputDir);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'translations/en.json',
        JSON.stringify(translations.en, null, 2),
        'utf8',
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'translations/de.json',
        JSON.stringify(translations.de, null, 2),
        'utf8',
      );
    });

    it('should skip empty translations and log warnings', () => {
      const translations: TranslationData = {
        en: { sheet1: { hello: 'Hello' } },
        de: {},
      };
      const locales = ['en', 'de'];
      const outputDir = 'translations';

      // Mock console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      writeTranslationFiles(translations, locales, outputDir);

      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('No translations found for locale "de"');

      consoleSpy.mockRestore();
    });

    it('should throw when the translations directory cannot be created', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('permission denied');
      });

      expect(() =>
        writeTranslationFiles({ en: { sheet1: { hello: 'Hello' } } }, ['en'], 'translations'),
      ).toThrow('Failed to create translations directory');
    });

    it('should log an error when writing a translation file fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      writeTranslationFiles({ en: { sheet1: { hello: 'Hello' } } }, ['en'], 'translations');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write translation file for locale "en"'),
        expect.any(Error),
      );
    });
  });

  describe('writeLocalesFile', () => {
    it('should create directory and write locales file', () => {
      const locales = ['en', 'de', 'fr'];
      const localeMapping = { en: 'en', de: 'de', fr: 'fr' };
      const outputPath = 'src/i18n/locales.ts';

      writeLocalesFile(locales, localeMapping, outputPath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('src/i18n', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('export const locales = ["en","de","fr"];'),
        'utf8',
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('export const localeHeaderMapping'),
        'utf8',
      );
    });

    it('should filter out empty locale strings', () => {
      const locales = ['en', '', 'de', '   ', 'fr'];
      const localeMapping = { en: 'en', de: 'de', fr: 'fr' };
      const outputPath = 'src/i18n/locales.ts';

      writeLocalesFile(locales, localeMapping, outputPath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('export const locales = ["en","de","fr"];'),
        'utf8',
      );
    });

    it('should handle empty locales array', () => {
      const locales: string[] = [];
      const localeMapping = {};
      const outputPath = 'src/i18n/locales.ts';

      writeLocalesFile(locales, localeMapping, outputPath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('export const locales = [];'),
        'utf8',
      );
    });

    it('should throw when the locales directory cannot be created', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('permission denied');
      });

      expect(() => writeLocalesFile(['en'], { en: 'en' }, 'src/i18n/locales.ts')).toThrow(
        'Failed to create directory',
      );
    });

    it('should throw when writing locales.ts fails', () => {
      mockFs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      expect(() => writeLocalesFile(['en'], { en: 'en' }, 'src/i18n/locales.ts')).toThrow(
        'Failed to write locales file',
      );
    });
  });

  describe('writeTranslationFiles - path traversal prevention', () => {
    it('should sanitize a locale with path traversal characters to use underscores', () => {
      const dangerousLocale = '../../../dangerous';
      const translations: TranslationData = {
        [dangerousLocale]: { sheet1: { hello: 'Hello' } },
      };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      writeTranslationFiles(translations, [dangerousLocale], 'translations');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('translations', '_________dangerous.json'),
        expect.any(String),
        'utf8',
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('unsafe characters'));
      consoleSpy.mockRestore();
    });

    it('should write en-gb locale unchanged (only valid chars)', () => {
      const translations: TranslationData = {
        'en-gb': { sheet1: { hello: 'Hello' } },
      };
      vi.spyOn(console, 'log').mockImplementation(() => {});

      writeTranslationFiles(translations, ['en-gb'], 'translations');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('translations', 'en-gb.json'),
        expect.any(String),
        'utf8',
      );
    });

    it('should lowercase an uppercase locale like ZH-CN to zh-cn', () => {
      const translations: TranslationData = {
        'ZH-CN': { sheet1: { hello: '你好' } },
      };
      vi.spyOn(console, 'log').mockImplementation(() => {});

      writeTranslationFiles(translations, ['ZH-CN'], 'translations');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('translations', 'zh-cn.json'),
        expect.any(String),
        'utf8',
      );
    });
  });

  describe('writeLanguageDataFile', () => {
    it('should create directory and write language data file', () => {
      const translations: TranslationData = {
        en: { sheet1: { hello: 'Hello' } },
        de: { sheet1: { hello: 'Hallo' } },
      };
      const locales = ['en', 'de'];
      const outputPath = 'src/lib/languageData.json';

      writeLanguageDataFile(translations, locales, outputPath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('src/lib', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"en"'),
        'utf8',
      );
    });

    it('should throw when the language data directory cannot be created', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('permission denied');
      });

      expect(() =>
        writeLanguageDataFile(
          { en: { sheet1: { hello: 'Hello' } } },
          ['en'],
          'src/lib/languageData.json',
        ),
      ).toThrow('Failed to create directory');
    });

    it('should throw when writing languageData.json fails', () => {
      mockFs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      expect(() =>
        writeLanguageDataFile(
          { en: { sheet1: { hello: 'Hello' } } },
          ['en'],
          'src/lib/languageData.json',
        ),
      ).toThrow('Failed to write language data file');
    });
  });
});
