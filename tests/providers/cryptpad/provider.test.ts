import { describe, expect, it, vi } from 'vitest';
import {
  createCryptPadCsvInputProvider,
  CRYPTPAD_CSV_INPUT_CAPABILITIES,
} from '../../../src/providers/cryptpad';

describe('cryptpad csv input provider', () => {
  it('declares read-only capabilities for public CSV ingestion', () => {
    expect(CRYPTPAD_CSV_INPUT_CAPABILITIES.readTables).toBe(true);
    expect(CRYPTPAD_CSV_INPUT_CAPABILITIES.publicReadNoAuth).toBe(true);
    expect(CRYPTPAD_CSV_INPUT_CAPABILITIES.syncBack).toBe(false);
    expect(CRYPTPAD_CSV_INPUT_CAPABILITIES.writeTables).toBe(false);
  });

  it('reads CSV from local file sources and parses rows', async () => {
    const provider = createCryptPadCsvInputProvider(
      {
        sources: [{ tableName: 'home', filePath: '/tmp/home.csv' }],
      },
      {
        readCsvFile: vi
          .fn()
          .mockResolvedValue('key,en,de\nwelcome,Welcome,Willkommen\ncta,Buy,Kaufen\n'),
        fetchCsv: vi.fn(),
      },
    );

    const result = await provider.readTables({});

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('home');
    expect(result.tables[0].rows).toEqual([
      { key: 'welcome', en: 'Welcome', de: 'Willkommen' },
      { key: 'cta', en: 'Buy', de: 'Kaufen' },
    ]);
  });

  it('reads CSV from URL sources', async () => {
    const fetchCsv = vi.fn().mockResolvedValue('key,en\nheadline,Hello from cryptpad\n');

    const provider = createCryptPadCsvInputProvider(
      {
        sources: [{ tableName: 'landing', url: 'https://cryptpad.fr/export.csv' }],
      },
      {
        fetchCsv,
        readCsvFile: vi.fn(),
      },
    );

    const result = await provider.readTables({ tableNames: ['landing'] });

    expect(fetchCsv).toHaveBeenCalledWith('https://cryptpad.fr/export.csv', undefined);
    expect(result.tables[0].rows[0]).toEqual({
      key: 'headline',
      en: 'Hello from cryptpad',
    });
  });

  it('filters tables by request.tableNames', async () => {
    const readCsvFile = vi.fn().mockResolvedValue('key,en\nwelcome,Welcome\n');

    const provider = createCryptPadCsvInputProvider(
      {
        sources: [
          { tableName: 'home', filePath: '/tmp/home.csv' },
          { tableName: 'about', filePath: '/tmp/about.csv' },
        ],
      },
      {
        readCsvFile,
        fetchCsv: vi.fn(),
      },
    );

    const result = await provider.readTables({ tableNames: ['about'] });

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('about');
    expect(readCsvFile).toHaveBeenCalledTimes(1);
  });

  it('throws if a source has neither url nor filePath', async () => {
    const provider = createCryptPadCsvInputProvider(
      {
        sources: [{ tableName: 'broken' }],
      },
      {
        readCsvFile: vi.fn(),
        fetchCsv: vi.fn(),
      },
    );

    await expect(provider.readTables({})).rejects.toThrow(
      'Source "broken" must define either url or filePath.',
    );
  });
});
