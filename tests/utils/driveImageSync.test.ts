import { syncDriveImages, normalizeExtension } from '../../src/utils/driveImageSync';
import * as fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn().mockReturnValue({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'finish') setTimeout(cb, 0);
    }),
  }),
  readdirSync: vi.fn().mockReturnValue([]),
  unlinkSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false, mtimeMs: 0 }),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:stream', () => ({
  Readable: {
    fromWeb: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  },
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(function (this: any) {
    this.getClient = vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    });
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const credentials = {
  GOOGLE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: 'mock-private-key',
  GOOGLE_SPREADSHEET_ID: '',
};

function makeListResponse(files: object[], nextPageToken?: string) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ files, nextPageToken }),
    text: vi.fn().mockResolvedValue(''),
  };
}

function makeDownloadResponse() {
  return {
    ok: true,
    body: {},
    status: 200,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readdirSync).mockReturnValue([]);
});

describe('syncDriveImages', () => {
  it('downloads files and returns correct result counts', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'image1.png', mimeType: 'image/png' },
          { id: 'file2', name: 'image2.jpg', mimeType: 'image/jpeg' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('skips files that already exist locally', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockFetch.mockResolvedValueOnce(
      makeListResponse([{ id: 'file1', name: 'image1.png', mimeType: 'image/png' }]),
    );

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('filters out non-image MIME types', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'doc.pdf', mimeType: 'application/pdf' },
          { id: 'file2', name: 'image.png', mimeType: 'image/png' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toBe('/output/image.png');
  });

  it('applies nameFilter option', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'hero-banner.png', mimeType: 'image/png' },
          { id: 'file2', name: 'icon-close.png', mimeType: 'image/png' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      nameFilter: /^hero-/,
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toBe('/output/hero-banner.png');
  });

  it('recurses into subfolders when recursive: true (default)', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'subfolder1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
        ]),
      )
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'file1', name: 'check.svg', mimeType: 'image/svg+xml' }]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toBe('/output/icons/check.svg');
  });

  it('does not recurse into subfolders when recursive: false', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'subfolder1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
          { id: 'file1', name: 'root.png', mimeType: 'image/png' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      recursive: false,
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toBe('/output/root.png');
    expect(mockFetch).toHaveBeenCalledTimes(2); // 1 list call + 1 download call
  });

  it('applies folderPattern filter to subfolder traversal', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'sub1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
          { id: 'sub2', name: 'docs', mimeType: 'application/vnd.google-apps.folder' },
        ]),
      )
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'file1', name: 'icon.png', mimeType: 'image/png' }]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      folderPattern: /^icons$/,
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toContain('icons');
  });

  it('cleanSync deletes local files not present in Drive', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['extra.png'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
    vi.mocked(fs.existsSync).mockImplementation((p: any) => p === '/output');

    mockFetch.mockResolvedValueOnce(makeListResponse([])).mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      cleanSync: true,
      credentials,
    });

    expect(result.deleted).toHaveLength(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/output/extra.png');
  });

  it('cleanSync walks nested local directories before deleting missing files', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p: any) => p === '/output' || p === '/output/nested',
    );
    vi.mocked(fs.readdirSync).mockImplementation(
      (p: any) => (p === '/output' ? ['nested'] : ['old.png']) as any,
    );
    vi.mocked(fs.statSync).mockImplementation(((p: any) => ({
      isDirectory: () => p === '/output/nested',
    })) as any);

    mockFetch.mockResolvedValueOnce(makeListResponse([]));

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      cleanSync: true,
      credentials,
    });

    expect(result.deleted).toEqual(['/output/nested/old.png']);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/output/nested/old.png');
  });

  it('handles individual download errors gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'file1', name: 'bad.png', mimeType: 'image/png' }]),
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server Error'),
      });

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('throws when the Drive file-list API returns an error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Server Error'),
    });

    await expect(
      syncDriveImages({
        folderId: 'root-folder',
        outputPath: '/output',
        credentials,
      }),
    ).rejects.toThrow('Drive API error 500');
  });

  it('downloads when statSync fails during incremental sync', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockImplementationOnce(() => {
      throw new Error('stat failed');
    });

    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          {
            id: 'f1',
            name: 'photo.png',
            mimeType: 'image/png',
            modifiedTime: new Date(9000).toISOString(),
          },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('records a file error when the download stream pipeline fails', async () => {
    vi.mocked(pipeline).mockRejectedValueOnce(new Error('pipeline failed'));

    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'file1', name: 'bad.png', mimeType: 'image/png' }]),
      )
      .mockResolvedValueOnce(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.errors).toEqual(['/output/bad.png']);
    expect(result.downloaded).toEqual([]);
  });

  it('creates output directory if it does not exist', async () => {
    mockFetch.mockResolvedValueOnce(makeListResponse([]));

    await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/new/output/dir',
      credentials,
    });

    expect(fs.mkdirSync).toHaveBeenCalledWith('/new/output/dir', { recursive: true });
  });

  it('throws on missing credentials', async () => {
    const originalEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const originalKey = process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    // syncDriveImages rejects before reaching GoogleAuth when no credentials are provided
    await expect(
      syncDriveImages({
        folderId: 'root-folder',
        outputPath: '/output',
        credentials: undefined,
      }),
    ).rejects.toThrow('Google Drive credentials required');

    if (originalEmail) process.env.GOOGLE_CLIENT_EMAIL = originalEmail;
    if (originalKey) process.env.GOOGLE_PRIVATE_KEY = originalKey;
  });

  it('uses GOOGLE_APPLICATION_CREDENTIALS fallback when inline credentials are not provided', async () => {
    const originalEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const originalKey = process.env.GOOGLE_PRIVATE_KEY;
    const originalAdc = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-adc.json';

    mockFetch.mockResolvedValueOnce(makeListResponse([]));

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials: undefined,
    });

    expect(result).toEqual({ downloaded: [], skipped: [], deleted: [], errors: [] });

    if (originalEmail) process.env.GOOGLE_CLIENT_EMAIL = originalEmail;
    if (originalKey) process.env.GOOGLE_PRIVATE_KEY = originalKey;
    if (originalAdc) process.env.GOOGLE_APPLICATION_CREDENTIALS = originalAdc;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  it('returns empty result for an empty folder', async () => {
    mockFetch.mockResolvedValueOnce(makeListResponse([]));

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('only downloads files matching custom mimeTypes', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'video.mp4', mimeType: 'video/mp4' },
          { id: 'file2', name: 'thumb.webp', mimeType: 'image/webp' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      mimeTypes: ['image/webp'],
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toContain('thumb.webp');
  });
});

