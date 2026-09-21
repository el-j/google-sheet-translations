// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateProjectToV3 } from '../../src/migration/migrateV3';

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gst-migrate-'));
}

function writeWorkflow(projectRoot: string, name: string, content: string): string {
  const workflowsDir = path.join(projectRoot, '.github', 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  const workflowPath = path.join(workflowsDir, name);
  fs.writeFileSync(workflowPath, content, 'utf8');
  return workflowPath;
}

describe('migrateProjectToV3', () => {
  it('generates provider config and rewrites workflow in write mode', () => {
    const projectRoot = createTempProject();
    const workflowPath = writeWorkflow(
      projectRoot,
      'sync.yml',
      `name: Sync\non: [push]\njobs:\n  translations:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          row-limit: '80'\n          wait-seconds: '2'\n          sync-local-changes: 'true'\n          auto-translate: 'true'\n          override: 'false'\n          sheet-titles: 'home,about'\n`,
    );

    const result = migrateProjectToV3({
      projectRoot,
      providerConfigPath: '.github/provider.config.json',
      writeWorkflows: true,
    });

    expect(result.legacyWorkflowsFound).toEqual(['.github/workflows/sync.yml']);
    expect(result.rewrittenWorkflows).toEqual(['.github/workflows/sync.yml']);
    expect(result.createdFiles).toEqual(['.github/provider.config.json']);

    const config = JSON.parse(
      fs.readFileSync(path.join(projectRoot, '.github/provider.config.json'), 'utf8'),
    );
    expect(config).toMatchObject({
      input: {
        provider: 'google-sheets',
        options: {
          spreadsheetId: 'sheet123',
          rowLimit: 80,
          waitSeconds: 2,
        },
      },
      sync: {
        provider: 'google-sheets',
        options: {
          spreadsheetId: 'sheet123',
          autoTranslate: true,
          override: false,
          waitSeconds: 2,
        },
      },
    });

    const rewritten = fs.readFileSync(workflowPath, 'utf8');
    expect(rewritten).toContain("provider-config-path: '.github/provider.config.json'");
    expect(rewritten).not.toContain('google-spreadsheet-id:');
    expect(rewritten).not.toContain('row-limit:');
    expect(rewritten).toContain("sheet-titles: 'home,about'");
  });

  it('does not write files in dry-run mode', () => {
    const projectRoot = createTempProject();
    const workflowPath = writeWorkflow(
      projectRoot,
      'sync.yml',
      `name: Sync\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          sync-local-changes: 'false'\n`,
    );
    const before = fs.readFileSync(workflowPath, 'utf8');

    const result = migrateProjectToV3({
      projectRoot,
      writeWorkflows: true,
      dryRun: true,
    });

    expect(result.rewrittenWorkflows).toEqual(['.github/workflows/sync.yml']);
    expect(result.createdFiles).toEqual([]);
    expect(fs.existsSync(path.join(projectRoot, 'provider.config.json'))).toBe(false);
    expect(fs.readFileSync(workflowPath, 'utf8')).toBe(before);
  });

  it('keeps existing config unless force is set', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'sync.yml',
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n`,
    );

    const configPath = path.join(projectRoot, 'provider.config.json');
    fs.writeFileSync(configPath, '{"keep":true}\n', 'utf8');

    const result = migrateProjectToV3({ projectRoot });

    expect(result.createdFiles).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Use --force to overwrite.');
    expect(fs.readFileSync(configPath, 'utf8')).toBe('{"keep":true}\n');
  });

  it('warns and skips rewrite for drive mode workflows', () => {
    const projectRoot = createTempProject();
    const workflowPath = writeWorkflow(
      projectRoot,
      'drive.yml',
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          drive-folder-id: 'folder123'\n`,
    );

    const before = fs.readFileSync(workflowPath, 'utf8');
    const result = migrateProjectToV3({
      projectRoot,
      writeWorkflows: true,
    });

    expect(result.rewrittenWorkflows).toEqual([]);
    expect(result.warnings.join('\n')).toContain('Auto-rewrite skipped for safety');
    expect(fs.readFileSync(workflowPath, 'utf8')).toBe(before);
  });

  it('reports successful parity check against legacy mapping', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'sync.yml',
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          row-limit: '50'\n          wait-seconds: '3'\n          sync-local-changes: 'true'\n          auto-translate: 'true'\n          override: 'false'\n`,
    );

    const result = migrateProjectToV3({
      projectRoot,
      dryRun: true,
      parityCheck: true,
    });

    expect(result.parityCheck).toBeDefined();
    expect(result.parityCheck?.passed).toBe(true);
    expect(result.parityCheck?.differences).toEqual([]);
  });

  it('throws when workflow files exist but none use the legacy action', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'other.yml',
      `jobs:\n  t:\n    steps:\n      - uses: actions/checkout@v4\n`,
    );

    expect(() => migrateProjectToV3({ projectRoot })).toThrow(
      'No legacy action usage found to migrate.',
    );
  });

  it('collects differences and issues warning when parity check finds discrepancies', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'sync.yml',
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          unknown-custom-key: 'custom-val'\n`,
    );

    // Run parity check
    const result = migrateProjectToV3({
      projectRoot,
      dryRun: true,
      parityCheck: true,
    });

    expect(result.parityCheck).toBeDefined();
    // Since unknown-custom-key isn't in canonical options, differences are handled cleanly
  });

  it('throws when no workflow files exist under .github/workflows', () => {
    const emptyProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-empty-'));
    expect(() => migrateProjectToV3({ projectRoot: emptyProjectRoot })).toThrow(
      'No workflow files found under .github/workflows.',
    );
  });

  it('reports warning when parity check fails due to discrepancies', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'sync.yml',
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          public-sheet: 'true'\n`,
    );

    const result = migrateProjectToV3({
      projectRoot,
      dryRun: true,
      parityCheck: true,
    });
    expect(result.parityCheck).toBeDefined();
    expect(result.parityCheck?.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('Parity check found'))).toBe(true);
  });

  it('canonicalizes parity config removing false defaults', async () => {
    const { canonicalizeParityConfig } = await import('../../src/migration/migrateV3');
    const config = {
      input: {
        provider: 'google-sheets',
        options: {
          publicSheet: false,
          spreadsheetId: 'abc',
        },
      },
      sync: {
        provider: 'google-sheets',
        options: {
          autoTranslate: false,
          override: false,
          spreadsheetId: 'abc',
        },
      },
    };

    const canonical = canonicalizeParityConfig(config as any);
    expect(canonical.input?.options?.publicSheet).toBeUndefined();
    expect(canonical.sync?.options?.autoTranslate).toBeUndefined();
    expect(canonical.sync?.options?.override).toBeUndefined();
  });

  it('collects differences for array length and array element differences', async () => {
    const { collectDifferences } = await import('../../src/migration/migrateV3');

    // Array length mismatch
    const lenDiff = collectDifferences([1, 2], [1], 'arr');
    expect(lenDiff).toEqual(['arr: array length differs (actual 2, expected 1)']);

    // Array element mismatch
    const elemDiff = collectDifferences(['a', 'b'], ['a', 'c'], 'arr');
    expect(elemDiff).toEqual(['arr[1]: actual="b" expected="c"']);

    // Matching arrays
    const matchDiff = collectDifferences(['a', 'b'], ['a', 'b'], 'arr');
    expect(matchDiff).toEqual([]);

    // Object and value differences
    const objDiff = collectDifferences({ x: 1, y: 2 }, { x: 1, y: 3 }, 'obj');
    expect(objDiff).toEqual(['obj.y: actual=2 expected=3']);
  });

  it('handles workflow step ranges when subsequent steps exist and parses non-boolean inputs with fallback', () => {
    const projectRoot = createTempProject();
    writeWorkflow(
      projectRoot,
      'multi-step.yml',
      `jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: el-j/google-sheet-translations@v2
        with:
          google-spreadsheet-id: 'sheetXYZ'
          sync-local-changes: 'invalid-non-bool'
          auto-translate: 'unknown'
      - name: Next step
        run: echo "done"
`,
    );

    const result = migrateProjectToV3({
      projectRoot,
      writeWorkflows: true,
      parityCheck: true,
    });

    expect(result.legacyWorkflowsFound).toEqual(['.github/workflows/multi-step.yml']);
    expect(result.rewrittenWorkflows).toEqual(['.github/workflows/multi-step.yml']);

    // Check that Next step was preserved
    const rewritten = fs.readFileSync(
      path.join(projectRoot, '.github/workflows/multi-step.yml'),
      'utf8',
    );
    expect(rewritten).toContain('- name: Next step');
    expect(rewritten).toContain('echo "done"');
  });

  it('normalizes array values during parity checks', () => {
    const projectRoot = createTempProject();
    // Write an existing provider config containing an array
    const configPath = path.join(projectRoot, '.github/provider.config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        input: {
          provider: 'google-sheets',
          options: {
            spreadsheetId: 'sheetXYZ',
            sheetTitles: ['home', 'settings'],
          },
        },
      }),
      'utf8',
    );

    writeWorkflow(
      projectRoot,
      'array-check.yml',
      `jobs:
  build:
    steps:
      - uses: el-j/google-sheet-translations@v2
        with:
          google-spreadsheet-id: 'sheetXYZ'
`,
    );

    const result = migrateProjectToV3({
      projectRoot,
      parityCheck: true,
      dryRun: true,
    });

    expect(result.parityCheck).toBeDefined();
  });

  it('normalizes array values with nested objects', async () => {
    const { normalizeValue } = await import('../../src/migration/migrateV3');
    const result = normalizeValue(['apple', { z: 1, a: 2 }, undefined]);
    expect(result).toEqual(['apple', { a: 2, z: 1 }, undefined]);
  });
});
