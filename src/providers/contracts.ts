import type { SheetRow, TranslationData } from '../types';
import type { ProviderCapabilitySet } from './capabilities';

/**
 * Role played by a translation provider in the pipeline.
 */
export type ProviderKind = 'input' | 'output' | 'sync';

/**
 * Common metadata attributes implemented by all translation providers.
 */
export interface ProviderMetadata {
  /** Unique provider identifier (e.g. 'google-sheets', 'cryptpad-csv'). */
  providerId: string;
  /** Human-readable provider name. */
  displayName: string;
  /** Capability set declaring which pipeline operations this provider supports. */
  capabilities: ProviderCapabilitySet;
}

/**
 * Canonical representation of a single tabular sheet/sheet-tab read from a provider.
 */
export interface CanonicalTableInput {
  /** Unique identifier of the table within the data source. */
  tableId: string;
  /** Human-readable name or tab title of the table. */
  tableName: string;
  /** Raw row objects extracted from the table. */
  rows: SheetRow[];
  /** Optional source file path or URL. */
  sourcePath?: string;
  /** ISO timestamp string representing the last modified time if known. */
  modifiedTime?: string;
  /** Provider-specific metadata associated with the table. */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for requesting tables from a {@link TranslationInputProvider}.
 */
export interface TranslationInputRequest {
  /** Specific table names to fetch. If omitted, all available tables are returned. */
  tableNames?: string[];
  /** Optional abort signal for early cancellation. */
  signal?: AbortSignal;
}

/**
 * Result returned by a {@link TranslationInputProvider.readTables} call.
 */
export interface TranslationInputResult {
  /** Array of canonical tables read from the input provider. */
  tables: CanonicalTableInput[];
  /** Optional provider-level execution metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Payload passed to a {@link TranslationOutputProvider.writeTranslations} call.
 */
export interface TranslationOutputPayload {
  /** Merged translation data. */
  translations: TranslationData;
  /** List of locales to output. */
  locales: string[];
  /** Mapping of original header columns to normalized locale codes. */
  localeMapping?: Record<string, string>;
  /** Original locale mapping preserved for reverse lookup. */
  originalLocaleMapping?: Record<string, string>;
  /** Optional provider-specific metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a {@link TranslationOutputProvider.writeTranslations} call.
 */
export interface TranslationOutputResult {
  /** List of file paths or resource identifiers written. */
  wroteFiles: string[];
  /** Optional output execution metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Payload passed to a {@link TranslationSyncProvider.syncTranslations} call.
 */
export interface TranslationSyncPayload {
  /** Local translation snapshot containing recent edits. */
  localTranslations: TranslationData;
  /** Authoritative remote translations snapshot from the provider. */
  remoteTranslations: TranslationData;
  /** Optional sync options and provider metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by a {@link TranslationSyncProvider.syncTranslations} call.
 */
export interface TranslationSyncResult {
  /** Number of translation keys created or updated during sync. */
  changedKeys: number;
  /** Number of translation keys skipped (e.g. unmodified or conflict-deferred). */
  skippedKeys: number;
  /** Optional sync outcome metadata. */
  metadata?: Record<string, unknown>;
}

/** A provider that reads canonical tables from a data source (e.g. Google Sheets, a CSV file). */
export interface TranslationInputProvider extends ProviderMetadata {
  kind: 'input';
  readTables(request: TranslationInputRequest): Promise<TranslationInputResult>;
}

/** A provider that writes the merged translation set to a destination. */
export interface TranslationOutputProvider extends ProviderMetadata {
  kind: 'output';
  writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult>;
}

/** A provider that reconciles local translation edits with a remote source, resolving conflicts. */
export interface TranslationSyncProvider extends ProviderMetadata {
  kind: 'sync';
  syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult>;
}

/**
 * Union of all standard translation provider types.
 */
export type AnyTranslationProvider =
  | TranslationInputProvider
  | TranslationOutputProvider
  | TranslationSyncProvider;

/**
 * Typed provider registry contract for the orchestration layer.
 * Implementations can provide in-memory, DI, or plugin-backed registries.
 */
export interface ProviderRegistry {
  register(provider: AnyTranslationProvider): void;
  get(providerId: string): AnyTranslationProvider | undefined;
  list(): AnyTranslationProvider[];
}

/**
 * A provider registry partitioned by provider role (`input`, `output`, `sync`).
 */
export interface SegmentedProviderRegistry {
  registerInput(provider: TranslationInputProvider): void;
  registerOutput(provider: TranslationOutputProvider): void;
  registerSync(provider: TranslationSyncProvider): void;
  getInput(providerId: string): TranslationInputProvider | undefined;
  getOutput(providerId: string): TranslationOutputProvider | undefined;
  getSync(providerId: string): TranslationSyncProvider | undefined;
}
