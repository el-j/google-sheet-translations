/**
 * Orchestrates the one-way ingestion of a Google Doc into a Google
 * Spreadsheet.
 *
 * Flow:
 *  1. Export the doc as Markdown (falls back to plain text).
 *  2. Parse the content into deterministic `{sheetName, key, value}` entries.
 *  3. Decide what to do:
 *     - **Create**  – no linked spreadsheet exists yet → call `createSpreadsheet`.
 *     - **Refresh** – a linked spreadsheet exists AND the doc's `modifiedTime`
 *       is newer than `lastIngestedAt` AND `updateMode === 'refresh-if-newer'`
 *       → push base-locale changes via `updateSpreadsheetWithLocalChanges`.
 *     - **Skip**    – spreadsheet is up-to-date; nothing to do.
 *
 * Docs are **never** written back to — they are read-only feeder sources.
 * After ingestion the auto-translate (GOOGLETRANSLATE formula) mechanism in
 * the spreadsheet takes over for all other locales, exactly as for any other
 * normal spreadsheet update.
 */

import { GoogleAuth } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import type { GoogleEnvVars, TranslationData } from '../types';
import type { DriveDocFile } from './driveDocScanner';
import type { DocManifestEntry } from './driveProjectIndex';
import { parseDocContent, slugifyKey } from './docParser';
import type { DocKeyStrategy, ParsedDocEntry } from './docParser';
import { createSpreadsheet } from './spreadsheetCreator';
import { createAuthClient } from './auth';
import { updateSpreadsheetWithLocalChanges } from './spreadsheetUpdater';

// ── Public types ──────────────────────────────────────────────────────────────

/** Controls when an existing linked spreadsheet is refreshed from the doc. */
export type DocUpdateMode = 'create-only' | 'refresh-if-newer';

export interface DocIngesterOptions {
  /**
   * Target locales for GOOGLETRANSLATE formulas when **creating** a new
   * spreadsheet from the doc.  Defaults to `['de','fr','es','it','pt','ja','zh']`.
   */
  targetLocales?: string[];
  /**
   * Key-derivation strategy.  Defaults to `'heading'`.
   * See `docParser.ts` for full semantics.
   */
  keyStrategy?: DocKeyStrategy;
  /**
   * `'create-only'` (default) — only acts when no spreadsheet is linked yet.
   * `'refresh-if-newer'` — also refreshes base-locale content when the doc's
   *   `modifiedTime` is newer than the manifest's `lastIngestedAt`.
   */
  updateMode?: DocUpdateMode;
  /**
   * Google service-account credentials.
   * Falls back to `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` env vars.
   */
  credentials?: GoogleEnvVars;
  /**
   * Existing manifest entry for this doc (from the previous run's manifest).
   * Used to compare timestamps and retrieve the `linkedSpreadsheetId`.
   */
  existingEntry?: DocManifestEntry;
  /** Seconds to wait between write API calls (passed to the spreadsheet updater). */
  waitSeconds?: number;
}

export interface DocIngestResult {
  /** `'created'` | `'refreshed'` | `'skipped'` */
  action: 'created' | 'refreshed' | 'skipped';
  /** Updated manifest entry for this doc */
  entry: DocManifestEntry;
}

// ── Drive export ──────────────────────────────────────────────────────────────

async function getDriveExportToken(credentials?: GoogleEnvVars): Promise<string> {
  const clientEmail =
    credentials?.GOOGLE_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    credentials?.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials required: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY',
    );
  }

  const normalizedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: normalizedKey },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token as string;
}

/**
 * Exports a Google Doc via the Drive API.
 * Attempts Markdown first; falls back to plain text.
 *
 * @param docId       - Google Drive file ID of the document.
 * @param credentials - Optional service-account credentials.
 */
