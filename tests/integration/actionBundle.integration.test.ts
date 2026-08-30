import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const actionBundlePath = path.resolve(__dirname, '../../dist-action/index.mjs');

describe('Action Bundle Integration: dist-action/index.mjs', () => {
  let tmpDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-action-test-'));
    outputFile = path.join(tmpDir, 'github_output.txt');
    fs.writeFileSync(outputFile, '');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails cleanly with descriptive error when credentials are not supplied', async () => {
    try {
      await execFileAsync('node', [actionBundlePath], {
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputFile,
          'INPUT_SHEET-TITLES': 'landingPage',
          'INPUT_GOOGLE-SPREADSHEET-ID': '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0',
        },
      });
      expect.unreachable('Should have thrown an error');
    } catch (err: any) {
      expect(err.code).not.toBe(0);
      expect(err.stderr || err.stdout).toContain('Authentication required');
    }
  });

  it('fails cleanly when sheet-titles is missing even with credentials provided', async () => {
    try {
      await execFileAsync('node', [actionBundlePath], {
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputFile,
          'INPUT_GOOGLE-CLIENT-EMAIL': 'test@example.iam.gserviceaccount.com',
          'INPUT_GOOGLE-PRIVATE-KEY': 'fake-key',
          // Missing sheet-titles
        },
      });
      expect.unreachable('Should have thrown an error');
    } catch (err: any) {
      expect(err.code).not.toBe(0);
      expect(err.stderr || err.stdout).toContain('sheet-titles');
    }
  });
});
