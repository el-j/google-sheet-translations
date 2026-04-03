import { manageDriveTranslations } from '../../src/utils/getDriveTranslations';
import type { GoogleDriveManagerOptions } from '../../src/utils/getDriveTranslations';

vi.mock('../../src/getMultipleSpreadSheetsData');
vi.mock('../../src/utils/driveFolderScanner');
vi.mock('../../src/utils/driveImageSync');
vi.mock('../../src/utils/driveProjectIndex');
vi.mock('../../src/getSpreadSheetData');

import { getMultipleSpreadSheetsData } from '../../src/getMultipleSpreadSheetsData';
import { scanDriveFolderForSpreadsheets } from '../../src/utils/driveFolderScanner';
import { syncDriveImages } from '../../src/utils/driveImageSync';
import { buildManifest, writeManifest } from '../../src/utils/driveProjectIndex';
import { getSpreadSheetData } from '../../src/getSpreadSheetData';

const mockGetMultiple = getMultipleSpreadSheetsData as MockedFunction<typeof getMultipleSpreadSheetsData>;
const mockScanDrive = scanDriveFolderForSpreadsheets as MockedFunction<typeof scanDriveFolderForSpreadsheets>;
const mockSyncImages = syncDriveImages as MockedFunction<typeof syncDriveImages>;
const mockBuildManifest = buildManifest as MockedFunction<typeof buildManifest>;
const mockWriteManifest = writeManifest as MockedFunction<typeof writeManifest>;
const mockGetSpreadSheetData = getSpreadSheetData as MockedFunction<typeof getSpreadSheetData>;

const MOCK_TRANSLATIONS = { en: { home: { title: 'Hello' } } };
const MOCK_IMAGE_RESULT = { downloaded: ['img1.png'], skipped: [], deleted: [], errors: [] };
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

function makeSpreadsheet(id: string, name: string) {
  return { id, name, folderPath: '', mimeType: SPREADSHEET_MIME };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMultiple.mockResolvedValue(MOCK_TRANSLATIONS);
  mockScanDrive.mockResolvedValue([]);
  mockSyncImages.mockResolvedValue(MOCK_IMAGE_RESULT);
  const MOCK_MANIFEST = { version: '1' as const, generatedAt: '2026-01-01T00:00:00.000Z', locales: ['en'], spreadsheets: [], outputDirectory: 'translations', flatten: true };
  mockBuildManifest.mockReturnValue(MOCK_MANIFEST);
  mockWriteManifest.mockImplementation(() => {});
  mockGetSpreadSheetData.mockResolvedValue(MOCK_TRANSLATIONS);
});

