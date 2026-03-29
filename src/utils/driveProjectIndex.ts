import fs from 'node:fs';
import path from 'node:path';
import type { TranslationData } from '../types';

/**
 * Metadata for a single spreadsheet in the project manifest.
 */
export interface SpreadsheetManifestEntry {
  /** Google Spreadsheet file ID */
  id: string;
  /** Human-readable name of the spreadsheet */
  name: string;
  /** Relative path within the Drive folder (e.g. "subproject/translations") */
  folderPath: string;
  /** Sheet / tab names that were processed */
  sheets: string[];
  /** ISO timestamp of last modification reported by Drive */
  modifiedTime?: string;
  /**
   * Local subdirectory used for output when `flatten: false`.
   * Undefined when `flatten: true` (all locales go to the root outputDirectory).
   */
  outputSubDirectory?: string;
}

/**
 * Project-level manifest written to disk after every `manageDriveTranslations` run.
 * Acts as a single source of truth for the i18n project layout.
 */
export interface DriveProjectManifest {
  /** Manifest format version — increment when the shape changes */
  version: '1';
  /** ISO timestamp when this manifest was last generated */
  generatedAt: string;
  /** User-defined project name (e.g. "my-app-i18n") */
  projectName?: string;
  /** Project domain or site URL for reference */
  domain?: string;
  /** Sorted list of all locale codes available across all spreadsheets */
  locales: string[];
  /** Primary / source locale (e.g. "en") */
  defaultLocale?: string;
  /** Every spreadsheet that was processed in the last run */
  spreadsheets: SpreadsheetManifestEntry[];
  /** Base local directory where translation files are written */
  outputDirectory: string;
  /**
   * Whether translation files use a flat layout (all locales in one dir)
   * or a per-spreadsheet subdirectory layout.
   */
  flatten: boolean;
  /** Any additional user-defined metadata */
  projectMetadata?: Record<string, unknown>;
}

export interface BuildManifestOptions {
  translations: TranslationData;
  spreadsheets: SpreadsheetManifestEntry[];
  outputDirectory: string;
  flatten: boolean;
  projectName?: string;
  domain?: string;
  defaultLocale?: string;
  projectMetadata?: Record<string, unknown>;
}

/**
 * Builds a DriveProjectManifest from the current run's state.
 * Does NOT write to disk — call `writeManifest` for that.
 */
export function buildManifest(options: BuildManifestOptions): DriveProjectManifest {
  const locales = Object.keys(options.translations).sort();
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    projectName: options.projectName,
    domain: options.domain,
    locales,
    defaultLocale: options.defaultLocale,
    spreadsheets: options.spreadsheets,
    outputDirectory: options.outputDirectory,
    flatten: options.flatten,
    projectMetadata: options.projectMetadata,
  };
}

/**
 * Writes the project manifest JSON to disk.
 * Creates parent directories as needed.
 *
 * @param manifest  - The manifest to serialise
 * @param manifestPath - Absolute or relative path for the output file
 */
export function writeManifest(manifest: DriveProjectManifest, manifestPath: string): void {
  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[driveProjectIndex] Wrote project manifest → ${manifestPath}`);
}
