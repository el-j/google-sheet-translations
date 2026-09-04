import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, '../../dist-cli/run-provider.mjs');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gst-run-provider-cli-'));
}

describe('CLI Integration: gst-run-provider binary', () => {
  it('prints help text with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, '--help']);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--sheet-titles');
    expect(stdout).toContain('--asset-target-dir');
  });

  it('fails with exit code 1 when required config arg is missing', async () => {
    try {
      await execFileAsync('node', [cliPath]);
      expect.unreachable('Should have exited with code 1');
    } catch (err: any) {
      expect(err.code).toBe(1);
    }
  });

  it('runs a full cryptpad-csv to cryptpad-workspace pipeline and writes output files', async () => {
    const projectRoot = createTempDir();
    const csvPath = path.join(projectRoot, 'home.csv');
    fs.writeFileSync(csvPath, 'key,en,de\nwelcome,Welcome,Willkommen\n', 'utf8');

    const workspacePath = path.join(projectRoot, 'cryptpad-state.json');
    const configPath = path.join(projectRoot, 'provider.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: csvPath }] },
        },
        output: {
          provider: 'cryptpad-workspace',
          options: { filePath: workspacePath },
        },
      }),
      'utf8',
    );

    const translationsOutputDir = path.join(projectRoot, 'translations');
    const localesOutputPath = path.join(projectRoot, 'src/i18n/locales.ts');
    const dataJsonPath = path.join(projectRoot, 'src/lib/languageData.json');

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--config=${configPath}`,
      '--sheet-titles=home',
      `--translations-output-dir=${translationsOutputDir}`,
      `--locales-output-path=${localesOutputPath}`,
      `--data-json-path=${dataJsonPath}`,
    ]);

    expect(stdout).toContain('Provider pipeline completed with 2 locale(s).');

    const en = JSON.parse(fs.readFileSync(path.join(translationsOutputDir, 'en-gb.json'), 'utf8'));
    expect(en.home.welcome).toBe('Welcome');
    const de = JSON.parse(fs.readFileSync(path.join(translationsOutputDir, 'de-de.json'), 'utf8'));
    expect(de.home.welcome).toBe('Willkommen');

    expect(fs.existsSync(localesOutputPath)).toBe(true);
    expect(fs.existsSync(dataJsonPath)).toBe(true);

    const workspaceSnapshot = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
    expect(workspaceSnapshot.translations['en-GB'].home.welcome).toBe('Welcome');
    expect(workspaceSnapshot.revision).toBe(1);
  });

  it('runs asset sync end-to-end when --asset-target-dir is provided', async () => {
    const projectRoot = createTempDir();
    const csvPath = path.join(projectRoot, 'home.csv');
    fs.writeFileSync(csvPath, 'key,en\nwelcome,Welcome\n', 'utf8');

    const assetSourceDir = path.join(projectRoot, 'asset-source');
    fs.mkdirSync(assetSourceDir, { recursive: true });
    const logoPath = path.join(assetSourceDir, 'logo.png');
    fs.writeFileSync(logoPath, 'logo-bytes', 'utf8');

    const manifestPath = path.join(projectRoot, 'asset-manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify([{ assetId: 'logo', relativePath: 'images/logo.png', sourcePath: logoPath }]),
      'utf8',
    );

    const configPath = path.join(projectRoot, 'provider.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: csvPath }] },
        },
        assetSync: {
          provider: 'cryptpad-assets',
          options: { manifestPath },
        },
      }),
      'utf8',
    );

    const assetTargetDir = path.join(projectRoot, 'public/assets');

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--config=${configPath}`,
      '--sheet-titles=home',
      `--translations-output-dir=${path.join(projectRoot, 'translations')}`,
      `--locales-output-path=${path.join(projectRoot, 'src/i18n/locales.ts')}`,
      `--data-json-path=${path.join(projectRoot, 'src/lib/languageData.json')}`,
      `--asset-target-dir=${assetTargetDir}`,
    ]);

    expect(stdout).toContain('Asset sync completed: 1 manifest entry, 1 downloaded, 0 updated, 0 deleted, 0 skipped.');
    expect(fs.readFileSync(path.join(assetTargetDir, 'images/logo.png'), 'utf8')).toBe('logo-bytes');
  });

  it('runs asset sync using config-driven options when --asset-target-dir is omitted', async () => {
    const projectRoot = createTempDir();
    const csvPath = path.join(projectRoot, 'home.csv');
    fs.writeFileSync(csvPath, 'key,en\nwelcome,Welcome\n', 'utf8');

    const assetSourceDir = path.join(projectRoot, 'asset-source');
    fs.mkdirSync(assetSourceDir, { recursive: true });
    const logoPath = path.join(assetSourceDir, 'logo.png');
    fs.writeFileSync(logoPath, 'logo-bytes-config', 'utf8');

    const manifestPath = path.join(projectRoot, 'asset-manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify([{ assetId: 'logo', relativePath: 'images/logo.png', sourcePath: logoPath }]),
      'utf8',
    );

    const assetTargetDir = path.join(projectRoot, 'static/assets');

    const configPath = path.join(projectRoot, 'provider.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        input: {
          provider: 'cryptpad-csv',
          options: { sources: [{ tableName: 'home', filePath: csvPath }] },
        },
        assetSync: {
          provider: 'cryptpad-assets',
          options: {
            manifestPath,
            targetDirectory: assetTargetDir,
          },
        },
      }),
      'utf8',
    );

    const { stdout } = await execFileAsync('node', [
      cliPath,
      `--config=${configPath}`,
      '--sheet-titles=home',
      `--translations-output-dir=${path.join(projectRoot, 'translations')}`,
      `--locales-output-path=${path.join(projectRoot, 'src/i18n/locales.ts')}`,
      `--data-json-path=${path.join(projectRoot, 'src/lib/languageData.json')}`,
    ]);

    expect(stdout).toContain('Asset sync completed: 1 manifest entry, 1 downloaded, 0 updated, 0 deleted, 0 skipped.');
    expect(fs.readFileSync(path.join(assetTargetDir, 'images/logo.png'), 'utf8')).toBe('logo-bytes-config');
  });
});