describe('manageDriveTranslations', () => {
  it('scans folder and fetches translations when driveFolderId + scanForSpreadsheets: true', async () => {
    mockScanDrive.mockResolvedValue([
      makeSpreadsheet('sheet1', 'i18n-app'),
      makeSpreadsheet('sheet2', 'i18n-web'),
    ]);

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      scanForSpreadsheets: true,
    });

    expect(mockScanDrive).toHaveBeenCalledWith({ folderId: 'folder-123' });
    expect(mockGetMultiple).toHaveBeenCalledWith(undefined, {
      spreadsheetIds: ['sheet1', 'sheet2'],
    });
    expect(result.translations).toEqual(MOCK_TRANSLATIONS);
    expect(result.spreadsheetIds).toEqual(['sheet1', 'sheet2']);
  });

  it('skips folder scan when scanForSpreadsheets: false', async () => {
    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      scanForSpreadsheets: false,
      spreadsheetIds: ['explicit-id'],
    });

    expect(mockScanDrive).not.toHaveBeenCalled();
    expect(mockGetMultiple).toHaveBeenCalledWith(undefined, {
      spreadsheetIds: ['explicit-id'],
    });
    expect(result.spreadsheetIds).toEqual(['explicit-id']);
  });

  it('merges discovered + explicit spreadsheetIds with deduplication', async () => {
    mockScanDrive.mockResolvedValue([
      makeSpreadsheet('discovered-1', 'Sheet A'),
      makeSpreadsheet('shared-id', 'Sheet B'),
    ]);

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      scanForSpreadsheets: true,
      spreadsheetIds: ['shared-id', 'explicit-only'],
    });

    // 'shared-id' should appear only once
    expect(result.spreadsheetIds).toEqual(['discovered-1', 'shared-id', 'explicit-only']);
    expect(mockGetMultiple).toHaveBeenCalledWith(undefined, {
      spreadsheetIds: ['discovered-1', 'shared-id', 'explicit-only'],
    });
  });

  it('applies spreadsheetNameFilter to discovered spreadsheets', async () => {
    mockScanDrive.mockResolvedValue([
      makeSpreadsheet('sheet-a', 'i18n-app'),
      makeSpreadsheet('sheet-b', 'product-catalogue'),
      makeSpreadsheet('sheet-c', 'i18n-website'),
    ]);

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      spreadsheetNameFilter: /^i18n-/,
    });

    expect(result.spreadsheetIds).toEqual(['sheet-a', 'sheet-c']);
    expect(mockGetMultiple).toHaveBeenCalledWith(undefined, {
      spreadsheetIds: ['sheet-a', 'sheet-c'],
    });
  });

  it('syncs images when syncImages: true', async () => {
    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      syncImages: true,
      imageOutputPath: './public/images',
    });

    expect(mockSyncImages).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-123', outputPath: './public/images' }),
    );
    expect(result.imageSync).toEqual(MOCK_IMAGE_RESULT);
  });

  it('skips image sync when syncImages: false', async () => {
    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      syncImages: false,
      imageOutputPath: './public/images',
    });

    expect(mockSyncImages).not.toHaveBeenCalled();
    expect(result.imageSync).toBeUndefined();
  });

  it('throws when syncImages: true but imageOutputPath is not provided', async () => {
    await expect(
      manageDriveTranslations({
        driveFolderId: 'folder-123',
        syncImages: true,
      }),
    ).rejects.toThrow('imageOutputPath is required when syncImages is true');
  });

  it('returns correct shape { translations, spreadsheetIds, imageSync }', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
      syncImages: true,
      imageOutputPath: './images',
    });

    expect(result).toMatchObject({
      translations: MOCK_TRANSLATIONS,
      spreadsheetIds: ['s1'],
      imageSync: MOCK_IMAGE_RESULT,
    });
  });

  it('falls back gracefully when folder has no spreadsheets', async () => {
    mockScanDrive.mockResolvedValue([]);
    mockGetMultiple.mockResolvedValue({});

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-123',
    });

    expect(result.spreadsheetIds).toEqual([]);
    expect(result.translations).toEqual({});
    expect(result.imageSync).toBeUndefined();
  });

  it('passes docTitles and translationOptions to getMultipleSpreadSheetsData', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Translations')]);

    await manageDriveTranslations({
      driveFolderId: 'folder-123',
      docTitles: ['landingPage', 'about'],
      translationOptions: { autoTranslate: false, rowLimit: 200 },
    });

    expect(mockGetMultiple).toHaveBeenCalledWith(['landingPage', 'about'], {
      autoTranslate: false,
      rowLimit: 200,
      spreadsheetIds: ['s1'],
    });
  });

  it('passes imageSyncOptions to syncDriveImages', async () => {
    await manageDriveTranslations({
      driveFolderId: 'folder-456',
      syncImages: true,
      imageOutputPath: './out',
      imageSyncOptions: { concurrency: 5, cleanSync: true },
    });

    expect(mockSyncImages).toHaveBeenCalledWith({
      folderId: 'folder-456',
      outputPath: './out',
      concurrency: 5,
      cleanSync: true,
    });
  });
});

describe('flatten option', () => {
  it('flatten: true (default) uses getMultipleSpreadSheetsData as before', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    await manageDriveTranslations({ driveFolderId: 'f1', flatten: true, translationOptions: { translationsOutputDir: './tr' } });
    expect(mockGetMultiple).toHaveBeenCalled();
    expect(mockGetSpreadSheetData).not.toHaveBeenCalled();
  });

  it('flatten: false calls getSpreadSheetData per spreadsheet with subdir', async () => {
    mockScanDrive.mockResolvedValue([
      makeSpreadsheet('s1', 'app-i18n'),
      makeSpreadsheet('s2', 'marketing'),
    ]);
    await manageDriveTranslations({
      driveFolderId: 'f1',
      flatten: false,
      createManifest: false,
      translationOptions: { translationsOutputDir: './translations' },
    });
    expect(mockGetSpreadSheetData).toHaveBeenCalledTimes(2);
    expect(mockGetSpreadSheetData).toHaveBeenCalledWith(undefined, expect.objectContaining({
      spreadsheetId: 's1',
      translationsOutputDir: expect.stringContaining('app-i18n'),
    }));
    expect(mockGetSpreadSheetData).toHaveBeenCalledWith(undefined, expect.objectContaining({
      spreadsheetId: 's2',
      translationsOutputDir: expect.stringContaining('marketing'),
    }));
    expect(mockGetMultiple).not.toHaveBeenCalled();
  });

  it('flatten: false sanitizes spreadsheet names for subdir', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'My App (2026) / Main')]);
    await manageDriveTranslations({
      driveFolderId: 'f1',
      flatten: false,
      createManifest: false,
      translationOptions: { translationsOutputDir: './tr' },
    });
    expect(mockGetSpreadSheetData).toHaveBeenCalledWith(undefined, expect.objectContaining({
      translationsOutputDir: expect.stringMatching(/my-app-2026-main|my-app.*main/),
    }));
  });

  it('flatten: false still returns merged translations', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'A'), makeSpreadsheet('s2', 'B')]);
    mockGetSpreadSheetData
      .mockResolvedValueOnce({ en: { home: { a: '1' } } })
      .mockResolvedValueOnce({ de: { home: { b: '2' } } });
    const result = await manageDriveTranslations({
      driveFolderId: 'f1',
      flatten: false,
      createManifest: false,
    });
    expect(result.translations).toEqual({ en: { home: { a: '1' } }, de: { home: { b: '2' } } });
  });
});

