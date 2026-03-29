import { manageDriveTranslations } from '../../src/utils/getDriveTranslations';
import type { GoogleDriveManagerOptions } from '../../src/utils/getDriveTranslations';

jest.mock('../../src/getMultipleSpreadSheetsData');
jest.mock('../../src/utils/driveFolderScanner');
jest.mock('../../src/utils/driveImageSync');

import { getMultipleSpreadSheetsData } from '../../src/getMultipleSpreadSheetsData';
import { scanDriveFolderForSpreadsheets } from '../../src/utils/driveFolderScanner';
import { syncDriveImages } from '../../src/utils/driveImageSync';

const mockGetMultiple = getMultipleSpreadSheetsData as jest.MockedFunction<typeof getMultipleSpreadSheetsData>;
const mockScanDrive = scanDriveFolderForSpreadsheets as jest.MockedFunction<typeof scanDriveFolderForSpreadsheets>;
const mockSyncImages = syncDriveImages as jest.MockedFunction<typeof syncDriveImages>;

const MOCK_TRANSLATIONS = { en: { home: { title: 'Hello' } } };
const MOCK_IMAGE_RESULT = { downloaded: ['img1.png'], skipped: [], deleted: [], errors: [] };
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

function makeSpreadsheet(id: string, name: string) {
  return { id, name, folderPath: '', mimeType: SPREADSHEET_MIME };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMultiple.mockResolvedValue(MOCK_TRANSLATIONS);
  mockScanDrive.mockResolvedValue([]);
  mockSyncImages.mockResolvedValue(MOCK_IMAGE_RESULT);
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
