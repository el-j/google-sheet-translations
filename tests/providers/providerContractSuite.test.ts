import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleSheetsInputProvider,
  createCryptPadCsvInputProvider,
  assertOperationCapabilities,
  createCapabilitySet,
} from '../../src/providers';
import type { TranslationInputProvider } from '../../src/providers';

async function runInputProviderContractChecks(
  provider: TranslationInputProvider,
): Promise<void> {
  expect(provider.kind).toBe('input');
  expect(typeof provider.providerId).toBe('string');

  assertOperationCapabilities(
    provider.providerId,
    provider.capabilities,
    'read-input',
  );

  const result = await provider.readTables({ tableNames: ['home'] });
  expect(Array.isArray(result.tables)).toBe(true);

  for (const table of result.tables) {
    expect(typeof table.tableId).toBe('string');
    expect(typeof table.tableName).toBe('string');
    expect(Array.isArray(table.rows)).toBe(true);

    for (const row of table.rows) {
      expect(typeof row).toBe('object');
    }
  }
}

describe('provider contract suite', () => {
  it('cryptpad input provider satisfies input contract', async () => {
    const provider = createCryptPadCsvInputProvider({
      sources: [
        {
          tableName: 'home',
          filePath: path.resolve(
            __dirname,
            '../fixtures/providers/home.csv',
          ),
        },
      ],
    });

    await runInputProviderContractChecks(provider);
  });

  it('google input provider satisfies input contract in public mode', async () => {
    const provider = createGoogleSheetsInputProvider(
      {
        spreadsheetId: 'sheet-1',
        publicSheet: true,
      },
      {
        readPublicSheet: vi.fn().mockResolvedValue([
          { key: 'welcome', en: 'Welcome' },
        ]),
        withRetry: (fn: () => Promise<any>) => fn(),
      },
    );

    await runInputProviderContractChecks(provider);
  });

  it('fails capability gate for an invalid provider', () => {
    expect(() =>
      assertOperationCapabilities(
        'invalid-input',
        createCapabilitySet({ readTables: false }),
        'read-input',
      ),
    ).toThrow('missing required capabilities');
  });
});
