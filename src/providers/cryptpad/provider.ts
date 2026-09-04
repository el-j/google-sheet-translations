import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { SheetRow } from '../../types';
import type {
  TranslationInputProvider,
  TranslationInputRequest,
  TranslationInputResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';

/** One CSV source to read as a table. Provide exactly one of `url` or `filePath`. */
export interface CryptPadCsvSource {
  tableName: string;
  url?: string;
  filePath?: string;
  tableId?: string;
}

export interface CryptPadCsvInputProviderOptions {
  sources: CryptPadCsvSource[];
  delimiter?: string;
  providerId?: string;
  displayName?: string;
}

interface CryptPadCsvProviderDeps {
  fetchCsv: (url: string, signal?: AbortSignal) => Promise<string>;
  readCsvFile: (filePath: string) => Promise<string>;
}

const CRYPTPAD_CSV_INPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  readTables: true,
  publicReadNoAuth: true,
});

function createDefaultDeps(): CryptPadCsvProviderDeps {
  return {
    async fetchCsv(url: string, signal?: AbortSignal): Promise<string> {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV from "${url}" (HTTP ${response.status})`);
      }
      return response.text();
    },
    async readCsvFile(filePath: string): Promise<string> {
      return fs.readFile(filePath, 'utf8');
    },
  };
}

function sourceId(source: CryptPadCsvSource): string {
  return source.tableId ?? source.filePath ?? source.url ?? source.tableName;
}

function parseCsvRows(csvText: string, delimiter?: string): SheetRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    delimiter,
  }) as Record<string, unknown>[];

  return records.map((record) => {
    const row: SheetRow = {};
    for (const [key, value] of Object.entries(record)) {
      row[key] = value == null ? '' : String(value);
    }
    return row;
  });
}

/**
 * Creates a read-only {@link TranslationInputProvider} that reads one or more CSV
 * sources (local files or public export URLs) as canonical tables. This is a CSV-only
 * MVP: it has no output/sync capability, so it is always paired with another provider
 * (e.g. `cryptpad-workspace`) for write-back. Public URLs require no authentication,
 * reflected in `publicReadNoAuth: true`.
 */
export function createCryptPadCsvInputProvider(
  options: CryptPadCsvInputProviderOptions,
  depsOverrides: Partial<CryptPadCsvProviderDeps> = {},
): TranslationInputProvider {
  if (!options.sources || options.sources.length === 0) {
    throw new Error('CryptPad CSV provider requires at least one source.');
  }

  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'input',
    providerId: options.providerId ?? 'cryptpad-csv',
    displayName: options.displayName ?? 'CryptPad CSV Input',
    capabilities: CRYPTPAD_CSV_INPUT_CAPABILITIES,
    async readTables(request: TranslationInputRequest): Promise<TranslationInputResult> {
      const requested = new Set((request.tableNames ?? []).filter(Boolean));
      const selectedSources =
        requested.size === 0
          ? options.sources
          : options.sources.filter((source) => requested.has(source.tableName));

      const tables = await Promise.all(
        selectedSources.map(async (source) => {
          const csvText = source.url
            ? await deps.fetchCsv(source.url, request.signal)
            : source.filePath
              ? await deps.readCsvFile(source.filePath)
              : '';

          if (!csvText) {
            throw new Error(
              `Source "${source.tableName}" must define either url or filePath.`,
            );
          }

          return {
            tableId: sourceId(source),
            tableName: source.tableName,
            rows: parseCsvRows(csvText, options.delimiter),
            sourcePath: source.url ?? source.filePath,
            metadata: {
              sourceKind: source.url ? 'url' : 'file',
            },
          };
        }),
      );

      return {
        tables,
        metadata: {
          provider: 'cryptpad-csv',
          sourceCount: selectedSources.length,
        },
      };
    },
  };
}

export { CRYPTPAD_CSV_INPUT_CAPABILITIES };
