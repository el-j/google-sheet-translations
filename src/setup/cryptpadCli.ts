import fs from 'node:fs';
import path from 'node:path';
import {
  CryptPadClient,
  CryptPadDriveClient,
  createCryptPadSheetInputProvider,
  createCryptPadSheetOutputProvider,
  createCryptPadSheetSyncProvider,
  runProviderPipeline,
} from '../providers';
import {
  writeLanguageDataFile,
  writeLocalesFile,
  writeTranslationFiles,
} from '../utils/fileWriter';
import { readDataJson } from '../utils/readDataJson';
import type { SyncConflictPolicy } from '../providers/syncEngine';

/**
 * Loads a .env file into process.env, mirroring `node --env-file`, so the CLI
 * works as a plain shebang command (`gst-cryptpad push`) without requiring
 * callers to wrap it in `node --env-file=.env <path-to-bin>`.
 */
function loadEnvFile(envPath: string): void {
  const loadEnvFileFn = (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof loadEnvFileFn !== 'function') return;
  try {
    loadEnvFileFn(envPath);
  } catch {
    // No .env file at this path (or unreadable) - ignore, same as `node --env-file` optionality.
  }
}

function tryReadLocaleMapping(localesFilePath: string): Record<string, string> | undefined {
  try {
    if (fs.existsSync(localesFilePath)) {
      const content = fs.readFileSync(localesFilePath, 'utf8');
      const match = content.match(/export const localeHeaderMapping = (\{[\s\S]*?\});/);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch {
    // Ignore parsing error
  }
  return undefined;
}

function parseArgs(argv: string[]): { command: string; options: Record<string, string> } {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('--') ? args[0] : 'pull';
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        options[key] = val;
      } else {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = 'true';
        }
      }
    }
  }

  return { command, options };
}

