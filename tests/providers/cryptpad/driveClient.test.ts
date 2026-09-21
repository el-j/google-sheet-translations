import { describe, expect, it, vi } from 'vitest';
import { CryptPadDriveClient } from '../../../src/providers/cryptpad/driveClient';
import {
  createCryptPadDriveCatalogProvider,
  CRYPTPAD_DRIVE_CATALOG_CAPABILITIES,
} from '../../../src/providers/cryptpad/driveCatalogProvider';

describe('cryptpad drive client and catalog provider', () => {
  it('declares discoverByFolder capability', () => {
    expect(CRYPTPAD_DRIVE_CATALOG_CAPABILITIES.discoverByFolder).toBe(true);
  });

  it('lists items from mock Netflux drive history', async () => {
    const mockHistory = [
      JSON.stringify({
        files: {
          file1: {
            title: 'Translations Sheet',
            href: '/sheet/#/2/sheet/edit/seed1/p/',
            type: 'sheet',
          },
          file2: {
            title: 'Logo Image',
            href: '/file/#/2/file/view/seed2/p/',
            type: 'file',
          },
        },
      }),
    ];

    const client = new CryptPadDriveClient({
      url: 'https://cryptpad.fr/drive/#/2/drive/edit/driveseed/p/',
      password: 'test',
    });

    vi.spyOn(client, 'listDriveItems').mockResolvedValue([
      {
        id: 'file1',
        title: 'Translations Sheet',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1/p/',
        type: 'sheet',
        path: 'Translations Sheet',
      },
      {
        id: 'file2',
        title: 'Logo Image',
        url: 'https://cryptpad.fr/file/#/2/file/view/seed2/p/',
        type: 'file',
        path: 'Logo Image',
      },
    ]);

    const sheets = await client.listSheets();
    expect(sheets).toHaveLength(1);
    expect(sheets[0].title).toBe('Translations Sheet');
  });

  it('discovers sources with catalog provider and supports query filtering', async () => {
    const mockItems = [
      {
        id: 'file1',
        title: 'Main App Translations',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1/p/',
        type: 'sheet' as const,
        path: 'Main App Translations',
      },
      {
        id: 'file2',
        title: 'Landing Page Translations',
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed2/p/',
        type: 'sheet' as const,
        path: 'Landing Page Translations',
      },
      {
        id: 'file3',
        title: 'Hero Banner',
        url: 'https://cryptpad.fr/file/#/2/file/view/seed3/p/',
        type: 'file' as const,
        path: 'Hero Banner',
      },
    ];

    vi.spyOn(CryptPadDriveClient.prototype, 'listDriveItems').mockResolvedValue(mockItems);

    const catalog = createCryptPadDriveCatalogProvider({
      driveUrl: 'https://cryptpad.fr/drive/#/2/drive/edit/driveseed/p/',
    });

    // 1. All sources
    const all = await catalog.discoverSources();
    expect(all.sources).toHaveLength(3);
    expect(all.sources.filter((s) => s.kind === 'table')).toHaveLength(2);
    expect(all.sources.filter((s) => s.kind === 'asset')).toHaveLength(1);

    // 2. Query filter
    const filtered = await catalog.discoverSources({ query: 'Landing' });
    expect(filtered.sources).toHaveLength(1);
    expect(filtered.sources[0].name).toBe('Landing Page Translations');
  });
});
