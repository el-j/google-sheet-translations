// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  createProvidersFromRuntimeConfig,
  requiresGoogleAuthForRuntimeConfig,
} from '../../src/providers/runtime';

describe('provider runtime factory', () => {
  it('creates a google-sheets input provider from runtime config', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: { provider: 'google-sheets', options: { spreadsheetId: 'abc' } },
    });

    expect(selection.inputProvider.providerId).toBe('google-sheets');
  });

  it('throws when cryptpad-csv input is missing an array "sources" option', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: { provider: 'cryptpad-csv', options: {} },
      }),
    ).toThrow('cryptpad-csv input provider requires an array "sources" option');
  });

  it('throws when cryptpad-workspace output is missing a "filePath" option', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        output: { provider: 'cryptpad-workspace', options: {} },
      }),
    ).toThrow('cryptpad-workspace output provider requires a non-empty "filePath" option');
  });

  it('throws for unsupported output provider IDs', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        output: { provider: 'airtable' },
      } as any),
    ).toThrow('Unsupported output provider');
  });

  it('throws when cryptpad-workspace sync is missing a "filePath" option', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        sync: { provider: 'cryptpad-workspace', options: {} },
      }),
    ).toThrow('cryptpad-workspace sync provider requires a non-empty "filePath" option');
  });

  it('throws for unsupported sync provider IDs', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        sync: { provider: 'airtable' },
      } as any),
    ).toThrow('Unsupported sync provider');
  });

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

  it('requires auth when a non-google input pairs with a google-sheets output or sync', () => {
    expect(
      requiresGoogleAuthForRuntimeConfig({
        input: { provider: 'cryptpad-csv' },
        output: { provider: 'google-sheets' },
      }),
    ).toBe(true);

    expect(
      requiresGoogleAuthForRuntimeConfig({
        input: { provider: 'cryptpad-csv' },
        sync: { provider: 'google-sheets' },
      }),
    ).toBe(true);
  });

  it('does not require auth for google-sheets input when publicSheet is true', () => {
    expect(
      requiresGoogleAuthForRuntimeConfig({
        input: { provider: 'google-sheets', options: { publicSheet: true } },
      }),
    ).toBe(false);
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

  it('creates a cryptpad-assets asset sync provider when configured', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      assetSync: {
        provider: 'cryptpad-assets',
        options: { manifestPath: './fixtures/assets.json' },
      },
    });

    expect(selection.assetSyncProvider?.providerId).toBe('cryptpad-assets');
    expect(selection.assetSyncProvider?.capabilities.assetSync).toBe(true);
  });

  it('leaves assetSyncProvider undefined when not configured', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
    });

    expect(selection.assetSyncProvider).toBeUndefined();
  });

  it('throws when cryptpad-assets is missing a manifestPath option', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        assetSync: { provider: 'cryptpad-assets', options: {} },
      }),
    ).toThrow('cryptpad-assets sync provider requires a non-empty "manifestPath" option');
  });

  it('throws for unsupported asset sync provider IDs', () => {
    expect(() =>
      createProvidersFromRuntimeConfig({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
        },
        assetSync: { provider: 'dropbox' },
      } as any),
    ).toThrow('Unsupported asset sync provider');
  });

  it('creates cryptpad-sheet and cryptpad output and sync providers with full options', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      output: {
        provider: 'cryptpad-sheet',
        options: {
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/test-seed/',
          password: 'secret-password',
          override: true,
          localeMapping: { en: 'en-US' },
          providerId: 'custom-cp-out',
          displayName: 'Custom CP Out',
          timeoutMs: 5000,
        },
      },
      sync: {
        provider: 'cryptpad',
        options: {
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/test-seed/',
          password: 'secret-password',
          override: true,
          conflictPolicy: 'local-wins',
          localeMapping: { en: 'en-US' },
          providerId: 'custom-cp-sync',
          displayName: 'Custom CP Sync',
          timeoutMs: 5000,
        },
      },
    });

    expect(selection.outputProvider?.providerId).toBe('custom-cp-out');
    expect(selection.outputProvider?.displayName).toBe('Custom CP Out');
    expect(selection.syncProvider?.providerId).toBe('custom-cp-sync');
    expect(selection.syncProvider?.displayName).toBe('Custom CP Sync');
  });

  it('creates cryptpad sync provider with remote-wins conflict policy', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      sync: {
        provider: 'cryptpad-sheet',
        options: {
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/test-seed/',
          conflictPolicy: 'remote-wins',
        },
      },
    });

    expect(selection.syncProvider?.providerId).toBe('cryptpad-sheet');
  });

  it('creates cryptpad-workspace sync provider with custom providerId and displayName', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      sync: {
        provider: 'cryptpad-workspace',
        options: {
          filePath: './snapshot.json',
          providerId: 'custom-workspace-sync',
          displayName: 'Custom Workspace Sync',
          conflictPolicy: 'remote-wins',
        },
      },
    });

    expect(selection.syncProvider?.providerId).toBe('custom-workspace-sync');
    expect(selection.syncProvider?.displayName).toBe('Custom Workspace Sync');
  });

  it('creates cryptpad-assets provider using driveUrl with password and custom metadata', () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-csv',
        options: { sources: [{ tableName: 'home', filePath: './fixtures/home.csv' }] },
      },
      assetSync: {
        provider: 'cryptpad-assets',
        options: {
          driveUrl: 'https://cryptpad.fr/drive/#/2/drive/view/abc/',
          password: 'drive-password',
          providerId: 'custom-drive-assets',
          displayName: 'Custom Drive Assets',
        },
      },
    });

    expect(selection.assetSyncProvider?.providerId).toBe('custom-drive-assets');
    expect(selection.assetSyncProvider?.displayName).toBe('Custom Drive Assets');
  });
});
