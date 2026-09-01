import type { SheetRow, TranslationData } from '../types';
import type { ProviderCapabilitySet } from './capabilities';

export type ProviderKind = 'input' | 'output' | 'sync';

export interface ProviderMetadata {
  providerId: string;
  displayName: string;
  capabilities: ProviderCapabilitySet;
}

export interface CanonicalTableInput {
  tableId: string;
  tableName: string;
  rows: SheetRow[];
  sourcePath?: string;
  modifiedTime?: string;
  metadata?: Record<string, unknown>;
}

export interface TranslationInputRequest {
  tableNames?: string[];
  signal?: AbortSignal;
}

export interface TranslationInputResult {
  tables: CanonicalTableInput[];
  metadata?: Record<string, unknown>;
}

export interface TranslationOutputPayload {
  translations: TranslationData;
  locales: string[];
  localeMapping?: Record<string, string>;
  originalLocaleMapping?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface TranslationOutputResult {
  wroteFiles: string[];
  metadata?: Record<string, unknown>;
}

export interface TranslationSyncPayload {
  localTranslations: TranslationData;
  remoteTranslations: TranslationData;
  metadata?: Record<string, unknown>;
}

export interface TranslationSyncResult {
  changedKeys: number;
  skippedKeys: number;
  metadata?: Record<string, unknown>;
}

export interface TranslationInputProvider extends ProviderMetadata {
  kind: 'input';
  readTables(request: TranslationInputRequest): Promise<TranslationInputResult>;
}

export interface TranslationOutputProvider extends ProviderMetadata {
  kind: 'output';
  writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult>;
}

export interface TranslationSyncProvider extends ProviderMetadata {
  kind: 'sync';
  syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult>;
}

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

export interface SegmentedProviderRegistry {
  registerInput(provider: TranslationInputProvider): void;
  registerOutput(provider: TranslationOutputProvider): void;
  registerSync(provider: TranslationSyncProvider): void;
  getInput(providerId: string): TranslationInputProvider | undefined;
  getOutput(providerId: string): TranslationOutputProvider | undefined;
  getSync(providerId: string): TranslationSyncProvider | undefined;
}
