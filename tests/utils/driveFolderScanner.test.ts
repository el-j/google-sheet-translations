import { scanDriveFolderForSpreadsheets } from '../../src/utils/driveFolderScanner';

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(class {
    getClient = vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    });
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const credentials = {
  GOOGLE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: 'mock-private-key',
  GOOGLE_SPREADSHEET_ID: 'unused',
};

function mockOkResponse(files: object[], nextPageToken?: string) {
  return {
    ok: true,
    json: async () => ({ files, nextPageToken }),
    text: async () => '',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scanDriveFolderForSpreadsheets', () => {
  it('returns empty array when folder has no spreadsheets', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOkResponse([]))   // spreadsheets in root
      .mockResolvedValueOnce(mockOkResponse([]));  // subfolders in root

    const result = await scanDriveFolderForSpreadsheets({
      folderId: 'root-id',
      credentials,
    });

    expect(result).toEqual([]);
  });

  it('returns spreadsheets found in root folder', async () => {
    const files = [
      { id: 'sheet1', name: 'Translations', mimeType: SPREADSHEET_MIME, modifiedTime: '2024-01-01' },
      { id: 'sheet2', name: 'Config', mimeType: SPREADSHEET_MIME, modifiedTime: '2024-01-02' },
    ];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(files))
      .mockResolvedValueOnce(mockOkResponse([])); // no subfolders

    const result = await scanDriveFolderForSpreadsheets({
      folderId: 'root-id',
      credentials,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'sheet1', name: 'Translations', folderPath: '' });
    expect(result[1]).toMatchObject({ id: 'sheet2', name: 'Config', folderPath: '' });
  });

  it('recursively scans subfolders and builds correct folderPath', async () => {
    const rootSheets = [{ id: 'root-sheet', name: 'Root', mimeType: SPREADSHEET_MIME }];
    const subfolders = [{ id: 'sub-id', name: 'SubProject', mimeType: FOLDER_MIME }];
    const subSheets = [{ id: 'sub-sheet', name: 'Sub Translations', mimeType: SPREADSHEET_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(rootSheets))   // root spreadsheets
      .mockResolvedValueOnce(mockOkResponse(subfolders))   // root subfolders
      .mockResolvedValueOnce(mockOkResponse(subSheets))    // subfolder spreadsheets
      .mockResolvedValueOnce(mockOkResponse([]));          // subfolder subfolders

    const result = await scanDriveFolderForSpreadsheets({
      folderId: 'root-id',
      credentials,
    });

    expect(result).toHaveLength(2);
    expect(result.find(f => f.id === 'root-sheet')?.folderPath).toBe('');
    expect(result.find(f => f.id === 'sub-sheet')?.folderPath).toBe('SubProject');
  });

  it('builds nested folderPath for deeply nested subfolders', async () => {
    const rootSubfolders = [{ id: 'level1-id', name: 'Level1', mimeType: FOLDER_MIME }];
    const level1Subfolders = [{ id: 'level2-id', name: 'Level2', mimeType: FOLDER_MIME }];
    const level2Sheets = [{ id: 'deep-sheet', name: 'Deep', mimeType: SPREADSHEET_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse([]))             // root spreadsheets
      .mockResolvedValueOnce(mockOkResponse(rootSubfolders)) // root subfolders
      .mockResolvedValueOnce(mockOkResponse([]))             // level1 spreadsheets
      .mockResolvedValueOnce(mockOkResponse(level1Subfolders)) // level1 subfolders
      .mockResolvedValueOnce(mockOkResponse(level2Sheets))   // level2 spreadsheets
      .mockResolvedValueOnce(mockOkResponse([]));            // level2 subfolders

    const result = await scanDriveFolderForSpreadsheets({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Level1/Level2');
  });

  it('applies nameFilter correctly', async () => {
    const files = [
      { id: 'sheet1', name: 'Translations EN', mimeType: SPREADSHEET_MIME },
      { id: 'sheet2', name: 'Config', mimeType: SPREADSHEET_MIME },
      { id: 'sheet3', name: 'Translations FR', mimeType: SPREADSHEET_MIME },
    ];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(files))
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForSpreadsheets({
      folderId: 'root-id',
      credentials,
      nameFilter: /Translations/,
    });

    expect(result).toHaveLength(2);
    expect(result.every(f => f.name.includes('Translations'))).toBe(true);
  });

  it('follows pagination (nextPageToken) until exhausted', async () => {
    const page1Files = [{ id: 'sheet1', name: 'Page1', mimeType: SPREADSHEET_MIME }];
    const page2Files = [{ id: 'sheet2', name: 'Page2', mimeType: SPREADSHEET_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(page1Files, 'token-page2'))
      .mockResolvedValueOnce(mockOkResponse(page2Files))   // second page, no token
      .mockResolvedValueOnce(mockOkResponse([]));          // subfolders

    const result = await scanDriveFolderForSpreadsheets({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(2);
    expect(result.map(f => f.id)).toEqual(['sheet1', 'sheet2']);
  });

  it('non-recursive mode does NOT recurse into subfolders', async () => {
    const files = [{ id: 'sheet1', name: 'Root Sheet', mimeType: SPREADSHEET_MIME }];

    mockFetch.mockResolvedValueOnce(mockOkResponse(files));
    // No second call expected for subfolders

    const result = await scanDriveFolderForSpreadsheets({
      folderId: 'root-id',
      credentials,
      recursive: false,
    });

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on missing credentials', async () => {
    const origEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const origKey = process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    await expect(
      scanDriveFolderForSpreadsheets({ folderId: 'root-id' })
    ).rejects.toThrow('Google Drive credentials required');

    process.env.GOOGLE_CLIENT_EMAIL = origEmail;
    process.env.GOOGLE_PRIVATE_KEY = origKey;
  });

  it('throws on Drive API error response (non-2xx)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(
      scanDriveFolderForSpreadsheets({ folderId: 'root-id', credentials })
    ).rejects.toThrow('Drive API error 403');
  });

  it('deduplicates files with duplicate IDs', async () => {
    const file = { id: 'dup-sheet', name: 'Duplicate', mimeType: SPREADSHEET_MIME };
    const subfolders = [{ id: 'sub-id', name: 'Sub', mimeType: FOLDER_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse([file]))         // root sheets (has dup-sheet)
      .mockResolvedValueOnce(mockOkResponse(subfolders))     // root subfolders
      .mockResolvedValueOnce(mockOkResponse([file]))         // sub sheets (same dup-sheet)
      .mockResolvedValueOnce(mockOkResponse([]));            // sub subfolders

    const result = await scanDriveFolderForSpreadsheets({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dup-sheet');
  });
});
