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

  it('writes serialized JSON to the manifest path', () => {
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

// ── readManifest ──────────────────────────────────────────────────────────────

describe('readManifest', () => {
  // We need to import readManifest - add to the import at the top won't work here
  // so we re-require with the full module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readManifest } = require('../../src/utils/driveProjectIndex');

  it('returns the parsed manifest when the file exists', () => {
    const manifest: DriveProjectManifest = {
      version: '1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      locales: ['de', 'en'],
      spreadsheets: [],
      outputDirectory: './translations',
      flatten: true,
    };
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(manifest) as unknown as Buffer);

    const result = readManifest('./translations/i18n-manifest.json');

    expect(result).toEqual(manifest);
  });

  it('returns undefined when the file does not exist', () => {
    mockFs.readFileSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = readManifest('./non-existent-path/manifest.json');

    expect(result).toBeUndefined();
  });

  it('returns undefined when the file contains invalid JSON', () => {
    mockFs.readFileSync.mockReturnValueOnce('not-json' as unknown as Buffer);

    const result = readManifest('./broken/manifest.json');

    expect(result).toBeUndefined();
  });
});