describe('manifest / createManifest', () => {
  it('creates manifest by default when driveFolderId is set', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    await manageDriveTranslations({ driveFolderId: 'f1' });
    expect(mockBuildManifest).toHaveBeenCalled();
    expect(mockWriteManifest).toHaveBeenCalled();
  });

  it('does NOT create manifest by default when driveFolderId is not set', async () => {
    await manageDriveTranslations({ spreadsheetIds: ['s1'] });
    expect(mockBuildManifest).not.toHaveBeenCalled();
    expect(mockWriteManifest).not.toHaveBeenCalled();
  });

  it('createManifest: false skips manifest even with driveFolderId', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    await manageDriveTranslations({ driveFolderId: 'f1', createManifest: false });
    expect(mockWriteManifest).not.toHaveBeenCalled();
  });

  it('createManifest: true with explicit IDs still creates manifest', async () => {
    await manageDriveTranslations({ spreadsheetIds: ['s1'], createManifest: true });
    expect(mockWriteManifest).toHaveBeenCalled();
  });

  it('uses custom manifestPath when provided', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    await manageDriveTranslations({ driveFolderId: 'f1', manifestPath: '/custom/manifest.json' });
    expect(mockWriteManifest).toHaveBeenCalledWith(expect.any(Object), '/custom/manifest.json');
  });

  it('passes projectName, domain, defaultLocale, projectMetadata to buildManifest', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    await manageDriveTranslations({
      driveFolderId: 'f1',
      projectName: 'my-app',
      domain: 'https://example.com',
      defaultLocale: 'en',
      projectMetadata: { owner: 'team-a' },
    });
    expect(mockBuildManifest).toHaveBeenCalledWith(expect.objectContaining({
      projectName: 'my-app',
      domain: 'https://example.com',
      defaultLocale: 'en',
      projectMetadata: { owner: 'team-a' },
    }));
  });

  it('result.manifest is the value returned by buildManifest', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    const result = await manageDriveTranslations({ driveFolderId: 'f1' });
    expect(result.manifest).toEqual(expect.objectContaining({ version: '1' }));
  });

  it('result.manifest is undefined when createManifest: false', async () => {
    mockScanDrive.mockResolvedValue([makeSpreadsheet('s1', 'Sheet')]);
    const result = await manageDriveTranslations({ driveFolderId: 'f1', createManifest: false });
    expect(result.manifest).toBeUndefined();
  });
});

// ── Doc ingestion integration ─────────────────────────────────────────────────

jest.mock('../../src/utils/driveDocScanner');
jest.mock('../../src/utils/docIngester');

import { scanDriveFolderForDocs } from '../../src/utils/driveDocScanner';
import { ingestDoc } from '../../src/utils/docIngester';

const mockScanDocs = scanDriveFolderForDocs as jest.MockedFunction<typeof scanDriveFolderForDocs>;
const mockIngestDoc = ingestDoc as jest.MockedFunction<typeof ingestDoc>;
const mockReadManifest = jest.fn().mockReturnValue(undefined);

jest.mock('../../src/utils/driveProjectIndex', () => {
  const actual = jest.requireActual('../../src/utils/driveProjectIndex');
  return {
    ...actual,
    buildManifest: jest.fn().mockReturnValue({ version: '1', generatedAt: '', locales: [], spreadsheets: [], outputDirectory: 'translations', flatten: true }),
    writeManifest: jest.fn(),
    readManifest: (...args: unknown[]) => mockReadManifest(...args),
  };
});

