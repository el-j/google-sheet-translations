// @ts-nocheck
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, '../../dist-cli/cryptpad.mjs');

describe('CLI Integration: gst-cryptpad binary', () => {
  it('prints help text with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help']);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('COMMANDS');
    expect(stdout).toContain('pull');
    expect(stdout).toContain('push');
    expect(stdout).toContain('sync');
    expect(stdout).toContain('inspect');
    expect(stdout).toContain('drive-scan');
    expect(stdout).toContain('--url=URL');
    expect(stdout).toContain('--password=PW');
  });

  it('fails with exit code 1 when no url is provided', async () => {
    try {
      await execFileAsync('node', [cliPath], {
        env: { ...process.env, CRYPTPAD_URL: '', CRYPTPAD_DRIVE_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });

  it('fails with exit code 1 for unknown command when url is provided', async () => {
    try {
      await execFileAsync('node', [
        cliPath,
        'invalid-command',
        '--url=https://cryptpad.fr/sheet/#/2/sheet/edit/seed/',
      ]);
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Unknown command');
    }
  });

  it('fails with exit code 1 when inspect is called without --url or env', async () => {
    try {
      await execFileAsync('node', [cliPath, 'inspect'], {
        env: { ...process.env, CRYPTPAD_URL: '', CRYPTPAD_DRIVE_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });

  it('fails with exit code 1 when pull is called without --url or env', async () => {
    try {
      await execFileAsync('node', [cliPath, 'pull'], {
        env: { ...process.env, CRYPTPAD_URL: '', CRYPTPAD_DRIVE_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });

  it('fails with exit code 1 when push is called without --url or env', async () => {
    try {
      await execFileAsync('node', [cliPath, 'push'], {
        env: { ...process.env, CRYPTPAD_URL: '', CRYPTPAD_DRIVE_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });

  it('fails with exit code 1 when sync is called without --url or env', async () => {
    try {
      await execFileAsync('node', [cliPath, 'sync'], {
        env: { ...process.env, CRYPTPAD_URL: '', CRYPTPAD_DRIVE_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });

  it('fails with exit code 1 when drive-scan is called without --url or env', async () => {
    try {
      await execFileAsync('node', [cliPath, 'drive-scan'], {
        env: { ...process.env, CRYPTPAD_DRIVE_URL: '', CRYPTPAD_URL: '' },
      });
      expect.unreachable('Should have failed with exit code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr || err.stdout).toContain('Missing required --url option');
    }
  });
});
