import path from 'node:path';
import { migrateProjectToV3 } from '../migration/migrateV3';

/**
 * `gst-migrate-v3` CLI entrypoint. Wraps {@link migrateProjectToV3}: prints a summary
 * of legacy workflows found, files rewritten/created, and any parity-check result;
 * exits with code 2 if `--parity-check` reports differences, or code 1 on any thrown error.
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
 gst-migrate-v3 - Auto-migrate legacy workflow usage to provider runtime config

 USAGE
   npx -p @el-j/google-sheet-translations gst-migrate-v3 [options]

 OPTIONS
   --project-root=PATH          Project root (default: current working directory)
   --provider-config-path=PATH  Output provider config path (default: provider.config.json)
   --write-workflows            Rewrite legacy action steps to provider-config-path mode
   --parity-check               Validate generated config parity against legacy option mapping
   --dry-run                    Preview changes without writing files
   --force                      Overwrite existing provider config file
   --help                       Show this help

 EXAMPLES
   gst-migrate-v3 --dry-run
   gst-migrate-v3 --dry-run --parity-check
   gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    printHelp();
    return;
  }

  const projectRoot = path.resolve(args['project-root'] ?? process.cwd());
  const providerConfigPath = args['provider-config-path'] ?? 'provider.config.json';

  const result = migrateProjectToV3({
    projectRoot,
    providerConfigPath,
    dryRun: args['dry-run'] === 'true',
    writeWorkflows: args['write-workflows'] === 'true',
    force: args.force === 'true',
    parityCheck: args['parity-check'] === 'true',
  });

  console.log('Migration summary:');
  console.log(`- Project root: ${result.projectRoot}`);
  console.log(`- Provider config path: ${result.providerConfigPath}`);
  console.log(`- Legacy workflows found: ${result.legacyWorkflowsFound.length}`);
  console.log(`- Rewritten workflows: ${result.rewrittenWorkflows.length}`);
  console.log(`- Created files: ${result.createdFiles.length}`);

  if (result.legacyWorkflowsFound.length > 0) {
    console.log('\nLegacy workflows:');
    for (const file of result.legacyWorkflowsFound) {
      console.log(`- ${file}`);
    }
  }

  if (result.rewrittenWorkflows.length > 0) {
    console.log('\nRewritten workflows:');
    for (const file of result.rewrittenWorkflows) {
      console.log(`- ${file}`);
    }
  }

  if (result.createdFiles.length > 0) {
    console.log('\nCreated files:');
    for (const file of result.createdFiles) {
      console.log(`- ${file}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.parityCheck) {
    console.log('\nParity check:');
    console.log(`- Passed: ${result.parityCheck.passed ? 'yes' : 'no'}`);
    console.log(`- Differences: ${result.parityCheck.differences.length}`);

    if (!result.parityCheck.passed) {
      for (const diff of result.parityCheck.differences) {
        console.log(`- ${diff}`);
      }
      process.exitCode = 2;
    }
  }

  console.log('\nGenerated provider config:');
  console.log(JSON.stringify(result.providerConfig, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
