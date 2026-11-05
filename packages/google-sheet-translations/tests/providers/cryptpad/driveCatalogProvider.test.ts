// @ts-nocheck
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createCryptPadDriveCatalogProvider,
  CRYPTPAD_DRIVE_CATALOG_CAPABILITIES,
} from '../../../src/providers/cryptpad/driveCatalogProvider';
import { CryptPadDriveClient } from '../../../src/providers/cryptpad/driveClient';

vi.mock('../../../src/providers/cryptpad/driveClient', () => {
  return {
    CryptPadDriveClient: vi.fn(),
  };
});

describe('CryptPad driveCatalogProvider unit tests', () => {
  const originalEnv = process.env.CRYPTPAD_DRIVE_URL;

  beforeEach(() => {
    delete process.env.CRYPTPAD_DRIVE_URL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CRYPTPAD_DRIVE_URL = originalEnv;
    } else {
      delete process.env.CRYPTPAD_DRIVE_URL;
    }
  });

  it('throws when no driveUrl option or CRYPTPAD_DRIVE_URL env var is present', () => {
    expect(() => createCryptPadDriveCatalogProvider()).toThrow(
      'CryptPad Drive catalog provider requires a "driveUrl" option or CRYPTPAD_DRIVE_URL environment variable.',
    );
  });

  it('instantiates correctly with env var fallback and default properties', () => {
    process.env.CRYPTPAD_DRIVE_URL = 'https://cryptpad.fr/drive/#/2/drive/view/env-drive-seed/';
    const provider = createCryptPadDriveCatalogProvider();

    expect(provider.kind).toBe('catalog');
    expect(provider.providerId).toBe('cryptpad-drive');
    expect(provider.displayName).toBe('CryptPad Drive Folder Discovery');
    expect(provider.capabilities).toEqual(CRYPTPAD_DRIVE_CATALOG_CAPABILITIES);
  });

  it('discovers sources and differentiates sheets from assets', async () => {
    const mockListDriveItems = vi.fn().mockResolvedValue([
      {
        id: 'item-1',
        title: 'App Translations',
        path: '/i18n/App Translations',
        type: 'sheet',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/sheet1/',
        password: 'pass1',
        channel: 'chan1',
      },
      {
        id: 'item-2',
        title: 'Logo Image',
        path: '/assets/Logo Image.png',
        type: 'file',
        url: 'https://cryptpad.fr/file/#/2/file/view/file1/',
        channel: 'chan2',
      },
    ]);

    vi.mocked(CryptPadDriveClient).mockImplementation(
      class {
        listDriveItems = mockListDriveItems;
      } as any,
    );

    const provider = createCryptPadDriveCatalogProvider({
      driveUrl: 'https://cryptpad.fr/drive/#/2/drive/view/drive-seed/',
      providerId: 'custom-catalog',
      displayName: 'Custom Drive',
    });

    expect(provider.providerId).toBe('custom-catalog');
    expect(provider.displayName).toBe('Custom Drive');

    const result = await provider.discoverSources();
    expect(result.sources).toHaveLength(2);

    const sheetSource = result.sources[0];
    expect(sheetSource.providerId).toBe('cryptpad-sheet');
    expect(sheetSource.kind).toBe('table');
    expect(sheetSource.name).toBe('App Translations');
    expect(sheetSource.metadata?.url).toBe('https://cryptpad.fr/sheet/#/2/sheet/edit/sheet1/');

    const assetSource = result.sources[1];
    expect(assetSource.providerId).toBe('cryptpad-assets');
    expect(assetSource.kind).toBe('asset');
    expect(assetSource.name).toBe('Logo Image');

    expect(result.metadata?.totalDiscovered).toBe(2);
  });

  it('filters sources when discovery query is specified', async () => {
    const mockListDriveItems = vi.fn().mockResolvedValue([
      {
        id: 'item-1',
        title: 'Frontend Translations',
        path: '/i18n/Frontend',
        type: 'sheet',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/s1/',
      },
      {
        id: 'item-2',
        title: 'Backend Translations',
        path: '/i18n/Backend',
        type: 'sheet',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/s2/',
      },
      {
        id: 'item-3',
        title: 'User Manual',
        path: '/docs/Manual',
        type: 'pad',
        url: 'https://cryptpad.fr/pad/#/2/pad/edit/p1/',
      },
    ]);

    vi.mocked(CryptPadDriveClient).mockImplementation(
      class {
        listDriveItems = mockListDriveItems;
      } as any,
    );

    const provider = createCryptPadDriveCatalogProvider({
      driveUrl: 'https://cryptpad.fr/drive/#/2/drive/view/seed/',
    });

    const filtered = await provider.discoverSources({ query: 'frontend' });
    expect(filtered.sources).toHaveLength(1);
    expect(filtered.sources[0].name).toBe('Frontend Translations');

    const filteredByPath = await provider.discoverSources({ query: 'docs' });
    expect(filteredByPath.sources).toHaveLength(1);
    expect(filteredByPath.sources[0].name).toBe('User Manual');
  });
});
