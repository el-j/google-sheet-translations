import {
  parsePadUrl,
  deriveCryptPadKeys,
  type ParsedCryptPadUrl,
  type DerivedCryptPadKeys,
} from './crypto';
import {
  resolveCryptPadWebsocketUrl,
  fetchChannelHistory,
  broadcastChannelMessage,
} from './netflux';
import {
  extractOnlyOfficeChannelId,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  convertCellsToMultiSheetRows,
  groupCellsBySheet,
  buildOnlyOfficeChangePayload,
  colIndexToLetter,
  type CryptPadSheetGrid,
  type OnlyOfficeCellUpdate,
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
  sheets: Record<
    string,
    {
      cells: CryptPadSheetGrid;
      rows: SheetRow[];
    }
  >;
  sheetNames: string[];
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
   * Fetches the complete sheet data, including raw cell coordinate mappings,
   * multi-sheet tabs, and structured rows formatted for translation ingestion.
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

    const multiSheets = convertCellsToMultiSheetRows(cells);
    const sheetNames = Object.keys(multiSheets);
    const defaultSheet = multiSheets['Sheet1'] ? 'Sheet1' : sheetNames[0];
    const defaultRows =
      defaultSheet && multiSheets[defaultSheet]
        ? multiSheets[defaultSheet]
        : convertCellsToSheetRows(cells);

    const groupedCells = groupCellsBySheet(cells);
    const sheetsResult: Record<string, { cells: CryptPadSheetGrid; rows: SheetRow[] }> = {};
    for (const name of sheetNames) {
      sheetsResult[name] = {
        cells: groupedCells[name] ?? {},
        rows: multiSheets[name] ?? [],
      };
    }

    return {
      url: this.parsedUrl.cleanUrl,
      cells,
      rows: defaultRows,
      sheets: sheetsResult,
      sheetNames,
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
   * If `sheetName` is provided, returns rows for that specific tab.
   */
  async fetchSheetRows(sheetName?: string, signal?: AbortSignal): Promise<SheetRow[]> {
    const result = await this.fetchSheetData(signal);
    if (sheetName && result.sheets[sheetName]) {
      return result.sheets[sheetName].rows;
    }
    return result.rows;
  }

  /**
   * Broadcasts cell updates to the OnlyOffice real-time collaboration channel.
   */
  async sendCellUpdates(updates: OnlyOfficeCellUpdate[], signal?: AbortSignal): Promise<void> {
    if (updates.length === 0) return;

    const data = await this.fetchSheetData(signal);
    const rtChannel = data.metadata.rtChannelId;
    if (!rtChannel) {
      throw new Error(
        `CryptPad sheet "${this.parsedUrl.cleanUrl}" does not have an active OnlyOffice RT channel.`,
      );
    }

    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey } = this.getKeys();
    const payload = buildOnlyOfficeChangePayload(updates);

    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
    });
  }

  /**
   * Updates or appends rows in a target sheet tab, creating new cells as needed.
   */
  async writeSheetRows(
    sheetName: string,
    rows: SheetRow[],
    options: { override?: boolean; signal?: AbortSignal } = {},
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const data = await this.fetchSheetData(options.signal);
    const targetSheet = data.sheets[sheetName];
    const existingRows = targetSheet?.rows ?? [];

    // Collect all column names
    const colNamesSet = new Set<string>(['key']);
    for (const r of existingRows) {
      for (const k of Object.keys(r)) colNamesSet.add(k);
    }
    for (const r of rows) {
      for (const k of Object.keys(r)) colNamesSet.add(k);
    }

    const colNames = Array.from(colNamesSet);
    const updates: OnlyOfficeCellUpdate[] = [];

    // Header row (row 1)
    colNames.forEach((name, idx) => {
      updates.push({
        sheet: sheetName,
        col: colIndexToLetter(idx),
        row: 1,
        value: name,
      });
    });

    // Map existing keys to row index (1-based, header is 1, rows start at 2)
    const keyToRowIdx = new Map<string, number>();
    existingRows.forEach((r, idx) => {
      if (r.key) keyToRowIdx.set(r.key, idx + 2);
    });

    let nextAvailableRow = existingRows.length + 2;

    for (const row of rows) {
      if (!row.key) continue;
      const targetRow = keyToRowIdx.get(row.key) ?? nextAvailableRow++;
      keyToRowIdx.set(row.key, targetRow);

      for (const [colName, val] of Object.entries(row)) {
        const colIdx = colNames.indexOf(colName);
        if (colIdx >= 0 && val !== undefined) {
          const existingVal = existingRows[targetRow - 2]?.[colName];
          if (options.override || !existingVal || existingVal.trim().length === 0) {
            updates.push({
              sheet: sheetName,
              col: colIndexToLetter(colIdx),
              row: targetRow,
              value: String(val),
            });
          }
        }
      }
    }

    await this.sendCellUpdates(updates, options.signal);
    return updates.length;
  }
}
