## Goal
Create `src/utils/driveProjectIndex.ts` — a new utility that builds and writes a project-level manifest/index file for Drive-based i18n projects, plus full tests.

## Context
- Working directory: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- Existing pattern: `fs.mkdirSync(dir, { recursive: true })` before writing any file (see `fileWriter.ts`)
- Console logging pattern: `[moduleName] message` prefix (see `getDriveTranslations.ts`)
- All source files are TypeScript in `src/utils/`
- Tests use Jest + jest.mock('node:fs') + `mockFs.existsSync.mockReturnValue(false)` pattern

## Steps

### 1. Create `src/utils/driveProjectIndex.ts`

```typescript
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
```

### 2. Create `tests/utils/driveProjectIndex.test.ts`

Cover:
- `buildManifest` — correct fields, sorted locales, generatedAt is ISO string, undefined fields omitted
- `writeManifest` — calls mkdirSync + writeFileSync, correct path, correct content

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, writeManifest } from '../../src/utils/driveProjectIndex';
import type { BuildManifestOptions, DriveProjectManifest } from '../../src/utils/driveProjectIndex';
import type { TranslationData } from '../../src/types';

jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

const TRANSLATIONS: TranslationData = {
  fr: { home: { title: 'Accueil' } },
  en: { home: { title: 'Home' } },
  de: { home: { title: 'Startseite' } },
};

const SPREADSHEETS = [
  { id: 'ss-1', name: 'app-i18n', folderPath: '', sheets: ['home'], modifiedTime: '2026-01-01T00:00:00.000Z' },
  { id: 'ss-2', name: 'marketing', folderPath: 'campaigns', sheets: ['landing'] },
];

describe('buildManifest', () => {
  it('includes version "1"', () => {
    const manifest = buildManifest({ translations: TRANSLATIONS, spreadsheets: SPREADSHEETS, outputDirectory: './translations', flatten: true });
    expect(manifest.version).toBe('1');
  });

  it('sets generatedAt to a valid ISO timestamp', () => {
    const before = Date.now();
    const manifest = buildManifest({ translations: TRANSLATIONS, spreadsheets: SPREADSHEETS, outputDirectory: './t', flatten: true });
    const after = Date.now();
    const ts = new Date(manifest.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('sorts locales alphabetically', () => {
    const manifest = buildManifest({ translations: TRANSLATIONS, spreadsheets: SPREADSHEETS, outputDirectory: './t', flatten: true });
    expect(manifest.locales).toEqual(['de', 'en', 'fr']);
  });

  it('returns empty locales array when translations is empty', () => {
    const manifest = buildManifest({ translations: {}, spreadsheets: [], outputDirectory: './t', flatten: true });
    expect(manifest.locales).toEqual([]);
  });

  it('includes optional fields when provided', () => {
    const manifest = buildManifest({
      translations: TRANSLATIONS,
      spreadsheets: SPREADSHEETS,
      outputDirectory: './out',
      flatten: false,
      projectName: 'my-app',
      domain: 'https://example.com',
      defaultLocale: 'en',
      projectMetadata: { owner: 'team-a' },
    });
    expect(manifest.projectName).toBe('my-app');
    expect(manifest.domain).toBe('https://example.com');
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.projectMetadata).toEqual({ owner: 'team-a' });
  });

  it('leaves optional fields undefined when not provided', () => {
    const manifest = buildManifest({ translations: {}, spreadsheets: [], outputDirectory: './t', flatten: true });
    expect(manifest.projectName).toBeUndefined();
    expect(manifest.domain).toBeUndefined();
    expect(manifest.defaultLocale).toBeUndefined();
    expect(manifest.projectMetadata).toBeUndefined();
  });

  it('reflects flatten: false in the manifest', () => {
    const manifest = buildManifest({ translations: {}, spreadsheets: [], outputDirectory: './t', flatten: false });
    expect(manifest.flatten).toBe(false);
  });

  it('includes spreadsheets array verbatim', () => {
    const manifest = buildManifest({ translations: TRANSLATIONS, spreadsheets: SPREADSHEETS, outputDirectory: './t', flatten: true });
    expect(manifest.spreadsheets).toBe(SPREADSHEETS);
  });

  it('sets outputDirectory', () => {
    const manifest = buildManifest({ translations: {}, spreadsheets: [], outputDirectory: './custom/path', flatten: true });
    expect(manifest.outputDirectory).toBe('./custom/path');
  });
});

describe('writeManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
  });

  const MANIFEST: DriveProjectManifest = {
    version: '1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    locales: ['de', 'en'],
    spreadsheets: [],
    outputDirectory: './translations',
    flatten: true,
  };

  it('creates parent directory when it does not exist', () => {
    writeManifest(MANIFEST, './translations/i18n-manifest.json');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('./translations', { recursive: true });
  });

  it('does not call mkdirSync when directory already exists', () => {
    mockFs.existsSync.mockReturnValue(true);
    writeManifest(MANIFEST, './translations/i18n-manifest.json');
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
  });

  it('writes serialised JSON to the manifest path', () => {
    writeManifest(MANIFEST, './translations/i18n-manifest.json');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      './translations/i18n-manifest.json',
      JSON.stringify(MANIFEST, null, 2),
      'utf8',
    );
  });

  it('uses path.dirname to resolve the parent directory', () => {
    writeManifest(MANIFEST, path.join('a', 'b', 'manifest.json'));
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join('a', 'b'), { recursive: true });
  });

  it('logs the output path after writing', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    writeManifest(MANIFEST, './out/manifest.json');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('./out/manifest.json'));
    logSpy.mockRestore();
  });
});
```

## Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npx jest tests/utils/driveProjectIndex.test.ts --no-coverage 2>&1 | tail -20
```

## Acceptance criteria
- [x] `src/utils/driveProjectIndex.ts` compiles (tsc)
- [x] All tests in `tests/utils/driveProjectIndex.test.ts` pass
- [x] No existing tests broken
