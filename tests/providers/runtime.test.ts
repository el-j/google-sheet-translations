import { describe, expect, it } from 'vitest';
import {
  createProvidersFromRuntimeConfig,
  requiresGoogleAuthForRuntimeConfig,
} from '../../src/providers/runtime';

describe('provider runtime factory', () => {
  it('creates cryptpad input provider from runtime config', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: {
          sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }],
        },
      },
    });

    expect(selection.inputProvider.providerId).toBe('cryptpad-csv');
    expect(selection.outputProvider).toBeUndefined();
  });

  it('creates google output and sync providers when configured', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      output: {
        provider: 'google-sheets',
        options: { spreadsheetId: 'abc' },
      },
      sync: {
        provider: 'google-sheets',
        options: { spreadsheetId: 'abc' },
      },
    });

    expect(selection.outputProvider?.providerId).toBe('google-sheets');
    expect(selection.syncProvider?.providerId).toBe('google-sheets');
  });

  it('creates cryptpad-workspace output and sync providers when configured', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      output: {
        provider: 'cryptpad-workspace',
        options: { filePath: './tmp/cryptpad-state.json' },
      },
      sync: {
        provider: 'cryptpad-workspace',
        options: { filePath: './tmp/cryptpad-state.json', conflictPolicy: 'manual' },
      },
    });

    expect(selection.outputProvider?.providerId).toBe('cryptpad-workspace');
    expect(selection.syncProvider?.providerId).toBe('cryptpad-workspace');
  });

  it('infers auth requirement for google-sheet input in authenticated mode', () => {
    const needsAuth = requiresGoogleAuthForRuntimeConfig({
      input: {
        provider: 'google-sheets',
        options: { publicSheet: false },
      },
    });

    expect(needsAuth).toBe(true);
  });

  it('does not require auth for cryptpad-only mode', () => {
    const needsAuth = requiresGoogleAuthForRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
    });

    expect(needsAuth).toBe(false);
  });

  it('throws for unsupported provider IDs', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: { provider: 'airtable' },
      } as any),
    ).toThrow('Unsupported input provider');
  });
});
