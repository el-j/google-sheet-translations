import fs from 'node:fs';
import path from 'node:path';
import {
  assertValidProviderRuntimeConfig,
  createProvidersFromRuntimeConfig,
  runProviderPipeline,
} from '../providers';
import { writeLanguageDataFile, writeLocalesFile, writeTranslationFiles } from '../utils/fileWriter';
import { readDataJson } from '../utils/readDataJson';

/**
 * `gst-run-provider` CLI entrypoint. Reads a JSON {@link ProviderRuntimeConfig} from
 * `--config`, resolves it to concrete providers, runs the full pipeline (input →
 * transform → output → sync → optional asset sync), and writes the resulting
 * translation files to disk.
 */

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) {
      result[match[1]] = match[2] ?? 'true';
    }
  }
  return result;
}

function printHelp(): void {
  console.log(`
 gst-run-provider - Run translation sync with v3 provider runtime config

 USAGE
   npx -p @el-j/google-sheet-translations gst-run-provider --config=provider.config.json [options]

 OPTIONS
   --config=PATH                 Path to provider runtime config JSON (required)
   --sheet-titles=CSV            Comma-separated table names (default: i18n)
   --translations-output-dir=DIR Output dir for locale json files (default: translations)
   --locales-output-path=PATH    Output path for locales.ts (default: src/i18n/locales.ts)
   --data-json-path=PATH         Output path for languageData.json (default: src/lib/languageData.json)
   --asset-target-dir=DIR        Run asset sync (requires "assetSync" in config) and write assets here
   --asset-delete-missing        Delete local assets not present in the asset manifest
   --help                        Show this help

 EXAMPLE
   gst-run-provider \
     --config=provider.config.json \
     --sheet-titles=home,about,pricing \
     --asset-target-dir=public/assets
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    printHelp();
    return;
  }

  const configPath = args.config;
  if (!configPath) {
    console.error('Missing required argument: --config=provider.config.json');
    process.exit(1);
  }

  const cwd = process.cwd();
  const absConfigPath = path.resolve(cwd, configPath);

  const rawConfig = fs.readFileSync(absConfigPath, 'utf8');
  const config = assertValidProviderRuntimeConfig(JSON.parse(rawConfig));

  const sheetTitles = (args['sheet-titles'] ?? 'i18n')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const translationsOutputDir = path.resolve(
    cwd,
    args['translations-output-dir'] ?? 'translations',
  );
  const localesOutputPath = path.resolve(
    cwd,
    args['locales-output-path'] ?? 'src/i18n/locales.ts',
  );
  const dataJsonPath = path.resolve(
    cwd,
    args['data-json-path'] ?? 'src/lib/languageData.json',
  );

  const assetTargetDirArg = args['asset-target-dir'];
  const configAssetTargetDir =
    typeof config.assetSync?.options?.targetDirectory === 'string' &&
    config.assetSync.options.targetDirectory.trim().length > 0
      ? config.assetSync.options.targetDirectory.trim()
      : undefined;
  const effectiveAssetTargetDir = assetTargetDirArg || configAssetTargetDir;
  const effectiveAssetDeleteMissing = assetTargetDirArg
    ? args['asset-delete-missing'] === 'true'
    : Boolean(config.assetSync?.options?.deleteMissing);

  const assetSync = effectiveAssetTargetDir
    ? {
        targetDirectory: path.resolve(cwd, effectiveAssetTargetDir),
        deleteMissing: effectiveAssetDeleteMissing,
      }
    : undefined;

  const providers = createProvidersFromRuntimeConfig(config);
  const localDataForSync = readDataJson(dataJsonPath) ?? undefined;

  const result = await runProviderPipeline({
    inputProvider: providers.inputProvider,
    outputProvider: providers.outputProvider,
    syncProvider: providers.syncProvider,
    assetSyncProvider: providers.assetSyncProvider,
    assetSync,
    tableNames: sheetTitles,
    localTranslationsForSync: localDataForSync,
  });

  writeTranslationFiles(result.translations, result.locales, translationsOutputDir);
  writeLocalesFile(result.locales, result.localeMapping, localesOutputPath);
  if (result.locales.length > 0) {
    writeLanguageDataFile(result.translations, result.locales, dataJsonPath);
  }

  console.log(`Provider pipeline completed with ${result.locales.length} locale(s).`);

  if (result.assetSyncResult) {
    const { manifestCount, downloaded, updated, deleted, skipped } = result.assetSyncResult;
    console.log(
      `Asset sync completed: ${manifestCount} manifest entr${manifestCount === 1 ? 'y' : 'ies'}, ` +
        `${downloaded.length} downloaded, ${updated.length} updated, ${deleted.length} deleted, ${skipped.length} skipped.`,
    );
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
