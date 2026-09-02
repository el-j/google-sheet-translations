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

  it('throws when no workflow files exist', () => {
    const projectRoot = createTempProject();
    expect(() => migrateProjectToV3({ projectRoot })).toThrow(
      'No workflow files found under .github/workflows.',
    );
  });
});
