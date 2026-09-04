import fs from 'node:fs';
import path from 'node:path';
import type { ProviderRuntimeConfig } from '../providers/config';
import { mapLegacyGoogleOptionsToProviderConfig } from '../providers/config';
import type { SpreadsheetOptions } from '../utils/configurationHandler';

export interface MigrateV3Options {
  projectRoot?: string;
  providerConfigPath?: string;
  /** Preview changes without writing any files. */
  dryRun?: boolean;
  /** Rewrite legacy `uses: el-j/google-sheet-translations@...` workflow steps to `provider-config-path` mode. */
  writeWorkflows?: boolean;
  /** Overwrite an existing provider config file at `providerConfigPath` instead of warning and skipping. */
  force?: boolean;
  /** Cross-check the generated provider config against the legacy option mapping and report any drift. */
  parityCheck?: boolean;
}

/** Result of comparing the generated provider config against {@link mapLegacyGoogleOptionsToProviderConfig}. */
export interface MigrationParityCheck {
  passed: boolean;
  differences: string[];
  expectedConfig: ProviderRuntimeConfig;
}

export interface MigrateV3Result {
  projectRoot: string;
  providerConfigPath: string;
  providerConfig: ProviderRuntimeConfig;
  legacyWorkflowsFound: string[];
  rewrittenWorkflows: string[];
  createdFiles: string[];
  warnings: string[];
  parityCheck?: MigrationParityCheck;
}

const LEGACY_KEYS_TO_REMOVE = new Set([
  'google-spreadsheet-id',
  'row-limit',
  'wait-seconds',
  'sync-local-changes',
  'auto-translate',
  'override',
  'clean-push',
  'auto-create',
  'spreadsheet-title',
  'source-locale',
  'target-locales',
]);

function listWorkflowFiles(projectRoot: string): string[] {
  const workflowsDir = path.join(projectRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  const entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (e.name.endsWith('.yml') || e.name.endsWith('.yaml')))
    .map((e) => path.join(workflowsDir, e.name));
}

/** Parses the `with:` block of one workflow step (lines `[start, end)`) into a flat key/value map. */
function extractInputsFromStep(lines: string[], start: number, end: number): Record<string, string> {
  const inputs: Record<string, string> = {};

  for (let i = start; i < end; i++) {
    const line = lines[i];
    const withMatch = line.match(/^(\s*)with:\s*$/);
    if (withMatch) {
      const withIndent = withMatch[1].length;
      for (let j = i + 1; j < end; j++) {
        const nextLine = lines[j];
        if (nextLine.trim() === '') continue;
        const indent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
        if (indent <= withIndent) break;

        const kv = nextLine.match(/^\s*([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (kv) {
          inputs[kv[1]] = kv[2].trim();
        }
      }
      break;
    }
  }

  return inputs;
}

/** Finds the line ranges of every step in `content` that uses `el-j/google-sheet-translations@...`. */
function findActionStepRanges(content: string): Array<{ start: number; end: number }> {
  const lines = content.split(/\r?\n/);
  const ranges: Array<{ start: number; end: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('uses:')) continue;
    if (!line.includes('el-j/google-sheet-translations@')) continue;

    const currentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    let end = lines.length;

    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j];
      const indent = candidate.match(/^(\s*)/)?.[1].length ?? 0;
      if (/^\s*-\s+/.test(candidate) && indent <= currentIndent) {
        end = j;
        break;
      }
    }

    ranges.push({ start: i, end });
  }

  return ranges;
}

