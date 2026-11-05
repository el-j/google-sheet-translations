import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, '../../dist-cli/setup-wif.mjs');

describe('CLI Integration: gst-setup-wif binary', () => {
  it('prints help text with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help']);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('--project');
    expect(stdout).toContain('--service-account');
    expect(stdout).toContain('--repo');
  });

  it('fails with exit code 1 in non-interactive mode when required options are missing', async () => {
    try {
      await execFileAsync('node', [cliPath, '--non-interactive']);
      expect.unreachable('Should have exited with code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
    }
  });
});
