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

  it('reports actionable errors for invalid configs', () => {
    const result = validateProviderRuntimeConfig({
      input: {},
      output: 'invalid',
      sync: { provider: '' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain('Input provider must define a non-empty "provider" string.');
    expect(result.errors.join(' | ')).toContain('Output provider must be an object when provided.');
    expect(result.errors.join(' | ')).toContain('Sync provider must define a non-empty "provider" string.');
  });

  it('rejects invalid cryptpad sync combination when sync provider is not cryptpad-workspace', () => {
    const result = validateProviderRuntimeConfig({
      input: { provider: 'cryptpad-csv' },
      sync: { provider: 'google-sheets' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('only supports sync mode via "cryptpad-workspace"');
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
