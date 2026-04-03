import path from 'node:path';
import type { TranslationData } from '../types';
import type { MultiSpreadsheetOptions } from '../getMultipleSpreadSheetsData';
import { getMultipleSpreadSheetsData } from '../getMultipleSpreadSheetsData';
import { getSpreadSheetData } from '../getSpreadSheetData';
import { mergeMultipleTranslationData } from './multiSpreadsheetMerger';
import type { ScanDriveFolderOptions } from './driveFolderScanner';
import { scanDriveFolderForSpreadsheets } from './driveFolderScanner';
import type { DriveImageSyncOptions, DriveImageSyncResult } from './driveImageSync';
import { syncDriveImages } from './driveImageSync';
import type { DocManifestEntry, DriveProjectManifest, SpreadsheetManifestEntry } from './driveProjectIndex';
import { buildManifest, readManifest, writeManifest } from './driveProjectIndex';
import type { ScanDriveFolderForDocsOptions } from './driveDocScanner';
import { scanDriveFolderForDocs } from './driveDocScanner';
import type { DocIngesterOptions, DocUpdateMode } from './docIngester';
import { ingestDoc } from './docIngester';
import type { DocKeyStrategy } from './docParser';
import { buildGoogleAuth, createAuthClient, normalizePrivateKey } from './auth';
import { createSpreadsheet } from './spreadsheetCreator';

export interface GoogleDriveManagerOptions {
  /**
   * Google Drive folder ID to scan for spreadsheets and/or images.
   * If provided without explicit spreadsheetIds, the folder is scanned
   * automatically for spreadsheet files.
   */
  driveFolderId?: string;

  /**
   * When true, scans driveFolderId for all Google Spreadsheet files and
   * fetches translations from each. Requires driveFolderId. (default: true when driveFolderId set)
   */
  scanForSpreadsheets?: boolean;

  /**
   * Explicit list of spreadsheet IDs to fetch from.
   * If provided together with driveFolderId + scanForSpreadsheets, the
   * explicit list is merged with the discovered ones (deduped).
   */
  spreadsheetIds?: string[];

  /**
   * Optional filter: only process spreadsheets whose name matches this pattern.
   * Useful when the Drive folder contains non-translation spreadsheets.
   * @example /^translations-/i
   */
  spreadsheetNameFilter?: RegExp;

  /**
   * When true, also sync images from driveFolderId to imageOutputPath.
   * Requires driveFolderId. (default: false)
   */
  syncImages?: boolean;

  /**
   * Local directory to download Drive images into.
   * Required when syncImages: true.
   * @example './src/assets/remote-images'
   */
  imageOutputPath?: string;

  /**
   * Image sync options passed to syncDriveImages (mimeTypes, concurrency, etc.)
   */
  imageSyncOptions?: Partial<DriveImageSyncOptions>;

  /**
   * Options forwarded to getMultipleSpreadSheetsData (rowLimit, waitSeconds,
   * translationsOutputDir, autoTranslate, etc.)
   */
  translationOptions?: MultiSpreadsheetOptions;

  /** Sheet names to fetch from each discovered spreadsheet */
  docTitles?: string[];

  /**
   * When `false`, each spreadsheet writes translations to its own subdirectory
   * inside `translationsOutputDir`, named after the spreadsheet (sanitized).
   * Example with `flatten: false`:
   *   `translations/app-i18n/en.json`
   *   `translations/marketing/de.json`
   * When `true` (default), all spreadsheets are merged into a flat set:
   *   `translations/en.json`
   */
  flatten?: boolean;

  /**
   * Write an `i18n-manifest.json` index file after each run.
   * Default: `true` when `driveFolderId` is set, `false` otherwise.
   */
  createManifest?: boolean;

  /**
   * Path for the manifest file.
   * Default: `path.join(translationsOutputDir, 'i18n-manifest.json')`
   */
  manifestPath?: string;

  /** Human-readable project name stored in the manifest */
  projectName?: string;

  /** Site domain / URL stored in the manifest */
  domain?: string;

  /** Primary locale code stored in the manifest (e.g. "en") */
  defaultLocale?: string;

  /** Arbitrary metadata stored in the manifest */
  projectMetadata?: Record<string, unknown>;

  // ── Google Docs ingestion ───────────────────────────────────────────────────

  /**
   * When `true`, scans `driveFolderId` for Google Docs and ingests them as
   * one-way base-language sources for translation spreadsheets.
   * Requires `driveFolderId`. (default: `false`)
   */
  scanForDocs?: boolean;

