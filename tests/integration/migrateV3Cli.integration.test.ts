import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, '../../dist-cli/migrate-v3.mjs');

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gst-migrate-cli-'));
}

describe('CLI Integration: gst-migrate-v3 binary', () => {
  it('prints help text with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help']);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('--write-workflows');
    expect(stdout).toContain('--provider-config-path');
  });

  it('fails with exit code 1 when workflows folder is missing', async () => {
    const projectRoot = createTempProject();

    try {
      await execFileAsync('node', [cliPath, `--project-root=${projectRoot}`]);
      expect.unreachable('Should have exited with code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(String(err.stderr || '')).toContain('No workflow files found under .github/workflows.');
    }
  });

  it('runs in dry-run mode on a legacy workflow', async () => {
    const projectRoot = createTempProject();
    const workflowsDir = path.join(projectRoot, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowsDir, 'sync.yml'),
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n`,
      'utf8',
    );

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--project-root=${projectRoot}`,
      '--dry-run',
      '--write-workflows',
    ]);

    expect(stdout).toContain('Migration summary:');
    expect(stdout).toContain('- Legacy workflows found: 1');
    expect(stdout).toContain('- Created files: 0');
    expect(fs.existsSync(path.join(projectRoot, 'provider.config.json'))).toBe(false);
  });

  it('supports parity-check mode and reports pass', async () => {
    const projectRoot = createTempProject();
    const workflowsDir = path.join(projectRoot, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowsDir, 'sync.yml'),
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          row-limit: '10'\n`,
      'utf8',
    );

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--project-root=${projectRoot}`,
      '--dry-run',
      '--parity-check',
    ]);

    expect(stdout).toContain('Parity check:');
    expect(stdout).toContain('- Passed: yes');
  });

  it('writes the provider config and rewrites the workflow file when run without --dry-run', async () => {
    const projectRoot = createTempProject();
    const workflowsDir = path.join(projectRoot, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const workflowPath = path.join(workflowsDir, 'sync.yml');
    fs.writeFileSync(
      workflowPath,
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n          row-limit: '10'\n`,
      'utf8',
    );

    const providerConfigPath = 'generated/provider.config.json';

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--project-root=${projectRoot}`,
      `--provider-config-path=${providerConfigPath}`,
      '--write-workflows',
    ]);

    expect(stdout).toContain('Migration summary:');
    expect(stdout).toContain('- Legacy workflows found: 1');
    expect(stdout).toContain('- Rewritten workflows: 1');
    expect(stdout).toContain('- Created files: 1');

    const absoluteConfigPath = path.join(projectRoot, providerConfigPath);
    expect(fs.existsSync(absoluteConfigPath)).toBe(true);
    const createdConfig = JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf8'));
    expect(createdConfig.input.provider).toBe('google-sheets');
    expect(createdConfig.input.options.spreadsheetId).toBe('sheet123');

    const rewritten = fs.readFileSync(workflowPath, 'utf8');
    expect(rewritten).toContain(`provider-config-path: '${providerConfigPath}'`);
    expect(rewritten).not.toContain('google-spreadsheet-id:');
  });

  it('reports an existing provider config and requires --force to overwrite it', async () => {
    const projectRoot = createTempProject();
    const workflowsDir = path.join(projectRoot, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowsDir, 'sync.yml'),
      `jobs:\n  t:\n    steps:\n      - uses: el-j/google-sheet-translations@v2\n        with:\n          google-spreadsheet-id: 'sheet123'\n`,
      'utf8',
    );
    fs.writeFileSync(path.join(projectRoot, 'provider.config.json'), '{"stale":true}\n', 'utf8');

    const { stdout: firstRun } = await execFileAsync('node', [
      cliPath,
      `--project-root=${projectRoot}`,
    ]);
    expect(firstRun).toContain('- Created files: 0');
    expect(firstRun).toContain('Use --force to overwrite');
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'provider.config.json'), 'utf8'))).toEqual({
      stale: true,
    });

    const { stdout: forcedRun } = await execFileAsync('node', [
      cliPath,
      `--project-root=${projectRoot}`,
      '--force',
    ]);
    expect(forcedRun).toContain('- Created files: 1');
    const overwritten = JSON.parse(fs.readFileSync(path.join(projectRoot, 'provider.config.json'), 'utf8'));
    expect(overwritten.input.provider).toBe('google-sheets');
  });
});