function printHelp(): void {
  console.log(`
 gst-cryptpad - Dedicated CLI for CryptPad Sheet & Drive Operations

 USAGE
   npx gst-cryptpad <command> [options]

 COMMANDS
   pull         Download translations from CryptPad sheet(s) into local JSON files
   push         Upload local translations into CryptPad sheet(s)
   sync         Reconcile local and remote translations with conflict resolution
   inspect      Inspect sheet tabs, cell counts, and Netflux channels headlessly
   drive-scan   Scan a CryptPad Drive folder and discover all sheets & assets

 OPTIONS
   --url=URL                     CryptPad Sheet or Drive URL (required or set CRYPTPAD_URL / CRYPTPAD_DRIVE_URL)
   --password=PW                 Password for password-protected CryptPad pad (or CRYPTPAD_PASSWORD)
   --sheet-titles=CSV            Comma-separated sheet tab names to target (e.g. "common,auth,pricing")
   --translations-output-dir=DIR Output directory for locale JSON files (default: translations)
   --locales-output-path=PATH    Output path for locales.ts (default: src/i18n/locales.ts)
   --data-json-path=PATH         Path to languageData.json (default: src/lib/languageData.json)
   --policy=POLICY               Conflict policy for sync: "manual", "local-wins", "remote-wins" (default: manual)
   --override                    When pushing, overwrite existing non-empty cells (default: false)
   --env-file=PATH                Load environment variables from a .env-style file (default: .env in cwd)
   --help                        Show this help message

 EXAMPLES
   gst-cryptpad inspect --url="https://cryptpad.fr/sheet/#/2/sheet/edit/.../p/" --password="secret"
   gst-cryptpad pull --url="https://cryptpad.fr/sheet/#/2/sheet/edit/.../p/" --translations-output-dir=src/i18n
   gst-cryptpad push --url="https://cryptpad.fr/sheet/#/2/sheet/edit/.../p/" --data-json-path=src/lib/languageData.json
   gst-cryptpad drive-scan --url="https://cryptpad.fr/drive/#/2/drive/edit/.../p/"
`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv);

  if (options.help || options.h || command === 'help') {
    printHelp();
    return;
  }

  const cwd = process.cwd();
  loadEnvFile(path.resolve(cwd, options['env-file'] ?? '.env'));

  const url =
    options.url ??
    (command === 'drive-scan' ? process.env.CRYPTPAD_DRIVE_URL : process.env.CRYPTPAD_URL);
  const password = options.password ?? process.env.CRYPTPAD_PASSWORD;

  if (!url && command !== 'help') {
    console.error(
      `Error: Missing required --url option (or set CRYPTPAD_URL / CRYPTPAD_DRIVE_URL)`,
    );
    process.exit(1);
  }

  const sheetTitles = options['sheet-titles']
    ? options['sheet-titles']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const translationsOutputDir = path.resolve(
    cwd,
    options['translations-output-dir'] ?? 'translations',
  );
  const localesOutputPath = path.resolve(
    cwd,
    options['locales-output-path'] ?? 'src/i18n/locales.ts',
  );
  const dataJsonPath = path.resolve(cwd, options['data-json-path'] ?? 'src/lib/languageData.json');

  switch (command) {
    case 'inspect': {
      console.log(`Connecting headlessly to CryptPad sheet: ${url}...`);
      const client = new CryptPadClient({ url, password });
      const data = await client.fetchSheetData();

      console.log(`\nDocument Metadata:`);
      console.log(`  App:          ${data.metadata.app}`);
      console.log(`  Mode:         ${data.metadata.mode}`);
      console.log(`  Channel ID:   ${data.metadata.channelId}`);
      console.log(
        `  RT Channel:   ${data.metadata.rtChannelId ?? 'None (will auto-initialize on first push)'}`,
      );
      console.log(`  Total Cells:  ${Object.keys(data.cells).length}`);
      console.log(`  Sheet Tabs (${data.sheetNames.length}):`);
      for (const name of data.sheetNames) {
        const rows = data.sheets[name]?.rows ?? [];
        console.log(`    - ${name}: ${rows.length} row(s)`);
      }
      break;
    }

    case 'drive-scan': {
      console.log(`Scanning CryptPad Drive folder: ${url}...`);
      const driveClient = new CryptPadDriveClient({ url, password });
      const items = await driveClient.listDriveItems();

      console.log(`\nDiscovered ${items.length} item(s) in Drive:`);
      for (const item of items) {
        console.log(`  [${item.type.toUpperCase()}] ${item.title} -> ${item.url}`);
      }
      break;
    }

    case 'pull': {
      console.log(`Pulling translations from CryptPad: ${url}...`);
      const localData = readDataJson(dataJsonPath);
      const inferredLocalSheetTitles =
        !sheetTitles && localData
          ? Array.from(
              new Set(
                Object.values(localData)
                  .flatMap((localeSheets) => Object.keys(localeSheets ?? {}))
                  .filter((name) => name && name.trim().length > 0),
              ),
            )
          : undefined;
      const effectiveSheetTitles =
        sheetTitles && sheetTitles.length > 0
          ? sheetTitles
          : inferredLocalSheetTitles && inferredLocalSheetTitles.length > 0
            ? inferredLocalSheetTitles
            : undefined;

      if (!sheetTitles && effectiveSheetTitles) {
        console.log(
          `No --sheet-titles provided, using local languageData.json sheet structure: ${effectiveSheetTitles.join(', ')}`,
        );
      }

      const inputProvider = createCryptPadSheetInputProvider({
        url,
        password,
        tableName: effectiveSheetTitles?.[0] ?? 'translations',
      });

      const result = await runProviderPipeline({
        inputProvider,
        tableNames: effectiveSheetTitles,
      });

      writeTranslationFiles(result.translations, result.locales, translationsOutputDir);
      writeLocalesFile(result.locales, result.localeMapping, localesOutputPath);
      if (result.locales.length > 0) {
        writeLanguageDataFile(result.translations, result.locales, dataJsonPath);
      }

      console.log(
        `Successfully pulled ${result.locales.length} locale(s) into ${translationsOutputDir}`,
      );
      break;
    }

    case 'push': {
      console.log(`Pushing translations to CryptPad: ${url}...`);
      const localData = readDataJson(dataJsonPath);
      if (!localData) {
        console.error(
          `Error: Could not read local data file at ${dataJsonPath}. Run pull first or check path.`,
        );
        process.exit(1);
      }

      const localeMapping = tryReadLocaleMapping(localesOutputPath);
      const outputProvider = createCryptPadSheetOutputProvider({
        url,
        password,
        override: options.override === 'true',
        localeMapping,
      });

      const locales = Object.keys(localData);
      const res = await outputProvider.writeTranslations({
        translations: localData,
        locales,
        localeMapping,
      });

      const updatedSheets = Array.isArray(res.metadata?.updatedSheets)
        ? (res.metadata.updatedSheets as unknown[]).length
        : 0;
      console.log(`Successfully pushed translations: updated ${updatedSheets} sheet(s).`);
      break;
    }

    case 'sync': {
      console.log(`Synchronizing local translations with CryptPad: ${url}...`);
      const localData = readDataJson(dataJsonPath);
      const conflictPolicy = (options.policy ?? 'manual') as SyncConflictPolicy;

      const inputProvider = createCryptPadSheetInputProvider({
        url,
        password,
        tableName: sheetTitles?.[0] ?? 'translations',
      });

      const syncProvider = createCryptPadSheetSyncProvider({
        url,
        password,
        conflictPolicy,
        override: options.override === 'true',
      });

      const result = await runProviderPipeline({
        inputProvider,
        syncProvider,
        tableNames: sheetTitles,
        localTranslationsForSync: localData ?? undefined,
      });

      writeTranslationFiles(result.translations, result.locales, translationsOutputDir);
      writeLocalesFile(result.locales, result.localeMapping, localesOutputPath);
      if (result.locales.length > 0) {
        writeLanguageDataFile(result.translations, result.locales, dataJsonPath);
      }

      console.log(
        `Sync completed: ${result.syncResult?.changedKeys ?? 0} changed key(s), ` +
          `${result.syncResult?.skippedKeys ?? 0} skipped.`,
      );
      break;
    }

    default:
      console.error(
        `Unknown command "${command}". Run gst-cryptpad --help for available commands.`,
      );
      process.exit(1);
  }
}

main()
  .then(() => {
    // Force-exit: CryptPad's underlying realtime sync libraries can leave
    // stray timers/sockets open even after a successful command, which would
    // otherwise keep this CLI process alive indefinitely.
    process.exit(0);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  });
