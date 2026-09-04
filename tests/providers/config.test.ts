import { describe, expect, it } from 'vitest';
import {
  validateProviderRuntimeConfig,
  assertValidProviderRuntimeConfig,
  mapLegacyGoogleOptionsToProviderConfig,
} from '../../src/providers/config';

describe('provider config schema and validation', () => {
  it('validates a minimal runtime config', () => {
    const result = validateProviderRuntimeConfig({
      input: {
        provider: 'google-sheets',
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-object config', () => {
    const result = validateProviderRuntimeConfig('not-an-object');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Provider config must be an object.']);
  });

  it('reports actionable errors for invalid configs', () => {
    const result = validateProviderRuntimeConfig({
      input: {},
      output: 'invalid',
      sync: { provider: '' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain(
      'Input provider must define a non-empty "provider" string.',
    );
    expect(result.errors.join(' | ')).toContain('Output provider must be an object when provided.');
    expect(result.errors.join(' | ')).toContain(
      'Sync provider must define a non-empty "provider" string.',
    );
  });

  it('reports an error for an output provider with an empty "provider" string', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'google-sheets' },
      output: { provider: '' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Output provider must define a non-empty "provider" string.');
  });

  it('reports an error for a non-object sync provider', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'google-sheets' },
      sync: 'invalid',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Sync provider must be an object when provided.');
  });

  it('rejects invalid cryptpad sync combination when sync provider is not cryptpad-workspace', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      sync: { provider: 'google-sheets' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('only supports sync mode via "cryptpad-workspace"');
  });

  it('reports errors for an invalid assetSync provider shape', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      assetSync: 'invalid',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Asset sync provider must be an object when provided.');
  });

  it('reports errors for an assetSync provider missing a "provider" string', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      assetSync: { provider: '' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Asset sync provider must define a non-empty "provider" string.',
    );
  });

  it('accepts a valid assetSync provider config', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      assetSync: { provider: 'cryptpad-assets', options: { manifestPath: './assets.json' } },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts cryptpad-csv input + cryptpad-workspace sync combination', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      sync: { provider: 'cryptpad-workspace', options: { filePath: './cryptpad-state.json' } },
    });

    expect(result.valid).toBe(true);
  });

  it('throws on invalid runtime config in assert helper', () => {
    expect(() => assertValidProviderRuntimeConfig({})).toThrow('Invalid provider configuration:');
  });

  it('returns the typed config unchanged from assert helper when valid', () => {
    const config = { input: { provider: 'google-sheets' } };
    expect(assertValidProviderRuntimeConfig(config)).toBe(config);
  });

  it('maps legacy Google options to provider-centric config with deprecation message', () => {
    const mapped = mapLegacyGoogleOptionsToProviderConfig({
      spreadsheetId: 'abc123',
      rowLimit: 42,
      waitSeconds: 3,
      publicSheet: true,
      syncLocalChanges: true,
      autoTranslate: true,
      override: true,
    });

    expect(mapped.deprecations[0]).toContain('deprecated');
    expect(mapped.config.input.provider).toBe('google-sheets');
    expect(mapped.config.sync?.provider).toBe('google-sheets');
    expect(mapped.config.input.options).toMatchObject({
      spreadsheetId: 'abc123',
      rowLimit: 42,
      waitSeconds: 3,
      publicSheet: true,
    });
  });

  it('omits sync provider when legacy syncLocalChanges=false', () => {
    const mapped = mapLegacyGoogleOptionsToProviderConfig({
      spreadsheetId: 'abc123',
      syncLocalChanges: false,
    });

    expect(mapped.config.sync).toBeUndefined();
  });
});
