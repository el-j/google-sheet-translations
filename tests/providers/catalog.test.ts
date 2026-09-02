import { describe, expect, it } from 'vitest';
import {
  createDefaultProviderCatalog,
  createInMemoryProviderCatalogProvider,
  assertOperationCapabilities,
} from '../../src/providers';

describe('provider catalog discovery', () => {
  it('discovers default provider sources for google and cryptpad', async () => {
    const catalog = createDefaultProviderCatalog();
    const result = await catalog.discoverSources();

    expect(result.sources.some((source) => source.providerId === 'google-sheets')).toBe(true);
    expect(result.sources.some((source) => source.providerId === 'cryptpad-csv')).toBe(true);
    expect(result.sources.some((source) => source.providerId === 'cryptpad-assets')).toBe(true);
  });

  it('filters discovered sources by query', async () => {
    const catalog = createInMemoryProviderCatalogProvider({
      sources: [
        { providerId: 'google-sheets', sourceId: 'drive', kind: 'table', name: 'Drive' },
        { providerId: 'cryptpad-csv', sourceId: 'cryptpad', kind: 'table', name: 'CryptPad CSV' },
      ],
    });

    const result = await catalog.discoverSources({ query: 'cryptpad' });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].providerId).toBe('cryptpad-csv');
  });

  it('declares discover-sources capability gate', () => {
    const catalog = createDefaultProviderCatalog();
    expect(() => {
      assertOperationCapabilities(
        catalog.providerId,
        catalog.capabilities,
        'discover-sources',
      );
    }).not.toThrow();
  });
});