describe('normalizeExtension', () => {
  it('lowercases an uppercase extension', () => {
    expect(normalizeExtension('banner.PNG')).toBe('banner.png');
    expect(normalizeExtension('icon.SVG')).toBe('icon.svg');
    expect(normalizeExtension('photo.WebP')).toBe('photo.webp');
  });

  it('converts jpeg / JPEG to jpg', () => {
    expect(normalizeExtension('photo.jpeg')).toBe('photo.jpg');
    expect(normalizeExtension('photo.JPEG')).toBe('photo.jpg');
    expect(normalizeExtension('photo.Jpeg')).toBe('photo.jpg');
  });

  it('leaves already-correct extensions unchanged', () => {
    expect(normalizeExtension('image.jpg')).toBe('image.jpg');
    expect(normalizeExtension('icon.png')).toBe('icon.png');
  });

  it('preserves the base name exactly', () => {
    expect(normalizeExtension('MyPhoto.JPEG')).toBe('MyPhoto.jpg');
    expect(normalizeExtension('Hero_Banner.PNG')).toBe('Hero_Banner.png');
  });

  it('returns the name unchanged when there is no extension', () => {
    expect(normalizeExtension('Makefile')).toBe('Makefile');
    expect(normalizeExtension('README')).toBe('README');
  });
});

