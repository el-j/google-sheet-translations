// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { transformRowsToSheetData } from '../../src/core/rowTransformer';
import { assertRequiredCapabilities } from '../../src/providers/capabilities';
import { validateProviderRuntimeConfig } from '../../src/providers/config';
import { runProviderPipeline } from '../../src/providers/orchestrator';
import { sanitizeFolderName } from '../../src/utils/driveSpreadsheetBootstrap';
import { isDataJsonNewer } from '../../src/utils/isDataJsonNewer';
import { walkDirectory } from '../../src/utils/localImageUtils';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('uncovered branch edge cases', () => {
  it('handles rowTransformer without custom logger (defaulting to console)', () => {
    const res = transformRowsToSheetData([{ key: 'k1', en: 'v1' }], 'home', {
      filterValidLocales: () => ['en'],
      createLocaleMapping: () => ({
        normalizedLocales: ['en'],
        localeMapping: { en: 'en' },
        originalMapping: { en: 'en' },
      }),
    });
    expect(res.success).toBe(true);
    expect(res.locales).toEqual(['en']);
    expect(res.translations.en.home.k1).toBe('v1');
  });

  it('asserts required capabilities without operation parameter', () => {
    expect(() =>
      assertRequiredCapabilities('test-provider', { readTables: false } as any, ['readTables']),
    ).toThrow('Provider "test-provider" is missing required capabilities: readTables');
  });

  it('validates provider runtime config with invalid output.provider string', () => {
    const res = validateProviderRuntimeConfig({
      input: { provider: 'google-sheets' },
      output: { provider: '' },
    });
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Output provider must define a non-empty "provider" string.');
  });

  it('merges multiple sheets across locales in runProviderPipeline', async () => {
    const inputProvider = {
      kind: 'input',
      providerId: 'multi-sheet-test',
      capabilities: { readTables: true },
      readTables: vi.fn().mockResolvedValue({
        tables: [
          {
            tableName: 'home',
            rows: [{ key: 'k1', en: 'Home En' }],
          },
          {
            tableName: 'about',
            rows: [{ key: 'k2', en: 'About En' }],
          },
        ],
      }),
    };

    const res = await runProviderPipeline(
      {
        inputProvider: inputProvider as any,
      },
      {
        transformRows: (rows, tableName) => ({
          success: true,
          locales: ['en'],
          localeMapping: { en: 'en' },
          originalMapping: { en: 'en' },
          translations: {
            en: {
              [tableName]: { [rows[0].key]: rows[0].en },
            },
          },
        }),
      },
    );

    expect(res.translations.en.home.k1).toBe('Home En');
    expect(res.translations.en.about.k2).toBe('About En');
  });

  it('sanitizes folder name falling back to "sheet" for empty string or invalid chars', () => {
    expect(sanitizeFolderName('')).toBe('sheet');
    expect(sanitizeFolderName('---')).toBe('sheet');
    expect(sanitizeFolderName('My Cool Folder!')).toBe('my-cool-folder');
  });

  it('compares file modification times with isDataJsonNewer when older translation file exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-mtime-'));
    const dataJson = path.join(tempDir, 'data.json');
    const outDir = path.join(tempDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });

    const f1 = path.join(outDir, 'de.json');
    const f2 = path.join(outDir, 'en.json');

    fs.writeFileSync(dataJson, '{}');
    fs.writeFileSync(f1, '{}');
    fs.writeFileSync(f2, '{}');

    const now = new Date();
    const older = new Date(now.getTime() - 10000);
    const oldest = new Date(now.getTime() - 20000);

    fs.utimesSync(f1, oldest, oldest);
    fs.utimesSync(f2, older, older);
    fs.utimesSync(dataJson, now, now);

    // data.json is newer than both
    expect(isDataJsonNewer(dataJson, outDir)).toBe(true);

    // Reverse: data.json older than translation file
    fs.utimesSync(dataJson, oldest, oldest);
    expect(isDataJsonNewer(dataJson, outDir)).toBe(false);
  });

  it('handles walkDirectory when entry is not a file or directory (symlink/other)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-walk-'));
    const targetFile = path.join(tempDir, 'target.png');
    const linkPath = path.join(tempDir, 'symlink.png');

    fs.writeFileSync(targetFile, 'data');
    try {
      fs.symlinkSync(targetFile, linkPath);
    } catch {
      // Symlinks might require special perms on some environments
    }

    const files = await walkDirectory(tempDir, { extensions: ['.png'] });
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});
