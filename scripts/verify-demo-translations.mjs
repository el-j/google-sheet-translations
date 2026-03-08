#!/usr/bin/env node
/**
 * Verification script: reads back translation keys from the demo spreadsheet
 * (via the public gviz endpoint, no credentials needed) and confirms that the
 * English keys pushed by sync-demo-translations.mjs are present.
 *
 * Run automatically after sync in the docs CI pipeline.
 * Exit code 0 = OK, exit code 1 = verification failed.
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DEMO_SPREADSHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ||
  '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0';

// ── Expected keys (source of truth) ─────────────────────────────────────────
const landingPageKeys = Object.keys(
  JSON.parse(readFileSync(path.join(repoRoot, 'website/i18n/landingPage.en.json'), 'utf8')),
);
const uiKeys = Object.keys(
  JSON.parse(readFileSync(path.join(repoRoot, 'website/i18n/ui.en.json'), 'utf8')),
);

// ── Import built package ──────────────────────────────────────────────────────
const { getSpreadSheetData } = await import(path.join(repoRoot, 'dist/index.js'));

console.log(`[verify] Reading back translations from spreadsheet ${DEMO_SPREADSHEET_ID}…`);

let translations;
try {
  translations = await getSpreadSheetData(['landingPage', 'i18n'], {
    spreadsheetId: DEMO_SPREADSHEET_ID,
    publicSheet: true,
    syncLocalChanges: false,
    translationsOutputDir: path.join(repoRoot, 'tmp/verify/out'),
    localesOutputPath: path.join(repoRoot, 'tmp/verify/locales.json'),
    dataJsonPath: path.join(repoRoot, 'tmp/verify/languageData.json'),
  });
} catch (err) {
  console.error('[verify] ✗ Failed to read back translations:', err.message);
  process.exit(1);
}

// ── Check that "en" locale exists with expected keys ─────────────────────────
const locales = Object.keys(translations);
console.log(`[verify] Locales returned: ${locales.join(', ') || '(none)'}`);

if (locales.length === 0) {
  console.error('[verify] ✗ No locales found in the spreadsheet.');
  process.exit(1);
}

// Find English (exact "en" or anything starting with "en")
const enLocale = locales.find((l) => l === 'en' || l.startsWith('en-'));
if (!enLocale) {
  console.error(`[verify] ✗ No English locale found. Available: ${locales.join(', ')}`);
  process.exit(1);
}

const enData = translations[enLocale];

// ── Verify landingPage keys ───────────────────────────────────────────────────
const enLanding = enData?.landingPage ?? {};
const missingLanding = landingPageKeys.filter((k) => !(k in enLanding));
if (missingLanding.length > 0) {
  console.error(`[verify] ✗ Missing landingPage keys in locale "${enLocale}": ${missingLanding.join(', ')}`);
  process.exit(1);
}
console.log(`[verify] ✓ landingPage: all ${landingPageKeys.length} keys present in "${enLocale}"`);

// ── Verify i18n/ui keys ───────────────────────────────────────────────────────
const enUi = enData?.i18n ?? {};
const missingUi = uiKeys.filter((k) => !(k in enUi));
if (missingUi.length > 0) {
  console.error(`[verify] ✗ Missing i18n keys in locale "${enLocale}": ${missingUi.join(', ')}`);
  process.exit(1);
}
console.log(`[verify] ✓ i18n: all ${uiKeys.length} keys present in "${enLocale}"`);

// ── Report available locales ──────────────────────────────────────────────────
const localeCount = locales.length;
const sheetCount = Object.keys(enData ?? {}).length;
console.log(`[verify] ✓ Spreadsheet has ${localeCount} locale(s) and ${sheetCount} sheet(s) — verification passed.`);
