import { syncDriveImages } from '../../src/utils/driveImageSync';

// Mock node:fs
jest.mock('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event: string, cb: Function) => {
      if (event === 'finish') setTimeout(cb, 0);
    }),
  }),
  readdirSync: jest.fn().mockReturnValue([]),
  unlinkSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
}));

jest.mock('node:stream/promises', () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:stream', () => ({
  Readable: {
    fromWeb: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  },
}));

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    }),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const credentials = {
  GOOGLE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: 'mock-private-key',
  GOOGLE_SPREADSHEET_ID: '',
};

function makeListResponse(files: object[], nextPageToken?: string) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ files, nextPageToken }),
    text: jest.fn().mockResolvedValue(''),
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
  jest.clearAllMocks();
  const fs = require('node:fs');
  fs.existsSync.mockReturnValue(false);
  fs.readdirSync.mockReturnValue([]);
});

describe('syncDriveImages', () => {
  it('downloads files and returns correct result counts', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'image1.png', mimeType: 'image/png' },
          { id: 'file2', name: 'image2.jpg', mimeType: 'image/jpeg' },
        ])
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
    const fs = require('node:fs');
    fs.existsSync.mockReturnValue(true);

    mockFetch.mockResolvedValueOnce(
      makeListResponse([
        { id: 'file1', name: 'image1.png', mimeType: 'image/png' },
      ])
    );

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('recursively traverses subfolders and preserves folder structure', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'sub1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
        ])
      )
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'icon.png', mimeType: 'image/png' },
        ])
      )
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      recursive: true,
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toContain('icons');
    expect(result.downloaded[0]).toContain('icon.png');
  });

  it('does not recurse into subfolders when recursive is false', async () => {
    mockFetch.mockResolvedValueOnce(
      makeListResponse([
        { id: 'sub1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'file1', name: 'root.png', mimeType: 'image/png' },
      ])
    ).mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      recursive: false,
      credentials,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toContain('root.png');
  });

  it('applies folderPattern filter to subfolders', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'sub1', name: 'icons', mimeType: 'application/vnd.google-apps.folder' },
          { id: 'sub2', name: 'photos', mimeType: 'application/vnd.google-apps.folder' },
        ])
      )
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'icon.png', mimeType: 'image/png' },
        ])
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
    const fs = require('node:fs');
    fs.readdirSync.mockReturnValue(['extra.png']);
    fs.statSync.mockReturnValue({ isDirectory: () => false });
    fs.existsSync.mockImplementation((p: string) => p === '/output');

    mockFetch
      .mockResolvedValueOnce(makeListResponse([]))
      .mockResolvedValue(makeDownloadResponse());

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      cleanSync: true,
      credentials,
    });

    expect(result.deleted).toHaveLength(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/output/extra.png');
  });

  it('handles individual download errors gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeListResponse([
          { id: 'file1', name: 'bad.png', mimeType: 'image/png' },
        ])
      )
      .mockResolvedValueOnce({ ok: false, status: 500, text: jest.fn().mockResolvedValue('Server Error') });

    const result = await syncDriveImages({
      folderId: 'root-folder',
      outputPath: '/output',
      credentials,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.downloaded).toHaveLength(0);
  });

  it('creates output directory if it does not exist', async () => {
    const fs = require('node:fs');
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
      })
    ).rejects.toThrow('Google Drive credentials required');

    if (originalEmail) process.env.GOOGLE_CLIENT_EMAIL = originalEmail;
    if (originalKey) process.env.GOOGLE_PRIVATE_KEY = originalKey;
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
        ])
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