  /**
   * Only process Docs whose names match this pattern.
   * @example /^content_/
   */
  docNameFilter?: RegExp;

  /**
   * Fallback source locale when a Doc filename contains no `_[lang]` suffix.
   * @example 'en'
   */
  docSourceLocale?: string;

  /**
   * Key-derivation strategy for parsing exported Doc content.
   * - `'heading'` (default) – H1 = sheet, H2 = key.
   * - `'marker'` – explicit `[[key:path.to.key]]` annotations.
   * - `'numbered'` – sequential `item_1`, `item_2`, … keys.
   */
  docKeyStrategy?: DocKeyStrategy;

  /**
   * Controls when an existing linked spreadsheet is refreshed from the doc.
   * - `'create-only'` (default) – only creates if no spreadsheet is linked yet.
   * - `'refresh-if-newer'` – also refreshes when doc `modifiedTime` is newer
   *   than the manifest's `lastIngestedAt`.
   */
  docUpdateMode?: DocUpdateMode;

  /**
   * Target locales for GOOGLETRANSLATE formulas when **creating** a new
   * spreadsheet from a doc.
   * Defaults to the standard set defined in `spreadsheetCreator.ts`.
   */
  docTargetLocales?: string[];
}

export interface GoogleDriveManagerResult {
  translations: TranslationData;
  /** List of spreadsheet IDs that were processed */
  spreadsheetIds: string[];
  /** Image sync result (only present if syncImages: true) */
  imageSync?: DriveImageSyncResult;
  /** Project manifest written during this run (only present when `createManifest: true`) */
  manifest?: DriveProjectManifest;
  /**
   * Results from doc ingestion (only present when `scanForDocs: true`).
   * One entry per discovered doc, recording the action taken.
   */
  docIngestResults?: Array<{ docName: string; action: 'created' | 'refreshed' | 'skipped' }>;
}

/** Turns a spreadsheet name / ID into a safe directory segment */
function sanitizeFolderName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'sheet'
  );
}

/**
 * Moves a Google Spreadsheet (identified by `spreadsheetId`) into the given
 * Drive folder by calling the Drive Files API with the `drive.file` scope.
 *
 * The service-account must have been granted edit access to the target folder.
 * Uses the same credential detection order as `createAuthClient` (WIF first,
 * then `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`).
 */
async function moveSpreadsheetToFolder(
  spreadsheetId: string,
  folderId: string,
): Promise<void> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  let credentials: { client_email: string; private_key: string } | undefined;
  if (clientEmail && rawPrivateKey) {
    credentials = { client_email: clientEmail, private_key: normalizePrivateKey(rawPrivateKey) };
  }
  // When no key credentials are present, buildGoogleAuth falls back to WIF / ADC
  // (GOOGLE_APPLICATION_CREDENTIALS), which google-auth-library picks up automatically.

  const driveAuth = buildGoogleAuth(
    ['https://www.googleapis.com/auth/drive.file'],
    credentials,
  );

  // Step 1: fetch current parents so we can remove them after the move
  const fileRes = await driveAuth.request<{ parents?: string[] }>({
    url: `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
    params: { fields: 'parents' },
  });
  const currentParents = (fileRes.data.parents ?? []).join(',');

  // Step 2: move the file by adding the target folder and removing previous parents
  await driveAuth.request({
    url: `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
    method: 'PATCH',
    params: {
      addParents: folderId,
      ...(currentParents ? { removeParents: currentParents } : {}),
      fields: 'id,parents',
    },
    data: {},
  });
}

/**
 * Top-level "headless CMS bridge" function.
 *
 * Scans a Google Drive folder for spreadsheets, fetches all translations,
 * optionally syncs images, and returns merged results.
 *
 * @example
 * const result = await manageDriveTranslations({
 *   driveFolderId: 'your-folder-id',
 *   scanForSpreadsheets: true,
 *   spreadsheetNameFilter: /^i18n-/,
 *   syncImages: true,
 *   imageOutputPath: './src/assets/remote-images',
 *   translationOptions: {
 *     autoTranslate: false,
 *     translationsOutputDir: './src/translations'
 *   }
 * });
 * console.log(result.translations);
 * console.log(result.imageSync?.downloaded.length + ' images downloaded');
 */
