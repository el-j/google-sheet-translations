import {
  PROVIDER_CAPABILITIES,
  EMPTY_PROVIDER_CAPABILITIES,
  OPERATION_CAPABILITY_REQUIREMENTS,
  createCapabilitySet,
  missingCapabilities,
  hasRequiredCapabilities,
  assertRequiredCapabilities,
  assertOperationCapabilities,
} from '../../src/providers';

describe('provider capabilities', () => {
  it('defines expected capability keys', () => {
    expect(PROVIDER_CAPABILITIES).toEqual([
      'readTables',
      'writeTables',
      'syncBack',
      'readAssets',
      'writeAssets',
      'autoTranslateFormula',
      'discoverByFolder',
      'assetSync',
      'publicReadNoAuth',
    ]);
  });

  it('creates capability sets with defaults', () => {
    const capabilities = createCapabilitySet();
    expect(capabilities).toEqual(EMPTY_PROVIDER_CAPABILITIES);
  });

  it('creates capability sets with overrides', () => {
    const capabilities = createCapabilitySet({
      readTables: true,
      publicReadNoAuth: true,
    });

    expect(capabilities.readTables).toBe(true);
    expect(capabilities.publicReadNoAuth).toBe(true);
    expect(capabilities.writeTables).toBe(false);
  });

  it('reports missing required capabilities', () => {
    const capabilities = createCapabilitySet({ readTables: true });
    expect(missingCapabilities(capabilities, ['readTables', 'syncBack'])).toEqual([
      'syncBack',
    ]);
  });

  it('supports explicit asset capability operations', () => {
    const capabilities = createCapabilitySet({ readAssets: true, writeAssets: true });
    expect(hasRequiredCapabilities(capabilities, ['readAssets'])).toBe(true);
    expect(hasRequiredCapabilities(capabilities, ['writeAssets'])).toBe(true);
  });

  it('validates required capabilities', () => {
    const capabilities = createCapabilitySet({
      readTables: true,
      syncBack: true,
    });

    expect(hasRequiredCapabilities(capabilities, ['readTables'])).toBe(true);
    expect(hasRequiredCapabilities(capabilities, ['readTables', 'syncBack'])).toBe(
      true,
    );
    expect(hasRequiredCapabilities(capabilities, ['writeTables'])).toBe(false);
  });

  it('throws when required capability is missing', () => {
    const capabilities = createCapabilitySet({ readTables: true });

    expect(() => {
      assertRequiredCapabilities(
        'cryptpad-csv',
        capabilities,
        ['readTables', 'syncBack'],
        'sync',
      );
    }).toThrow(
      'Provider "cryptpad-csv" is missing required capabilities for operation "sync": syncBack',
    );
  });

  it('does not throw when required capabilities are satisfied', () => {
    const capabilities = createCapabilitySet({ readTables: true, syncBack: true });

    expect(() => {
      assertRequiredCapabilities('google-sheets', capabilities, ['readTables', 'syncBack']);
    }).not.toThrow();
  });

  it('enforces operation requirement mapping', () => {
    const capabilities = createCapabilitySet({
      readTables: true,
      publicReadNoAuth: true,
    });

    expect(OPERATION_CAPABILITY_REQUIREMENTS['public-read']).toEqual([
      'readTables',
      'publicReadNoAuth',
    ]);

    expect(() => {
      assertOperationCapabilities('public-source', capabilities, 'public-read');
    }).not.toThrow();

    expect(() => {
      assertOperationCapabilities('public-source', capabilities, 'sync-back');
    }).toThrow(
      'Provider "public-source" is missing required capabilities for operation "sync-back": syncBack',
    );
  });
});