function parseBool(input: string | undefined, fallback: boolean): boolean {
  if (!input) return fallback;
  const cleaned = input.replace(/^['"]|['"]$/g, '').toLowerCase();
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  return fallback;
}

function parseOptionalBool(input: string | undefined): boolean | undefined {
  if (!input) return undefined;
  return parseBool(input, false);
}

function parseNum(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const cleaned = input.replace(/^['"]|['"]$/g, '');
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : undefined;
}

function unquote(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input.replace(/^['"]|['"]$/g, '');
}

/** Maps a legacy workflow step's parsed `with:` inputs to a v3 {@link ProviderRuntimeConfig}. */
function buildProviderConfigFromInputs(inputs: Record<string, string>): ProviderRuntimeConfig {
  const spreadsheetId = unquote(inputs['google-spreadsheet-id']);
  const rowLimit = parseNum(inputs['row-limit']);
  const waitSeconds = parseNum(inputs['wait-seconds']);

  const syncLocalChanges = parseBool(inputs['sync-local-changes'], true);
  const autoTranslate = parseBool(inputs['auto-translate'], false);
  const override = parseBool(inputs['override'], false);

  const inputOptions: Record<string, unknown> = {};
  if (spreadsheetId) inputOptions.spreadsheetId = spreadsheetId;
  if (rowLimit !== undefined) inputOptions.rowLimit = rowLimit;
  if (waitSeconds !== undefined) inputOptions.waitSeconds = waitSeconds;

  const config: ProviderRuntimeConfig = {
    input: {
      provider: 'google-sheets',
      options: inputOptions,
    },
  };

  if (syncLocalChanges) {
    config.sync = {
      provider: 'google-sheets',
      options: {
        spreadsheetId,
        waitSeconds,
        autoTranslate,
        override,
      },
    };
  }

  return config;
}

/**
 * Rewrites every legacy action step in `content` (that isn't already using
 * `provider-config`/`provider-config-path`) by stripping its legacy input keys and
 * inserting a `provider-config-path: '<providerConfigPath>'` input in their place.
 * Steps are processed back-to-front so earlier line-range offsets stay valid as later
 * steps are rewritten.
 */
function rewriteWorkflow(content: string, providerConfigPath: string): string {
  const lines = content.split(/\r?\n/);
  const ranges = findActionStepRanges(content);

  for (let r = ranges.length - 1; r >= 0; r--) {
    const { start, end } = ranges[r];
    const stepLines = lines.slice(start, end);

    const usesLegacy = stepLines.some((line) =>
      Array.from(LEGACY_KEYS_TO_REMOVE).some((key) =>
        line.match(new RegExp(`^\\s*${key}:`)),
      ),
    );

    if (!usesLegacy) continue;

    const hasProviderConfig = stepLines.some((line) =>
      /^\s*provider-config(-path)?:/.test(line),
    );
    if (hasProviderConfig) continue;

    const withLineIndex = stepLines.findIndex((line) => /^\s*with:\s*$/.test(line));
    if (withLineIndex === -1) continue;

    const withIndent = stepLines[withLineIndex].match(/^(\s*)/)?.[1] ?? '';
    const inputIndent = `${withIndent}  `;
    const providerLine = `${inputIndent}provider-config-path: '${providerConfigPath}'`;

    const cleaned: string[] = [];
    for (let i = 0; i < stepLines.length; i++) {
      const line = stepLines[i];
      const keyMatch = line.match(/^\s*([a-zA-Z0-9_-]+):\s*/);
      if (keyMatch && LEGACY_KEYS_TO_REMOVE.has(keyMatch[1])) {
        continue;
      }
      cleaned.push(line);
    }

    const insertionIndex = cleaned.findIndex((line) => /^\s*with:\s*$/.test(line));
    if (insertionIndex !== -1) {
      cleaned.splice(insertionIndex + 1, 0, providerLine);
    }

    lines.splice(start, end - start, ...cleaned);
  }

  return lines.join('\n');
}

function hasUnsupportedDriveMode(inputs: Record<string, string>): boolean {
  return Boolean(inputs['drive-folder-id'] || inputs['spreadsheet-ids'] || inputs['sync-images']);
}

function toLegacyOptions(inputs: Record<string, string>): SpreadsheetOptions {
  return {
    spreadsheetId: unquote(inputs['google-spreadsheet-id']),
    rowLimit: parseNum(inputs['row-limit']),
    waitSeconds: parseNum(inputs['wait-seconds']),
    syncLocalChanges: parseBool(inputs['sync-local-changes'], true),
    autoTranslate: parseOptionalBool(inputs['auto-translate']),
    override: parseOptionalBool(inputs['override']),
    publicSheet: parseOptionalBool(inputs['public-sheet']),
  };
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    const normalizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, normalizeValue(nested)] as const)
      .sort(([a], [b]) => a.localeCompare(b));

    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

function canonicalizeParityConfig(config: ProviderRuntimeConfig): ProviderRuntimeConfig {
  const clone: ProviderRuntimeConfig = JSON.parse(JSON.stringify(config));

  const inputOptions = clone.input?.options as Record<string, unknown> | undefined;
  if (inputOptions?.publicSheet === false) {
    delete inputOptions.publicSheet;
  }

  const syncOptions = clone.sync?.options as Record<string, unknown> | undefined;
  if (syncOptions?.autoTranslate === false) {
    delete syncOptions.autoTranslate;
  }
  if (syncOptions?.override === false) {
    delete syncOptions.override;
  }

  return clone;
}

function collectDifferences(
  actual: unknown,
  expected: unknown,
  atPath = 'config',
): string[] {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return [
        `${atPath}: array length differs (actual ${actual.length}, expected ${expected.length})`,
      ];
    }

    const differences: string[] = [];
    for (let i = 0; i < actual.length; i++) {
      differences.push(...collectDifferences(actual[i], expected[i], `${atPath}[${i}]`));
    }
    return differences;
  }

  const actualIsObject = Boolean(actual) && typeof actual === 'object';
  const expectedIsObject = Boolean(expected) && typeof expected === 'object';

  if (actualIsObject && expectedIsObject) {
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(actualRecord), ...Object.keys(expectedRecord)])).sort();

    const differences: string[] = [];
    for (const key of keys) {
      differences.push(
        ...collectDifferences(actualRecord[key], expectedRecord[key], `${atPath}.${key}`),
      );
    }
    return differences;
  }

  if (actual !== expected) {
    return [
      `${atPath}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`,
    ];
  }

  return [];
}

/**
 * Compares the generated `providerConfig` against the config
 * {@link mapLegacyGoogleOptionsToProviderConfig} would produce from the same legacy
 * inputs, after canonicalizing both sides (dropping default-valued optional fields
 * so they don't register as spurious differences).
 */
