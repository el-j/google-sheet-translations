import {
  scanDriveFolderForDocs,
  inferLocaleFromDocName,
} from '../../src/utils/driveDocScanner';

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    }),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const DOC_MIME = 'application/vnd.google-apps.document';
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
  jest.clearAllMocks();
});

// ── inferLocaleFromDocName ────────────────────────────────────────────────────

describe('inferLocaleFromDocName', () => {
  it('infers two-letter locale from _[lang] suffix', () => {
    expect(inferLocaleFromDocName('myapp_en')).toBe('en');
    expect(inferLocaleFromDocName('myapp_de')).toBe('de');
    expect(inferLocaleFromDocName('myapp_fr')).toBe('fr');
  });

  it('infers region-qualified locale and normalises case', () => {
    expect(inferLocaleFromDocName('site_zh-TW')).toBe('zh-TW');
    expect(inferLocaleFromDocName('content_fr-fr')).toBe('fr-FR');
    expect(inferLocaleFromDocName('page_pt-BR')).toBe('pt-BR');
  });

  it('handles underscore as separator in locale segment', () => {
    // _zh_TW → treated as _zh-TW after normalisation
    expect(inferLocaleFromDocName('site_zh_TW')).toBe('zh-TW');
  });

  it('returns undefined when no _[lang] suffix is present', () => {
    expect(inferLocaleFromDocName('myapp')).toBeUndefined();
    expect(inferLocaleFromDocName('translations')).toBeUndefined();
    expect(inferLocaleFromDocName('content-page')).toBeUndefined();
  });

  it('strips file extensions before matching', () => {
    expect(inferLocaleFromDocName('myapp_en.docx')).toBe('en');
    expect(inferLocaleFromDocName('myapp_de.txt')).toBe('de');
  });

  it('handles names with hyphens before the locale suffix', () => {
    expect(inferLocaleFromDocName('landing-page_de')).toBe('de');
    expect(inferLocaleFromDocName('my-project_es')).toBe('es');
  });

  it('returns undefined for too-short or invalid candidate', () => {
    // single letter is not a valid locale
    expect(inferLocaleFromDocName('myapp_x')).toBeUndefined();
  });
});

// ── scanDriveFolderForDocs ────────────────────────────────────────────────────

describe('scanDriveFolderForDocs', () => {
  it('returns empty array when folder has no docs', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOkResponse([])) // docs in root
      .mockResolvedValueOnce(mockOkResponse([])); // subfolders in root

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result).toEqual([]);
  });

  it('returns docs found in root folder with inferred locale', async () => {
    const files = [
      { id: 'doc1', name: 'content_en', mimeType: DOC_MIME, modifiedTime: '2024-01-01' },
      { id: 'doc2', name: 'content_de', mimeType: DOC_MIME, modifiedTime: '2024-01-02' },
    ];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(files))
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'doc1',
      name: 'content_en',
      folderPath: '',
      sourceLocale: 'en',
    });
    expect(result[1]).toMatchObject({
      id: 'doc2',
      name: 'content_de',
      folderPath: '',
      sourceLocale: 'de',
    });
  });

  it('recursively scans subfolders and builds correct folderPath', async () => {
    const rootDocs = [{ id: 'root-doc', name: 'global_en', mimeType: DOC_MIME }];
    const subfolders = [{ id: 'sub-id', name: 'SubProject', mimeType: FOLDER_MIME }];
    const subDocs = [{ id: 'sub-doc', name: 'landing_de', mimeType: DOC_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(rootDocs))
      .mockResolvedValueOnce(mockOkResponse(subfolders))
      .mockResolvedValueOnce(mockOkResponse(subDocs))
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(2);
    expect(result.find((f) => f.id === 'root-doc')?.folderPath).toBe('');
    expect(result.find((f) => f.id === 'sub-doc')?.folderPath).toBe('SubProject');
  });

  it('applies nameFilter correctly', async () => {
    const files = [
      { id: 'doc1', name: 'content_en', mimeType: DOC_MIME },
      { id: 'doc2', name: 'draft_de', mimeType: DOC_MIME },
      { id: 'doc3', name: 'content_fr', mimeType: DOC_MIME },
    ];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(files))
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForDocs({
      folderId: 'root-id',
      credentials,
      nameFilter: /^content_/,
    });

    expect(result).toHaveLength(2);
    expect(result.every((f) => f.name.startsWith('content_'))).toBe(true);
  });

  it('non-recursive mode does NOT recurse into subfolders', async () => {
    const files = [{ id: 'doc1', name: 'content_en', mimeType: DOC_MIME }];

    mockFetch.mockResolvedValueOnce(mockOkResponse(files));

    const result = await scanDriveFolderForDocs({
      folderId: 'root-id',
      credentials,
      recursive: false,
    });

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('follows pagination (nextPageToken) until exhausted', async () => {
    const page1Files = [{ id: 'doc1', name: 'page1_en', mimeType: DOC_MIME }];
    const page2Files = [{ id: 'doc2', name: 'page2_de', mimeType: DOC_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(page1Files, 'token-page2'))
      .mockResolvedValueOnce(mockOkResponse(page2Files)) // second page, no token
      .mockResolvedValueOnce(mockOkResponse([])); // subfolders

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toEqual(['doc1', 'doc2']);
  });

  it('deduplicates docs with the same ID', async () => {
    const file = { id: 'dup-doc', name: 'content_en', mimeType: DOC_MIME };
    const subfolders = [{ id: 'sub-id', name: 'Sub', mimeType: FOLDER_MIME }];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse([file]))
      .mockResolvedValueOnce(mockOkResponse(subfolders))
      .mockResolvedValueOnce(mockOkResponse([file])) // same doc in subfolder
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dup-doc');
  });

  it('sets sourceLocale to undefined when filename has no locale suffix', async () => {
    const files = [
      { id: 'doc1', name: 'general-content', mimeType: DOC_MIME },
    ];

    mockFetch
      .mockResolvedValueOnce(mockOkResponse(files))
      .mockResolvedValueOnce(mockOkResponse([]));

    const result = await scanDriveFolderForDocs({ folderId: 'root-id', credentials });

    expect(result[0].sourceLocale).toBeUndefined();
  });

  it('throws on missing credentials', async () => {
    const origEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const origKey = process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    await expect(
      scanDriveFolderForDocs({ folderId: 'root-id' }),
    ).rejects.toThrow('Google Drive credentials required');

    process.env.GOOGLE_CLIENT_EMAIL = origEmail;
    process.env.GOOGLE_PRIVATE_KEY = origKey;
  });

  it('throws on Drive API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(
      scanDriveFolderForDocs({ folderId: 'root-id', credentials }),
    ).rejects.toThrow('Drive API error 403');
  });
});