export async function manageDriveTranslations(
  options: GoogleDriveManagerOptions,
): Promise<GoogleDriveManagerResult> {
  const {
    driveFolderId,
    scanForSpreadsheets = true,
    spreadsheetIds: explicitIds = [],
    spreadsheetNameFilter,
    syncImages = false,
    imageOutputPath,
    imageSyncOptions,
    translationOptions = {},
    docTitles,
    flatten = true,
    createManifest,
    manifestPath,
    projectName,
    domain,
    defaultLocale,
    projectMetadata,
    // Doc ingestion options
    scanForDocs = false,
    docNameFilter,
    docSourceLocale,
    docKeyStrategy,
    docUpdateMode,
    docTargetLocales,
  } = options;

  if (syncImages && !imageOutputPath) {
    throw new Error(
      '[manageDriveTranslations] imageOutputPath is required when syncImages is true',
    );
  }

  const shouldCreateManifest = createManifest ?? driveFolderId !== undefined;

  // Scan Drive folder for spreadsheets if requested
  const discoveredIds: string[] = [];
  const discoveredNames: Map<string, string> = new Map();
  const discoveredFolderPaths: Map<string, string> = new Map();
  const discoveredModifiedTimes: Map<string, string> = new Map();

  if (driveFolderId && scanForSpreadsheets) {
    const scanOptions: ScanDriveFolderOptions = { folderId: driveFolderId };
    const discovered = await scanDriveFolderForSpreadsheets(scanOptions);
    console.log(
      `[manageDriveTranslations] Found ${discovered.length} spreadsheet(s) in Drive folder`,
    );

    for (const file of discovered) {
      discoveredIds.push(file.id);
      discoveredNames.set(file.id, file.name);
      discoveredFolderPaths.set(file.id, file.folderPath);
      if (file.modifiedTime) discoveredModifiedTimes.set(file.id, file.modifiedTime);
    }
  }

  // Merge discovered IDs with explicit IDs (dedup)
  const allIds = [...new Set([...discoveredIds, ...explicitIds])];

  // Apply spreadsheetNameFilter (only filter discovered ones; explicit IDs pass through)
  const filteredIds = spreadsheetNameFilter
    ? allIds.filter((id) => {
        const name = discoveredNames.get(id);
        if (!name) return true;
        return spreadsheetNameFilter.test(name);
      })
    : allIds;

  // ── Drive folder bootstrap ──────────────────────────────────────────────────
  // When the Drive folder is empty (no spreadsheets discovered or provided) and
  // autoCreate is enabled, create a new spreadsheet and move it into the folder
  // automatically — no manual "move to folder" step required.
  if (driveFolderId && filteredIds.length === 0 && translationOptions.autoCreate !== false) {
    console.log(
      `[manageDriveTranslations] Drive folder "${driveFolderId}" contains no spreadsheets. ` +
      `Bootstrapping a new spreadsheet…`,
    );
    const authClient = createAuthClient();
    const bootstrapTitle = translationOptions.spreadsheetTitle ?? 'google-sheet-translations';
    const created = await createSpreadsheet(authClient, {
      title: bootstrapTitle,
      sourceLocale: translationOptions.sourceLocale,
      targetLocales: translationOptions.targetLocales,
    });
    console.log(`[manageDriveTranslations] ✅ Spreadsheet created: ${created.url}`);

    try {
      await moveSpreadsheetToFolder(created.spreadsheetId, driveFolderId);
      console.log(
        `[manageDriveTranslations] ✅ Spreadsheet moved into Drive folder "${driveFolderId}"`,
      );
    } catch (moveErr) {
      console.warn(
        `[manageDriveTranslations] ⚠️  Could not move spreadsheet into Drive folder:`,
        (moveErr as Error).message,
      );
      console.warn(
        `   Please move spreadsheet "${created.spreadsheetId}" into folder "${driveFolderId}" manually.`,
      );
    }

    filteredIds.push(created.spreadsheetId);
    discoveredNames.set(created.spreadsheetId, bootstrapTitle);
    discoveredFolderPaths.set(created.spreadsheetId, '');
  }

  // Fetch translations
  let translations: TranslationData;
  const spreadsheetEntries: SpreadsheetManifestEntry[] = [];
  const baseOutputDir = translationOptions.translationsOutputDir ?? 'translations';

  if (!flatten) {
    // Per-spreadsheet mode: write each to its own subdirectory
    const { mergeStrategy = 'later-wins', ...baseOptions } = translationOptions;
    const perResults: TranslationData[] = [];

    for (const id of filteredIds) {
      const name = discoveredNames.get(id) ?? id;
      const subDir = sanitizeFolderName(name);
      const subOutputDir = path.join(baseOutputDir, subDir);

      console.log(
        `[manageDriveTranslations] (flatten: false) Fetching "${name}" → ${subOutputDir}`,
      );

      const result = await getSpreadSheetData(docTitles, {
        ...baseOptions,
        spreadsheetId: id,
        translationsOutputDir: subOutputDir,
      });

      perResults.push(result);
      spreadsheetEntries.push({
        id,
        name,
        folderPath: discoveredFolderPaths.get(id) ?? '',
        sheets: docTitles ?? [],
        modifiedTime: discoveredModifiedTimes.get(id),
        outputSubDirectory: subDir,
      });
    }

    translations = mergeMultipleTranslationData(perResults, mergeStrategy);
  } else {
    // Flat (merged) mode — existing behaviour
    translations = await getMultipleSpreadSheetsData(docTitles, {
      ...translationOptions,
      spreadsheetIds: filteredIds.length > 0 ? filteredIds : undefined,
    });

    for (const id of filteredIds) {
      spreadsheetEntries.push({
        id,
        name: discoveredNames.get(id) ?? id,
        folderPath: discoveredFolderPaths.get(id) ?? '',
        sheets: docTitles ?? [],
        modifiedTime: discoveredModifiedTimes.get(id),
      });
    }
  }

  // Optionally sync images
  let imageSync: DriveImageSyncResult | undefined;
  if (syncImages && driveFolderId && imageOutputPath) {
    imageSync = await syncDriveImages({
      ...imageSyncOptions,
      folderId: driveFolderId,
      outputPath: imageOutputPath,
    });
  }

  // Write project manifest
  let manifest: DriveProjectManifest | undefined;
  let docIngestResults: Array<{ docName: string; action: 'created' | 'refreshed' | 'skipped' }> | undefined;
  const docEntries: DocManifestEntry[] = [];

  const resolvedManifestPath =
    manifestPath ?? path.join(baseOutputDir, 'i18n-manifest.json');

  // ── Doc ingestion ───────────────────────────────────────────────────────────
  if (driveFolderId && scanForDocs) {
    // Load the previous manifest so we can compare timestamps and find existing doc entries.
    const previousManifest = readManifest(resolvedManifestPath);

    const docScanOptions: ScanDriveFolderForDocsOptions = {
      folderId: driveFolderId,
    };
    const discoveredDocs = await scanDriveFolderForDocs(docScanOptions);
    console.log(
      `[manageDriveTranslations] Found ${discoveredDocs.length} doc(s) in Drive folder`,
    );

    docIngestResults = [];

    for (const docFile of discoveredDocs) {
      // Apply optional name filter
      if (docNameFilter && !docNameFilter.test(docFile.name)) continue;

      // Apply fallback source locale when filename inference yields nothing
      if (!docFile.sourceLocale && docSourceLocale) {
        docFile.sourceLocale = docSourceLocale;
      }

      // Find the previous manifest entry for this doc (if any)
      const existingEntry = previousManifest?.docs?.find(
        (d) => d.id === docFile.id,
      );

      const ingesterOptions: DocIngesterOptions = {
        targetLocales: docTargetLocales,
        keyStrategy: docKeyStrategy,
        updateMode: docUpdateMode,
        existingEntry,
        waitSeconds: translationOptions.waitSeconds,
      };

      try {
        const result = await ingestDoc(docFile, ingesterOptions);
        docEntries.push(result.entry);
        docIngestResults.push({ docName: docFile.name, action: result.action });
      } catch (err) {
        console.error(
          `[manageDriveTranslations] Failed to ingest doc "${docFile.name}":`,
          err,
        );
        // Keep the previous entry intact so we don't lose the linkedSpreadsheetId
        if (existingEntry) docEntries.push(existingEntry);
      }
    }
  }

  if (shouldCreateManifest) {
    manifest = buildManifest({
      translations,
      spreadsheets: spreadsheetEntries,
      outputDirectory: baseOutputDir,
      flatten,
      projectName,
      domain,
      defaultLocale,
      projectMetadata,
      docs: docEntries.length > 0 ? docEntries : undefined,
    });
    writeManifest(manifest, resolvedManifestPath);
  }

  return { translations, spreadsheetIds: filteredIds, imageSync, manifest, docIngestResults };
}
