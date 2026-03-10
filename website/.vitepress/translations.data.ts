import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const DEMO_SPREADSHEET_ID = '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0';
const DEMO_SHEETS = ['landingPage', 'ui', 'i18n'];

export default {
  async load() {
    try {
      // Import from the pre-built dist (docs:build always runs after npm run build)
      const { getSpreadSheetData, getTranslationSummary, getLocaleDisplayName } = await import(
        path.join(repoRoot, 'dist/index.js')
      );

      const translations = await getSpreadSheetData(DEMO_SHEETS, {
        spreadsheetId: DEMO_SPREADSHEET_ID,
        publicSheet: true,
        syncLocalChanges: false,
        translationsOutputDir: path.join(__dirname, '../public/translations'),
        localesOutputPath: path.join(__dirname, '../public/translations/locales.json'),
        dataJsonPath: path.join(__dirname, '../public/translations/languageData.json'),
      });

      // Summarise for the live-demo page (uses package utility)
      const locales = Object.keys(translations);
      const summary = getTranslationSummary(translations);

      // Pre-compute locale display names so UI components don't need to
      // re-implement the i18n-sheet lookup logic (uses package utility)
      const localeNames: Record<string, string> = {};
      for (const locale of locales) {
        localeNames[locale] = getLocaleDisplayName(locale, translations);
      }

      return { locales, localeNames, summary, fetchedAt: new Date().toISOString(), translations };
    } catch (err) {
      console.warn('[translations.data] Could not fetch demo translations:', err);
      return { locales: [], localeNames: {}, summary: {}, fetchedAt: null, translations: {}, error: String(err) };
    }
  },
};
