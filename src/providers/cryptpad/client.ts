// @ts-nocheck
import crypto from 'node:crypto';
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
  extractOnlyOfficeMetadata,
  extractOnlyOfficeSheetIdMap,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  convertCellsToMultiSheetRows,
  groupCellsBySheet,
  buildOnlyOfficeChangePayload,
  buildOnlyOfficeSheetAddPayload,
  generateOnlyOfficeSheetId,
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
  /** Optional callback for progress/status messages during headless RT channel setup. */
  onProgress?: (message: string) => void;
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
  sheetIds?: Record<string, string>;
  metadata: {
    app: string;
    mode: string;
    channelId: string;
    rtChannelId?: string;
    title?: string;
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
  readonly onProgress?: (message: string) => void;
  private derivedKeys?: DerivedCryptPadKeys;

  constructor(options: CryptPadClientOptions) {
    if (!options.url || typeof options.url !== 'string') {
      throw new Error('CryptPadClient requires a valid "url" option.');
    }

    this.parsedUrl = parsePadUrl(options.url);
    this.password = options.password ?? process.env.CRYPTPAD_PASSWORD;
    this.websocketUrl = options.websocketUrl;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.onProgress = options.onProgress;

    if (this.parsedUrl.isPasswordProtected && !this.password) {
      throw new Error(
        `CryptPad pad "${this.parsedUrl.cleanUrl}" is password protected, but no password was provided. Set "password" option or CRYPTPAD_PASSWORD environment variable.`,
      );
    }
  }

  /**
   * Gets or derives the symmetric key and primary Netflux channel ID.
   *
   * @returns The derived CryptPad channel hex ID and 32-byte TweetNaCl secretbox key.
   */
  getKeys(): DerivedCryptPadKeys {
    if (!this.derivedKeys) {
      this.derivedKeys = deriveCryptPadKeys(this.parsedUrl.seed, this.password);
    }
    return this.derivedKeys;
  }

  /**
   * Resolves the Netflux WebSocket endpoint to connect to.
   *
   * @param signal - Optional AbortSignal to cancel connection discovery.
   * @returns The WebSocket endpoint URL (wss:// or ws://).
   */
  async getWebsocketUrl(signal?: AbortSignal): Promise<string> {
    if (this.websocketUrl) {
      return this.websocketUrl;
    }
    return resolveCryptPadWebsocketUrl(this.parsedUrl.origin, signal);
  }

  /**
   * Initializes the OnlyOffice RT channel for a brand-new CryptPad sheet that has never
   * been opened in a browser.
   *
   * ### CryptPad Protocol Details
   * CryptPad pads use Netflux channels for real-time collaboration. The main pad channel
   * stores document metadata. When a spreadsheet pad is opened in OnlyOffice, the OnlyOffice
   * web wrapper creates a secondary Netflux channel for real-time document change frames
   * and registers it in the pad's metadata channel.
   *
   * The metadata update is formatted as an edit sequence:
   * `[sequenceNumber, [[offset, length, innerJsonString]]]`
   * where `sequenceNumber` is 1, and `innerJsonString` is:
   * `{"content":{"channel":"<32-hex-channel-id>"}}`.
   *
   * Broadcasting this envelope over the main channel headlessly replicates OnlyOffice's
   * first-open handshake without requiring a browser or headless browser session.
   *
   * @param signal - Optional AbortSignal to cancel the initialization.
   * @returns The newly allocated 32-character hexadecimal RT channel ID.
   */
  async initializeRtChannel(signal?: AbortSignal): Promise<string> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { channelHex, cryptKey, signKey } = this.getKeys();

    // Generate a fresh 32-char hex channel ID (same length CryptPad uses)
    const newRtChannel = crypto.randomBytes(16).toString('hex');

    // Build the metadata patch CryptPad's OnlyOffice client writes on first open.
    // CryptPad's metadata channel is governed by ChainPad (SmartJSONTransformer).
    // A valid initial ChainPad patch has the structure:
    // [2, [[[0, 0, innerJsonString]], EMPTY_STR_HASH], ZERO_MSG_HASH]
    // where 2 is Message.PATCH, EMPTY_STR_HASH is sha256(''), and ZERO_MSG_HASH is the initial zeroMsg hash.
    // OnlyOffice requires content.version: 9 and metadata.type: 'oo' to attach to the RT channel
    // and render real-time changes when opened in a browser.
    const innerJson = JSON.stringify({
      content: {
        hashes: {},
        ids: {},
        mediasSources: {},
        originalVersion: 9,
        version: 9,
        channel: newRtChannel,
      },
      metadata: {
        type: 'oo',
      },
    });
    const EMPTY_STR_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const ZERO_MSG_HASH = 'a4b411975be1d48a91f0ebfcd967add000f69564b2dc5ee644b87bf2bbfd786f';
    const envelope = JSON.stringify([2, [[[0, 0, innerJson]], EMPTY_STR_HASH], ZERO_MSG_HASH]);

    // signKey is required: CryptPad's historyKeeper verifies Ed25519 signatures on
    // metadata channel messages and silently drops unsigned messages.
    await broadcastChannelMessage(wsUrl, channelHex, cryptKey, envelope, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });

    return newRtChannel;
  }

  /**
   * Creates a new sheet tab on this pad by broadcasting a real OnlyOffice
   * `Workbook_SheetAdd` history record to the RT channel — the same operation a
   * real OnlyOffice browser client sends when a user clicks "Add sheet". The
   * binary layout was derived and byte-verified against two independent live
   * captures from an actual browser session (see issue #161); it is not a guess.
   *
   * If the pad has never been opened by a real OnlyOffice client (no RT channel
   * yet), the RT channel is initialized headlessly first, matching {@link sendCellUpdates}.
   *
   * @param name - Display name for the new sheet tab.
   * @param insertBeforeIndex - 0-based tab position to insert at. Defaults to appending
   *   after all currently known tabs.
   * @param signal - Optional AbortSignal.
   * @returns The newly generated internal sheetId — use this for subsequent cell writes
   *   into the new sheet.
   */
  async createSheet(
    name: string,
    insertBeforeIndex?: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const data = await this.fetchSheetData(signal);

    let rtChannel = data.metadata.rtChannelId;
    if (!rtChannel) {
      this.onProgress?.(
        'No OnlyOffice RT channel found. Initializing headlessly (no browser required)...',
      );
      rtChannel = await this.initializeRtChannel(signal);
      this.onProgress?.(`RT channel initialized: ${rtChannel}`);
      await new Promise((r) => setTimeout(r, 800));
    }

    const sheetId = generateOnlyOfficeSheetId();
    const insertAt = insertBeforeIndex ?? data.sheetNames.length;

    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey, signKey } = this.getKeys();
    const payload = buildOnlyOfficeSheetAddPayload(name, sheetId, insertAt);

    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });

    return sheetId;
  }

  /**
   * Fetches the complete sheet data, including raw cell coordinate mappings,
   * multi-sheet tabs, and structured rows formatted for translation ingestion.
   *
   * @param signal - Optional AbortSignal to cancel the fetch.
   * @returns The structured {@link CryptPadSheetResult} containing grids, rows, and metadata.
   */
  async fetchSheetData(signal?: AbortSignal): Promise<CryptPadSheetResult> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { channelHex, cryptKey } = this.getKeys();

    // 1. Fetch metadata channel history
    const metaMessages = await fetchChannelHistory(wsUrl, channelHex, cryptKey, {
      timeoutMs: this.timeoutMs,
      signal,
    });

    const meta = extractOnlyOfficeMetadata(metaMessages);
    const rtChannel = meta.channelId;
    let cells: CryptPadSheetGrid = {};
    let sheetIdMap: { nameToId: Record<string, string>; idToName: Record<string, string> } = {
      nameToId: {},
      idToName: {},
    };

    if (rtChannel) {
      // 2. Fetch OnlyOffice RT channel history
      const rtMessages = await fetchChannelHistory(wsUrl, rtChannel, cryptKey, {
        timeoutMs: this.timeoutMs,
        signal,
      });
      cells = parseOnlyOfficeChanges(rtMessages);
      sheetIdMap = extractOnlyOfficeSheetIdMap(rtMessages);
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
      sheetIds: sheetIdMap.nameToId,
      metadata: {
        app: this.parsedUrl.app,
        mode: this.parsedUrl.mode,
        channelId: channelHex,
        rtChannelId: rtChannel ?? undefined,
        title: meta.title ?? meta.defaultTitle ?? undefined,
      },
    };
  }

  /**
   * Directly fetches tabular translation rows `[ { key: '...', en: '...', de: '...' } ]`.
   * If `sheetName` is provided, returns rows for that specific tab.
   *
   * @param sheetName - Optional tab/sheet name to extract rows from.
   * @param signal - Optional AbortSignal to cancel the operation.
   * @returns An array of {@link SheetRow} objects.
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
   * If the sheet has never been opened in a browser (RT channel is None), it is
   * automatically initialized headlessly — no browser required.
   *
   * @param updates - Array of cell updates containing coordinates and text values.
   * @param signal - Optional AbortSignal to cancel the broadcast.
   * @param existingRtChannel - Optional pre-fetched RT channel ID to avoid refetching sheet data.
   */
  async sendCellUpdates(
    updates: OnlyOfficeCellUpdate[],
    signal?: AbortSignal,
    existingRtChannel?: string,
  ): Promise<void> {
    if (updates.length === 0) return;

    let rtChannel = existingRtChannel;
    if (!rtChannel) {
      const data = await this.fetchSheetData(signal);
      rtChannel = data.metadata.rtChannelId;
    }

    if (!rtChannel) {
      // Sheet was created but never opened in a browser — initialize the RT channel headlessly.
      this.onProgress?.(
        'No OnlyOffice RT channel found. Initializing headlessly (no browser required)...',
      );
      rtChannel = await this.initializeRtChannel(signal);
      this.onProgress?.(`RT channel initialized: ${rtChannel}`);

      // Brief pause to let CryptPad's server register the new channel
      await new Promise((r) => setTimeout(r, 800));
    }

    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey, signKey } = this.getKeys();
    const payload = buildOnlyOfficeChangePayload(updates);

    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });
  }

  /**
   * Updates or appends rows in a target sheet tab, creating new cells as needed.
   *
   * @param sheetName - Target sheet tab name (e.g. 'i18n' or 'common').
   * @param rows - Array of translation rows to write.
   * @param options - Write options: override existing non-empty values and optional signal.
   * @returns The total number of cell update records sent.
   */
  async writeSheetRows(
    sheetName: string,
    rows: SheetRow[],
    options: { override?: boolean; signal?: AbortSignal } = {},
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const data = await this.fetchSheetData(options.signal);

    let existingRows = data.sheets[sheetName]?.rows ?? [];
    let targetSheetId = data.sheetIds?.[sheetName];

    if (!targetSheetId) {
      // No tab named `sheetName` exists yet — create one, mirroring Google Sheets'
      // addSheet-on-missing-sheet behavior (src/utils/spreadsheetUpdater.ts). This
      // deliberately does NOT fall back to reusing some other existing tab just
      // because it happens to be the only one: an exact name match or a fresh
      // tab, same as Google, keeps push behavior identical across providers.
      this.onProgress?.(`Sheet "${sheetName}" not found — creating it.`);
      targetSheetId = await this.createSheet(sheetName, data.sheetNames.length, options.signal);
      existingRows = [];
    }

    // Determine primary key column header ('var' or 'key')
    let keyColName = 'var';
    const firstExisting = existingRows[0];
    const firstIncoming = rows[0];
    if (firstExisting) {
      if ('var' in firstExisting) keyColName = 'var';
      else if ('key' in firstExisting) keyColName = 'key';
    } else if (firstIncoming) {
      if ('var' in firstIncoming) keyColName = 'var';
      else if ('key' in firstIncoming) keyColName = 'key';
    }

    // Collect all column names with key column first (case-insensitive deduplication)
    const colNames: string[] = [keyColName];
    const hasCol = (name: string) => colNames.some((c) => c.toLowerCase() === name.toLowerCase());

    for (const r of existingRows) {
      for (const k of Object.keys(r)) {
        if (k !== 'key' && k !== 'var' && !hasCol(k)) colNames.push(k);
      }
    }
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (k !== 'key' && k !== 'var' && !hasCol(k)) colNames.push(k);
      }
    }

    // Case-insensitive column resolver
    const findColIdx = (name: string): number => {
      const exact = colNames.indexOf(name);
      if (exact >= 0) return exact;
      const lower = name.toLowerCase();
      return colNames.findIndex((c) => c.toLowerCase() === lower);
    };

    const updates: OnlyOfficeCellUpdate[] = [];

    // Header row (row 1)
    colNames.forEach((name, idx) => {
      updates.push({
        sheet: sheetName,
        sheetId: targetSheetId,
        col: colIndexToLetter(idx),
        row: 1,
        value: name,
      });
    });

    // Map existing keys to row index (1-based, header is 1, rows start at 2)
    const keyToRowIdx = new Map<string, number>();
    existingRows.forEach((r, idx) => {
      const rowKey = r.var ?? r.key ?? r[keyColName];
      if (rowKey) keyToRowIdx.set(rowKey, idx + 2);
    });

    let nextAvailableRow = existingRows.length + 2;

    for (const row of rows) {
      const rowKey = row.var ?? row.key ?? row[keyColName];
      if (!rowKey) continue;
      const targetRow = keyToRowIdx.get(rowKey) ?? nextAvailableRow++;
      keyToRowIdx.set(rowKey, targetRow);

      for (const [colName, val] of Object.entries(row)) {
        const mappedColName = colName === 'key' || colName === 'var' ? keyColName : colName;
        const colIdx = findColIdx(mappedColName);
        if (colIdx >= 0 && val !== undefined) {
          const matchedHeader = colNames[colIdx];
          const existingVal = existingRows[targetRow - 2]?.[matchedHeader];
          if (options.override || !existingVal || existingVal.trim().length === 0) {
            updates.push({
              sheet: sheetName,
              sheetId: targetSheetId,
              col: colIndexToLetter(colIdx),
              row: targetRow,
              value: String(val),
            });
          }
        }
      }
    }

    await this.sendCellUpdates(updates, options.signal, data.metadata.rtChannelId);
    return updates.length;
  }
}