describe('incrementalSync', () => {
  const driveModifiedOld = new Date(1000).toISOString(); // 1 second since epoch
  const driveModifiedNew = new Date(9000).toISOString(); // 9 seconds since epoch
  const localMtimeMid = 5000; // 5 seconds since epoch

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
      mtimeMs: localMtimeMid,
    } as any);
    vi.mocked(pipeline).mockResolvedValue(undefined);
  });

  it('re-downloads a file when Drive modifiedTime is newer than local mtime', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true); // file exists locally

    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'f1', name: 'photo.png', mimeType: 'image/png', modifiedTime: driveModifiedNew },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips a file when Drive modifiedTime is older than local mtime', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // statSync returns mtimeMs: 5000 (above), drive has 1000 → local is newer

    mockFetch.mockResolvedValueOnce(
      makeListResponse([
        { id: 'f1', name: 'photo.png', mimeType: 'image/png', modifiedTime: driveModifiedOld },
      ]),
    );

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('skips a file when Drive modifiedTime equals local mtime', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, mtimeMs: 5000 } as any);
    const driveModifiedEqual = new Date(5000).toISOString();

    mockFetch.mockResolvedValueOnce(
      makeListResponse([
        { id: 'f1', name: 'photo.png', mimeType: 'image/png', modifiedTime: driveModifiedEqual },
      ]),
    );

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('falls back to skip-existing when modifiedTime is absent (no re-download)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    // No modifiedTime in response → incremental check is bypassed → skip existing
    mockFetch.mockResolvedValueOnce(
      makeListResponse([{ id: 'f1', name: 'photo.png', mimeType: 'image/png' }]),
    );

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('incrementalSync: false always skips existing files (Drive modifiedTime ignored)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockFetch.mockResolvedValueOnce(
      makeListResponse([
        { id: 'f1', name: 'photo.png', mimeType: 'image/png', modifiedTime: driveModifiedNew },
      ]),
    );

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
      incrementalSync: false,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('downloads a new file regardless of incrementalSync setting', async () => {
    // existsSync returns false (default) → always download

    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'f1', name: 'new.png', mimeType: 'image/png', modifiedTime: driveModifiedOld },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });
});

describe('normalizeExtensions option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, mtimeMs: 0 } as any);
  });

  it('normalizeExtensions: true (default) — JPEG becomes .jpg in local path', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'f1', name: 'photo.JPEG', mimeType: 'image/jpeg' }]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toMatch(/photo\.jpg$/);
    expect(result.downloaded[0]).not.toMatch(/photo\.JPEG$/);
  });

  it('normalizeExtensions: true — uppercase extension lowercased', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'f1', name: 'banner.PNG', mimeType: 'image/png' },
          { id: 'f2', name: 'icon.SVG', mimeType: 'image/svg+xml' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded).toHaveLength(2);
    expect(result.downloaded.some((p) => p.endsWith('banner.png'))).toBe(true);
    expect(result.downloaded.some((p) => p.endsWith('icon.svg'))).toBe(true);
  });

  it('normalizeExtensions: false — original filename preserved', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'f1', name: 'photo.JPEG', mimeType: 'image/jpeg' },
          { id: 'f2', name: 'banner.PNG', mimeType: 'image/png' },
        ]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
      normalizeExtensions: false,
    });

    expect(result.downloaded).toHaveLength(2);
    expect(result.downloaded.some((p) => p.endsWith('photo.JPEG'))).toBe(true);
    expect(result.downloaded.some((p) => p.endsWith('banner.PNG'))).toBe(true);
  });

  it('normalizeExtensions: true — base name is not modified, only extension', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([{ id: 'f1', name: 'MyHero_Banner.PNG', mimeType: 'image/png' }]),
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.downloaded[0]).toMatch(/MyHero_Banner\.png$/);
  });
});
