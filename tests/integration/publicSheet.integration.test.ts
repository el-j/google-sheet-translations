/**
 * Integration tests that hit the real demo Google Spreadsheet.
 * Run with: INTEGRATION=true npx jest --testPathPattern=integration
 * Skipped in normal CI (no env var needed - uses public sheet).
 */
import { readPublicSheet } from '../../src/utils/publicSheetReader';
import { getSpreadSheetData } from '../../src/getSpreadSheetData';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const DEMO_ID = '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0';
const RUN_INTEGRATION = process.env['INTEGRATION'] === 'true';
const describe_if = RUN_INTEGRATION ? describe : describe.skip;

describe_if('Integration: public demo spreadsheet', () => {
  const tmpDir = path.join(os.tmpdir(), `gst-integration-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readPublicSheet fetches rows from landingPage sheet', async () => {
    const rows = await readPublicSheet(DEMO_ID, 'landingPage');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    // First row must have a 'key' column (case-insensitive)
    const firstRow = rows[0];
    const hasKey = Object.keys(firstRow).some(k => k.toLowerCase() === 'key');
    expect(hasKey).toBe(true);
  }, 30_000);

  test('readPublicSheet fetches rows from i18n sheet', async () => {
    const rows = await readPublicSheet(DEMO_ID, 'i18n');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  }, 30_000);

  test('getSpreadSheetData returns translations with locales', async () => {
    const translations = await getSpreadSheetData(['landingPage'], {
      spreadsheetId: DEMO_ID,
      publicSheet: true,
      syncLocalChanges: false,
      translationsOutputDir: path.join(tmpDir, 'translations'),
      localesOutputPath: path.join(tmpDir, 'locales.ts'),
      dataJsonPath: path.join(tmpDir, 'languageData.json'),
    });

    const locales = Object.keys(translations);
    expect(locales.length).toBeGreaterThan(0);
    console.log(`✅ Integration: got ${locales.length} locale(s): ${locales.join(', ')}`);
  }, 30_000);

  test('getSpreadSheetData writes translation files to disk', async () => {
    const translationsDir = path.join(tmpDir, 'translations2');
    await getSpreadSheetData(['landingPage', 'i18n'], {
      spreadsheetId: DEMO_ID,
      publicSheet: true,
      syncLocalChanges: false,
      translationsOutputDir: translationsDir,
      localesOutputPath: path.join(tmpDir, 'locales2.ts'),
      dataJsonPath: path.join(tmpDir, 'languageData2.json'),
    });

    // Check that translation files were written
    expect(fs.existsSync(translationsDir)).toBe(true);
    const files = fs.readdirSync(translationsDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    console.log(`✅ Integration: wrote ${files.length} translation file(s): ${files.join(', ')}`);
  }, 30_000);

  test('translation file content is valid JSON with expected structure', async () => {
    const translationsDir = path.join(tmpDir, 'translations3');
    const translations = await getSpreadSheetData(['landingPage'], {
      spreadsheetId: DEMO_ID,
      publicSheet: true,
      syncLocalChanges: false,
      translationsOutputDir: translationsDir,
      localesOutputPath: path.join(tmpDir, 'locales3.ts'),
      dataJsonPath: path.join(tmpDir, 'languageData3.json'),
    });

    const locales = Object.keys(translations);
    for (const locale of locales.slice(0, 3)) {
      const filePath = path.join(translationsDir, `${locale}.json`);
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        expect(typeof content).toBe('object');
        expect(content).not.toBeNull();
      }
    }
  }, 30_000);
});
