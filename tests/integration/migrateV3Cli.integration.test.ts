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
});
