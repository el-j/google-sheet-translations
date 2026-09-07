import {
  parsePadUrl,
  deriveCryptPadKeys,
  type ParsedCryptPadUrl,
  type DerivedCryptPadKeys,
} from './crypto';
import { resolveCryptPadWebsocketUrl, fetchChannelHistory } from './netflux';
import {
  extractOnlyOfficeChannelId,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  type CryptPadSheetGrid,
} from './sheetParser';
import type { SheetRow } from '../../types';

export interface CryptPadClientOptions {
  /** Full CryptPad URL (e.g. https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/). */
  url: string;
  /** Password for password-protected pads. */
  password?: string;
  /** Optional custom WebSocket endpoint override. If omitted, automatically queried from instance config. */
  websocketUrl?: string;
  /** Optional timeout in milliseconds for history retrieval. Defaults to 10000ms. */
  timeoutMs?: number;
}

export interface CryptPadSheetResult {
  url: string;
  cells: CryptPadSheetGrid;
  rows: SheetRow[];
  metadata: {
    app: string;
    mode: string;
    channelId: string;
    rtChannelId?: string;
  };
}

/**
 * Headless programmatic client for interacting with CryptPad documents (spreadsheets)
 * over end-to-end encrypted Netflux WebSockets without requiring a browser or user interaction.
 */
export class CryptPadClient {
  readonly parsedUrl: ParsedCryptPadUrl;
  readonly password?: string;
  readonly websocketUrl?: string;
  readonly timeoutMs: number;
  private derivedKeys?: DerivedCryptPadKeys;

  constructor(options: CryptPadClientOptions) {
    if (!options.url || typeof options.url !== 'string') {
      throw new Error('CryptPadClient requires a valid "url" option.');
    }

    this.parsedUrl = parsePadUrl(options.url);
    this.password = options.password ?? process.env.CRYPTPAD_PASSWORD;
    this.websocketUrl = options.websocketUrl;
    this.timeoutMs = options.timeoutMs ?? 10000;

    if (this.parsedUrl.isPasswordProtected && !this.password) {
      throw new Error(
        `CryptPad pad "${this.parsedUrl.cleanUrl}" is password protected, but no password was provided. Set "password" option or CRYPTPAD_PASSWORD environment variable.`,
      );
    }
  }

  /** Gets or derives the symmetric key and primary Netflux channel ID. */
  getKeys(): DerivedCryptPadKeys {
    if (!this.derivedKeys) {
      this.derivedKeys = deriveCryptPadKeys(this.parsedUrl.seed, this.password);
    }
    return this.derivedKeys;
  }

  /** Resolves the Netflux WebSocket endpoint to connect to. */
  async getWebsocketUrl(signal?: AbortSignal): Promise<string> {
    if (this.websocketUrl) {
      return this.websocketUrl;
    }
    return resolveCryptPadWebsocketUrl(this.parsedUrl.origin, signal);
  }

  /**
   * Fetches the complete sheet data, including raw cell coordinate mappings
   * and structured rows formatted for translation ingestion.
   */
  async fetchSheetData(signal?: AbortSignal): Promise<CryptPadSheetResult> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { channelHex, cryptKey } = this.getKeys();

    // 1. Fetch metadata channel history
    const metaMessages = await fetchChannelHistory(wsUrl, channelHex, cryptKey, {
      timeoutMs: this.timeoutMs,
      signal,
    });

    const rtChannel = extractOnlyOfficeChannelId(metaMessages);
    let cells: CryptPadSheetGrid = {};

    if (rtChannel) {
      // 2. Fetch OnlyOffice RT channel history
      const rtMessages = await fetchChannelHistory(wsUrl, rtChannel, cryptKey, {
        timeoutMs: this.timeoutMs,
        signal,
      });
      cells = parseOnlyOfficeChanges(rtMessages);
    }

    const rows = convertCellsToSheetRows(cells);

    return {
      url: this.parsedUrl.cleanUrl,
      cells,
      rows,
      metadata: {
        app: this.parsedUrl.app,
        mode: this.parsedUrl.mode,
        channelId: channelHex,
        rtChannelId: rtChannel ?? undefined,
      },
    };
  }

  /**
   * Directly fetches tabular translation rows `[ { key: '...', en: '...', de: '...' } ]`.
   */
  async fetchSheetRows(signal?: AbortSignal): Promise<SheetRow[]> {
    const result = await this.fetchSheetData(signal);
    return result.rows;
  }
}
