import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, '../../dist-cli/run-provider.mjs');

describe('CLI Integration: gst-run-provider binary', () => {
  it('prints help text with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help']);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--sheet-titles');
  });

  it('fails with exit code 1 when required config arg is missing', async () => {
    try {
      await execFileAsync('node', [cliPath]);
      expect.unreachable('Should have exited with code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
    }
  });
});