function runParityCheck(
  providerConfig: ProviderRuntimeConfig,
  inputs: Record<string, string>,
): MigrationParityCheck {
  const mapped = mapLegacyGoogleOptionsToProviderConfig(toLegacyOptions(inputs));
  const normalizedActual = normalizeValue(canonicalizeParityConfig(providerConfig));
  const normalizedExpected = normalizeValue(canonicalizeParityConfig(mapped.config));
  const differences = collectDifferences(normalizedActual, normalizedExpected);

  return {
    passed: differences.length === 0,
    differences,
    expectedConfig: mapped.config,
  };
}

/**
 * Auto-migrates a project from the legacy GitHub Action inputs to the v3 provider
 * runtime: scans `.github/workflows/*.yml` for steps using the legacy action inputs,
 * generates a {@link ProviderRuntimeConfig} from the first legacy step found, writes
 * it to `providerConfigPath` (unless it already exists and `force` is not set), and —
 * when `writeWorkflows` is set — rewrites each matching step in place to reference
 * that config file instead of the legacy inputs. Workflows using Drive-folder mode
 * (which has no v3 equivalent yet) are left untouched with a warning rather than
 * being rewritten. Throws if no workflow files exist, or if none use the legacy action.
 */
export function migrateProjectToV3(options: MigrateV3Options = {}): MigrateV3Result {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const providerConfigPath = options.providerConfigPath ?? 'provider.config.json';
  const absoluteProviderConfigPath = path.resolve(projectRoot, providerConfigPath);

  const warnings: string[] = [];
  const legacyWorkflowsFound: string[] = [];
  const rewrittenWorkflows: string[] = [];
  const createdFiles: string[] = [];

  const workflowFiles = listWorkflowFiles(projectRoot);
  if (workflowFiles.length === 0) {
    throw new Error('No workflow files found under .github/workflows.');
  }

  let firstLegacyInputs: Record<string, string> | undefined;

  for (const workflowFile of workflowFiles) {
    const content = fs.readFileSync(workflowFile, 'utf8');
    const lines = content.split(/\r?\n/);
    const ranges = findActionStepRanges(content);

    let hasLegacyInFile = false;
    let skipRewriteForDriveMode = false;

    for (const range of ranges) {
      const inputs = extractInputsFromStep(lines, range.start, range.end);
      const hasLegacyKeys = Object.keys(inputs).some((k) =>
        LEGACY_KEYS_TO_REMOVE.has(k) || k === 'google-client-email' || k === 'google-private-key',
      );
      const hasProviderConfig = Boolean(inputs['provider-config'] || inputs['provider-config-path']);

      if (hasLegacyKeys && !hasProviderConfig) {
        hasLegacyInFile = true;
        if (!firstLegacyInputs) {
          firstLegacyInputs = inputs;
        }
        if (hasUnsupportedDriveMode(inputs)) {
          skipRewriteForDriveMode = true;
          warnings.push(
            `Workflow ${path.relative(projectRoot, workflowFile)} uses Drive mode inputs. Auto-rewrite skipped for safety; generate provider config only and migrate this workflow manually.`,
          );
        }
      }
    }

    if (!hasLegacyInFile) continue;

    legacyWorkflowsFound.push(path.relative(projectRoot, workflowFile));

    if (options.writeWorkflows && !skipRewriteForDriveMode) {
      const updated = rewriteWorkflow(content, providerConfigPath);
      if (updated !== content) {
        rewrittenWorkflows.push(path.relative(projectRoot, workflowFile));
        if (!options.dryRun) {
          fs.writeFileSync(workflowFile, updated, 'utf8');
        }
      }
    }
  }

  if (!firstLegacyInputs) {
    throw new Error('No legacy action usage found to migrate.');
  }

  const providerConfig = buildProviderConfigFromInputs(firstLegacyInputs);
  let parityCheck: MigrationParityCheck | undefined;

  if (options.parityCheck) {
    parityCheck = runParityCheck(providerConfig, firstLegacyInputs);
    if (!parityCheck.passed) {
      warnings.push(
        `Parity check found ${parityCheck.differences.length} difference(s) between generated provider config and legacy mapping.`,
      );
    }
  }

  if (fs.existsSync(absoluteProviderConfigPath) && !options.force) {
    warnings.push(
      `Provider config already exists at ${path.relative(projectRoot, absoluteProviderConfigPath)}. Use --force to overwrite.`,
    );
  } else if (!options.dryRun) {
    fs.mkdirSync(path.dirname(absoluteProviderConfigPath), { recursive: true });
    fs.writeFileSync(
      absoluteProviderConfigPath,
      `${JSON.stringify(providerConfig, null, 2)}\n`,
      'utf8',
    );
    createdFiles.push(path.relative(projectRoot, absoluteProviderConfigPath));
  }

  return {
    projectRoot,
    providerConfigPath: path.relative(projectRoot, absoluteProviderConfigPath),
    providerConfig,
    legacyWorkflowsFound,
    rewrittenWorkflows,
    createdFiles,
    warnings,
    parityCheck,
  };
}
