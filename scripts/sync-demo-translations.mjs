#!/usr/bin/env node
/**
 * Sync script: pushes landing-page translation keys to the demo Google Spreadsheet.
 *
 * Run as a CI step before `npm run docs:build` so that the demo spreadsheet always
 * reflects the current documentation content, auto-translated into multiple languages.
 *
 * Required environment variables (set as GitHub Secrets):
 *   GOOGLE_CLIENT_EMAIL   – service-account email with edit access to the spreadsheet
 *   GOOGLE_PRIVATE_KEY    – service-account private key
 *
 * The spreadsheet is publicly readable (publicSheet: true in translations.data.ts),
 * but writing requires a service account.
 */

import path from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ── Validate credentials ─────────────────────────────────────────────────────
if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error('[sync] ✗ Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY.');
  console.error('[sync]   Add GitHub Secrets: mail → GOOGLE_CLIENT_EMAIL, private-key → GOOGLE_PRIVATE_KEY, docId → GOOGLE_SPREADSHEET_ID');
  console.error('[sync]   Share the spreadsheet with the service account email (edit access).');
  process.exit(1);
}

// ── Load English source translations ────────────────────────────────────────
const landingPageEn = JSON.parse(
  readFileSync(path.join(repoRoot, 'website/i18n/landingPage.en.json'), 'utf8')
);
const uiEn = JSON.parse(
  readFileSync(path.join(repoRoot, 'website/i18n/ui.en.json'), 'utf8')
);

// ── Build the languageData.json array the package expects ────────────────────
// Format: [ { sheetTitle: { locale: { key: value } } }, … ]
const languageData = [
  { landingPage: { en: landingPageEn } },
  { i18n:        { en: uiEn } },
];

// Write to a temp location; the package reads this to detect local changes
const tmpDir = path.join(repoRoot, 'tmp/sync');
mkdirSync(tmpDir, { recursive: true });

const dataJsonPath = path.join(tmpDir, 'languageData.json');
writeFileSync(dataJsonPath, JSON.stringify(languageData, null, 2), 'utf8');
console.log(`[sync] Wrote source languageData.json → ${dataJsonPath}`);

// ── Import the built package and run authenticated sync ──────────────────────
const { getSpreadSheetData } = await import(
  path.join(repoRoot, 'dist/index.js')
);

const DEMO_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0';
// Use a fresh, empty output dir so isDataJsonNewer() always returns true
const tmpOutDir = path.join(tmpDir, 'out');
mkdirSync(tmpOutDir, { recursive: true });

console.log('[sync] Syncing translations to demo spreadsheet…');
await getSpreadSheetData(['landingPage', 'i18n'], {
  spreadsheetId: DEMO_SPREADSHEET_ID,
  syncLocalChanges: true,
  autoTranslate: true,
  dataJsonPath,
  translationsOutputDir: tmpOutDir,
  localesOutputPath: path.join(tmpDir, 'locales.json'),
  sourceLocale: 'en',
  targetLocales: ['de', 'fr', 'es', 'it', 'pt', 'ja', 'zh'],
  waitSeconds: 2,
});

console.log('[sync] ✓ Keys pushed to the demo spreadsheet with GOOGLETRANSLATE formulas.');