describe('manageDriveTranslations – scanForDocs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMultiple.mockResolvedValue(MOCK_TRANSLATIONS);
    mockScanDrive.mockResolvedValue([]);
    mockScanDocs.mockResolvedValue([]);
    mockIngestDoc.mockResolvedValue({
      action: 'created',
      entry: {
        id: 'doc-id',
        name: 'content_en',
        folderPath: '',
        generatedFromDoc: true,
        sourceLocale: 'en',
        linkedSpreadsheetId: 'new-sheet-id',
        lastIngestedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    mockReadManifest.mockReturnValue(undefined);
  });

  it('scans for docs when scanForDocs: true', async () => {
    mockScanDocs.mockResolvedValue([
      { id: 'doc1', name: 'content_en', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'en' },
    ]);

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-id',
      scanForDocs: true,
    });

    expect(mockScanDocs).toHaveBeenCalledWith({ folderId: 'folder-id' });
    expect(mockIngestDoc).toHaveBeenCalledTimes(1);
    expect(result.docIngestResults).toHaveLength(1);
    expect(result.docIngestResults![0].action).toBe('created');
  });

  it('applies docNameFilter when provided', async () => {
    mockScanDocs.mockResolvedValue([
      { id: 'doc1', name: 'content_en', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'en' },
      { id: 'doc2', name: 'draft_de', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'de' },
    ]);

    await manageDriveTranslations({
      driveFolderId: 'folder-id',
      scanForDocs: true,
      docNameFilter: /^content_/,
    });

    expect(mockIngestDoc).toHaveBeenCalledTimes(1);
  });

  it('does not scan for docs when scanForDocs is false (default)', async () => {
    await manageDriveTranslations({ driveFolderId: 'folder-id' });
    expect(mockScanDocs).not.toHaveBeenCalled();
  });

  it('applies docSourceLocale fallback when doc has no sourceLocale', async () => {
    mockScanDocs.mockResolvedValue([
      { id: 'doc1', name: 'content', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: undefined },
    ]);

    await manageDriveTranslations({
      driveFolderId: 'folder-id',
      scanForDocs: true,
      docSourceLocale: 'fr',
    });

    const [docArg] = mockIngestDoc.mock.calls[0];
    expect(docArg.sourceLocale).toBe('fr');
  });

  it('continues processing other docs when one fails', async () => {
    mockScanDocs.mockResolvedValue([
      { id: 'doc1', name: 'content_en', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'en' },
      { id: 'doc2', name: 'content_de', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'de' },
    ]);
    mockIngestDoc
      .mockRejectedValueOnce(new Error('Export failed'))
      .mockResolvedValueOnce({ action: 'created', entry: { id: 'doc2', name: 'content_de', folderPath: '', generatedFromDoc: true, sourceLocale: 'de', linkedSpreadsheetId: 'sheet-de' } });

    const result = await manageDriveTranslations({
      driveFolderId: 'folder-id',
      scanForDocs: true,
    });

    // Second doc should still be processed
    expect(result.docIngestResults).toHaveLength(1);
    expect(result.docIngestResults![0].action).toBe('created');
  });

  it('docIngestResults is undefined when scanForDocs is false', async () => {
    const result = await manageDriveTranslations({ driveFolderId: 'folder-id' });
    expect(result.docIngestResults).toBeUndefined();
  });
});

  it('passes existing manifest entry to ingestDoc when previous manifest has docs', async () => {
    const existingDocEntry = {
      id: 'doc1',
      name: 'content_en',
      folderPath: '',
      generatedFromDoc: true as const,
      sourceLocale: 'en',
      linkedSpreadsheetId: 'existing-sheet',
      lastIngestedAt: '2024-01-01T00:00:00.000Z',
    };
    mockReadManifest.mockReturnValueOnce({
      version: '1',
      generatedAt: '',
      locales: ['en'],
      spreadsheets: [],
      outputDirectory: 'translations',
      flatten: true,
      docs: [existingDocEntry],
    });
    mockScanDocs.mockResolvedValue([
      { id: 'doc1', name: 'content_en', folderPath: '', mimeType: 'application/vnd.google-apps.document', sourceLocale: 'en' },
    ]);

    await manageDriveTranslations({
      driveFolderId: 'folder-id',
      scanForDocs: true,
    });

    const [, options] = mockIngestDoc.mock.calls[0];
    expect(options.existingEntry).toEqual(existingDocEntry);
  });