export async function exportDoc(
  docId: string,
  credentials?: GoogleEnvVars,
): Promise<string> {
  const token = await getDriveExportToken(credentials);
  const base = `https://www.googleapis.com/drive/v3/files/${docId}/export`;

  // Try Markdown first
  const mdRes = await fetch(
    `${base}?mimeType=text%2Fmarkdown`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (mdRes.ok) return mdRes.text();

  // Fall back to plain text
  const txtRes = await fetch(
    `${base}?mimeType=text%2Fplain`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (txtRes.ok) return txtRes.text();

  const errText = await txtRes.text();
  throw new Error(
    `Failed to export doc ${docId}: HTTP ${txtRes.status} – ${errText}`,
  );
}

// ── Data converters ───────────────────────────────────────────────────────────

/**
 * Converts parsed doc entries to a flat `seedKeys` map used by
 * `createSpreadsheet`.
 *
 * Keys are namespaced as `sheetName.key` to avoid collisions across sheets.
 * Duplicate keys within the same sheet are disambiguated with a `_N` suffix.
 *
 * @example
 * entriesToSeedKeys([{ sheetName: 'hero', key: 'title', value: 'Hello' }])
 * // → { 'hero.title': 'Hello' }
 */
export function entriesToSeedKeys(
  entries: ParsedDocEntry[],
): Record<string, string> {
  const keys: Record<string, string> = {};
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const base = `${entry.sheetName}.${entry.key}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    const finalKey = count > 1 ? `${base}_${count}` : base;
    keys[finalKey] = entry.value;
  }

  return keys;
}

/**
 * Converts parsed doc entries to `TranslationData` format:
 * `locale → sheetName → key → value`.
 *
 * Duplicate keys within a sheet are disambiguated with a `_N` suffix,
 * matching the behaviour of `entriesToSeedKeys`.
 */
export function entriesToTranslationData(
  entries: ParsedDocEntry[],
  locale: string,
): TranslationData {
  const data: TranslationData = {};
  data[locale] = {};

  const counts = new Map<string, number>();

  for (const entry of entries) {
    const sheetName = entry.sheetName;
    const entryKey = entry.key;

    // Guard against prototype-polluting property names.
    // slugifyKey() already prevents these in normal parsing paths, but we
    // defend explicitly here since entries may come from external callers.
    if (
      sheetName === '__proto__' ||
      sheetName === 'constructor' ||
      sheetName === 'prototype' ||
      entryKey === '__proto__' ||
      entryKey === 'constructor' ||
      entryKey === 'prototype'
    ) {
      continue;
    }

    if (!data[locale][sheetName]) {
      (data[locale] as Record<string, Record<string, string>>)[sheetName] = {};
    }

    const base = `${sheetName}::${entryKey}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    const finalKey = count > 1 ? `${entryKey}_${count}` : entryKey;

    (data[locale][sheetName] as Record<string, string>)[finalKey] = entry.value;
  }

  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strips the `_[lang]` suffix from a doc name to get a clean project title. */
function docTitle(name: string): string {
  return (
    name.replace(/_[a-zA-Z]{2,3}(?:[-_][a-zA-Z]{2,4})?$/, '').trim() || name
  );
}

// ── Main ingestion function ───────────────────────────────────────────────────

/**
 * Ingests a single Google Doc into a Google Spreadsheet.
 *
 * **Create mode** (default): if no spreadsheet is linked yet, a new one is
 * created via `createSpreadsheet` with the doc's base locale and the parsed
 * keys as seed content.  The spreadsheet then becomes the source of truth and
 * uses the normal GOOGLETRANSLATE mechanism for all other locales.
 *
 * **Refresh mode** (`updateMode: 'refresh-if-newer'`): if a spreadsheet is
 * already linked and the doc's `modifiedTime` is newer than `lastIngestedAt`,
 * only the base-locale values are updated (new keys are added; existing keys
 * in other locales are left untouched).
 *
 * **Skip**: if the spreadsheet is up-to-date, no changes are made.
 *
 * Docs are **never** modified — the flow is strictly one-way.
 *
 * @param docFile  - Drive metadata for the source document.
 * @param options  - Ingestion options (targetLocales, keyStrategy, etc.)
 */
export async function ingestDoc(
  docFile: DriveDocFile,
  options: DocIngesterOptions = {},
): Promise<DocIngestResult> {
  const {
    targetLocales,
    keyStrategy = 'heading',
    updateMode = 'create-only',
    credentials,
    existingEntry,
    waitSeconds = 1,
  } = options;

  const sourceLocale = docFile.sourceLocale ?? 'en';

  // Build the baseline manifest entry (enriched below)
  const entry: DocManifestEntry = existingEntry
    ? { ...existingEntry, modifiedTime: docFile.modifiedTime }
    : {
        id: docFile.id,
        name: docFile.name,
        folderPath: docFile.folderPath,
        generatedFromDoc: true as const,
        sourceLocale,
        modifiedTime: docFile.modifiedTime,
      };

  const hasLinkedSheet = !!entry.linkedSpreadsheetId;

  // Determine whether a refresh is warranted
  const shouldRefresh =
    updateMode === 'refresh-if-newer' &&
    hasLinkedSheet &&
    !!docFile.modifiedTime &&
    !!existingEntry?.lastIngestedAt &&
    new Date(docFile.modifiedTime) > new Date(existingEntry.lastIngestedAt);

  if (hasLinkedSheet && !shouldRefresh) {
    console.log(
      `[docIngester] Skipping "${docFile.name}" – linked spreadsheet is already up-to-date.`,
    );
    return { action: 'skipped', entry };
  }

  // ── Export and parse ────────────────────────────────────────────────────────
  console.log(
    `[docIngester] Exporting doc "${docFile.name}" (id: ${docFile.id})…`,
  );
  const content = await exportDoc(docFile.id, credentials);

  const sheetBaseName = slugifyKey(docTitle(docFile.name)) || 'content';
  const entries = parseDocContent(content, {
    strategy: keyStrategy,
    defaultSheetName: sheetBaseName,
  });

  if (entries.length === 0) {
    console.warn(
      `[docIngester] Doc "${docFile.name}" produced no translation entries – skipping.`,
    );
    return { action: 'skipped', entry };
  }

  // ── Create mode ─────────────────────────────────────────────────────────────
  if (!hasLinkedSheet) {
    const authClient = createAuthClient();
    const seedKeys = entriesToSeedKeys(entries);
    const title = docTitle(docFile.name);

    const { spreadsheetId } = await createSpreadsheet(authClient, {
      title,
      sourceLocale,
      targetLocales,
      seedKeys,
    });

    entry.linkedSpreadsheetId = spreadsheetId;
    entry.lastIngestedAt = new Date().toISOString();

    console.log(
      `[docIngester] Created spreadsheet ${spreadsheetId} from doc "${docFile.name}".`,
    );
    return { action: 'created', entry };
  }

  // ── Refresh mode ────────────────────────────────────────────────────────────
  const authClient = createAuthClient();
  const spreadsheetId = entry.linkedSpreadsheetId as string;
  const doc = new GoogleSpreadsheet(spreadsheetId, authClient);
  await doc.loadInfo();

  // Push only base-locale changes; leave other locales untouched
  const changes = entriesToTranslationData(entries, sourceLocale);
  await updateSpreadsheetWithLocalChanges(
    doc,
    changes,
    waitSeconds,
    false, // autoTranslate – formulas already exist in non-base columns
    {},
    false,
  );

  entry.lastIngestedAt = new Date().toISOString();

  console.log(
    `[docIngester] Refreshed spreadsheet ${spreadsheetId} from doc "${docFile.name}".`,
  );
  return { action: 'refreshed', entry };
}
