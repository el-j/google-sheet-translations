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
  buildOnlyOfficeSheetDeletePayload,
  buildOnlyOfficeSheetRenamePayload,
  generateOnlyOfficeSheetId,
  colIndexToLetter,
  letterToColIndex,
  parseCellRef,
  type CryptPadSheetGrid,
  type OnlyOfficeCellUpdate,
} from './sheetParser';
import type { SheetRow } from '../../types';
import { I18N_SHEET_NAME } from '../../constants';

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
  websocketUrl?: string;
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
   * Resolves the Netflux WebSocket endpoint to connect to. Cached on this instance after
   * the first successful resolution — every multi-step operation (`writeSheetRows` in
   * particular) calls this once per sub-step, and re-resolving the same endpoint via a
   * fresh HTTP request each time needlessly multiplies outbound connections for no benefit
   * (the endpoint doesn't change within a single client's lifetime).
   *
   * @param signal - Optional AbortSignal to cancel connection discovery.
   * @returns The WebSocket endpoint URL (wss:// or ws://).
   */
  async getWebsocketUrl(signal?: AbortSignal): Promise<string> {
    if (this.websocketUrl) {
      return this.websocketUrl;
    }
    const resolved = await resolveCryptPadWebsocketUrl(this.parsedUrl.origin, signal);
    this.websocketUrl = resolved;
    return resolved;
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
    const insertAt = Math.min(insertBeforeIndex ?? data.sheetNames.length, data.sheetNames.length);
    await this.broadcastSheetAdd(name, sheetId, insertAt, rtChannel, signal);
    return sheetId;
  }

  /**
   * Broadcasts a `Workbook_SheetAdd` record to an already-known RT channel, without
   * re-fetching sheet data first. Used internally by {@link createSheet} (after it has
   * resolved the channel) and by the `i18n`-header-linking path in {@link writeSheetRows}
   * to avoid opening a fresh WebSocket connection for every step of a single push — CryptPad
   * (and this environment's outbound networking) can drop a connection attempt when several
   * are opened back-to-back in quick succession.
   */
  private async broadcastSheetAdd(
    name: string,
    sheetId: string,
    insertBeforeIndex: number,
    rtChannel: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey, signKey } = this.getKeys();
    const payload = buildOnlyOfficeSheetAddPayload(name, sheetId, insertBeforeIndex);
    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });
  }

  /**
   * Deletes a worksheet tab by name from the CryptPad workbook.
   *
   * @param sheetName - Name of the sheet tab to delete (e.g. 'Sheet1').
   * @param signal - Optional AbortSignal.
   */
  async deleteSheet(sheetName: string, signal?: AbortSignal): Promise<void> {
    const data = await this.fetchSheetData(signal);
    const targetSheetId = data.sheetIds?.[sheetName];
    if (!targetSheetId) {
      return;
    }

    if (data.sheetNames.length <= 1) {
      throw new Error(
        `Cannot delete sheet "${sheetName}": workbook must contain at least one worksheet.`,
      );
    }

    const rtChannel = data.metadata.rtChannelId;
    if (!rtChannel) {
      throw new Error('Cannot delete sheet: pad has no active real-time collaboration channel.');
    }

    await this.broadcastSheetDelete(targetSheetId, rtChannel, signal);
  }

  /**
   * Broadcasts a `Workbook_SheetDelete` record to an already-known RT channel.
   */
  private async broadcastSheetDelete(
    sheetId: string,
    rtChannel: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey, signKey } = this.getKeys();
    const payload = buildOnlyOfficeSheetDeletePayload(sheetId);
    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });
  }

  /**
   * Broadcasts a `Worksheet_Rename` record to an already-known RT channel.
   */
  private async broadcastSheetRename(
    sheetId: string | number,
    oldName: string,
    newName: string,
    rtChannel: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const wsUrl = await this.getWebsocketUrl(signal);
    const { cryptKey, signKey } = this.getKeys();
    const payload = buildOnlyOfficeSheetRenamePayload(sheetId, oldName, newName);
    await broadcastChannelMessage(wsUrl, rtChannel, cryptKey, payload, {
      timeoutMs: this.timeoutMs,
      signal,
      signKey,
    });
  }

  /**
   * Renames an existing worksheet tab by name in the CryptPad workbook.
   *
   * @param oldSheetName - Current name of the sheet tab (e.g. 'Sheet1').
   * @param newSheetName - Desired new name for the tab (e.g. 'i18n').
   * @param signal - Optional AbortSignal.
   */
  async renameSheet(
    oldSheetName: string,
    newSheetName: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (oldSheetName === newSheetName) return;

    const data = await this.fetchSheetData(signal);
    const targetSheetId = data.sheetIds?.[oldSheetName];
    if (!targetSheetId) {
      throw new Error(`Cannot rename sheet "${oldSheetName}": sheet not found in the workbook.`);
    }

    const rtChannel = data.metadata.rtChannelId;
    if (!rtChannel) {
      throw new Error('Cannot rename sheet: pad has no active real-time collaboration channel.');
    }

    await this.broadcastSheetRename(targetSheetId, oldSheetName, newSheetName, rtChannel, signal);
  }

  /**
   * Writes a literal-text header row (row 1) into a sheet — the canonical, non-linked
   * form used for the `i18n` sheet itself (there is nothing to link an `i18n` header to)
   * and as the safe fallback whenever a new sheet's columns can't be aligned 1:1 with an
   * already-existing `i18n` sheet's header. Takes an already-known `rtChannel` to avoid an
   * extra connection round-trip (see {@link broadcastSheetAdd}).
   */
  private async writeLiteralHeaderRow(
    sheetName: string,
    sheetId: string,
    headers: string[],
    rtChannel: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const updates: OnlyOfficeCellUpdate[] = headers.map((name, idx) => ({
      sheet: sheetName,
      sheetId,
      col: colIndexToLetter(idx),
      row: 1,
      value: name,
    }));
    await this.sendCellUpdates(updates, signal, rtChannel);
  }

  /**
   * Writes a header row (row 1) whose cells are formulas referencing the corresponding
   * column of the reserved `i18n` sheet's own header row (`=i18n!A1`, `=i18n!B1`, ...),
   * so a sheet's header visually mirrors `i18n` instead of duplicating literal text — see
   * issue #165. Column `idx` here must already be verified to align with the `i18n`
   * sheet's real column `idx` by the caller ({@link ensureI18nSheetHeader}). Takes an
   * already-known `rtChannel` to avoid an extra connection round-trip.
   */
  private async writeLinkedHeaderRow(
    sheetName: string,
    sheetId: string,
    columnCount: number,
    rtChannel: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const updates: OnlyOfficeCellUpdate[] = [];
    for (let idx = 0; idx < columnCount; idx++) {
      const col = colIndexToLetter(idx);
      updates.push({
        sheet: sheetName,
        sheetId,
        col,
        row: 1,
        formula: `${I18N_SHEET_NAME}!${col}1`,
      });
    }
    await this.sendCellUpdates(updates, signal, rtChannel);
  }

  /**
   * Ensures the reserved `i18n` sheet exists and has a header row, so other sheets can
   * link their own header cells to it (see issue #165). Never overwrites an `i18n` header
   * that already has content — it is the canonical source, so once populated it's treated
   * as authoritative and only ever appended-to-by-creation, never silently rewritten.
   *
   * Takes the caller's already-fetched `data` snapshot and `rtChannel` instead of
   * re-fetching — `data` was captured before this call's own sheet creation, but `i18n`'s
   * own state is unaffected by creating a *different* sheet, so it stays accurate. This
   * keeps a single `writeSheetRows` call from opening a new connection per sub-step.
   *
   * @param desiredHeaders - Header row to write if `i18n` doesn't exist yet (or exists but
   *   has no header row). Ignored if `i18n` already has a populated header row.
   * @returns The `i18n` sheet's ID and its actual current header row (which may differ
   *   from `desiredHeaders` if the sheet already existed with different columns) — callers
   *   must compare before linking, since a mismatched column order would silently point a
   *   new sheet's header cells at the wrong `i18n` columns.
   */
  private async ensureI18nSheetHeader(
    data: CryptPadSheetResult,
    rtChannel: string,
    desiredHeaders: string[],
    signal?: AbortSignal,
  ): Promise<{ sheetId: string; headers: string[] }> {
    const existingSheetId = data.sheetIds?.[I18N_SHEET_NAME];

    if (existingSheetId) {
      // Read the real header row (row 1) directly from raw cells — convertCellsToSheetRows
      // strips row 1 out as the column-key source, so `.rows` never contains it.
      const i18nCells = data.sheets[I18N_SHEET_NAME]?.cells ?? {};
      const headerCols = new Map<number, string>();
      for (const [ref, val] of Object.entries(i18nCells)) {
        const parsed = parseCellRef(ref);
        if (parsed && parsed.row === 1) {
          headerCols.set(letterToColIndex(parsed.col), val);
        }
      }
      if (headerCols.size > 0) {
        const maxIdx = Math.max(...headerCols.keys());
        const headers: string[] = [];
        for (let i = 0; i <= maxIdx; i++) headers.push(headerCols.get(i) ?? '');
        return { sheetId: existingSheetId, headers };
      }
      // Sheet exists but has no header row yet.
      await this.writeLiteralHeaderRow(
        I18N_SHEET_NAME,
        existingSheetId,
        desiredHeaders,
        rtChannel,
        signal,
      );
      return { sheetId: existingSheetId, headers: desiredHeaders };
    }

    this.onProgress?.(
      `Reserved "${I18N_SHEET_NAME}" sheet not found — creating it as the canonical header source.`,
    );
    const newSheetId = generateOnlyOfficeSheetId();
    await this.broadcastSheetAdd(
      I18N_SHEET_NAME,
      newSheetId,
      data.sheetNames.length,
      rtChannel,
      signal,
    );
    await this.writeLiteralHeaderRow(
      I18N_SHEET_NAME,
      newSheetId,
      desiredHeaders,
      rtChannel,
      signal,
    );
    return { sheetId: newSheetId, headers: desiredHeaders };
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
    const discoveredSheetNames = new Set<string>();
    for (const name of Object.keys(sheetIdMap.nameToId)) {
      if (name && name.trim().length > 0) discoveredSheetNames.add(name);
    }
    if (discoveredSheetNames.size === 0) {
      for (const name of Object.keys(multiSheets)) {
        if (name && name.trim().length > 0) discoveredSheetNames.add(name);
      }
    }
    const sheetNames = Array.from(discoveredSheetNames);
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
    options: {
      override?: boolean;
      signal?: AbortSignal;
      /** When true (default false — opt-in, not yet live-verified against a real
       *  OnlyOffice session, see {@link encodeOnlyOfficeFormulaCellRecord}) and this call
       *  creates a brand-new, non-`i18n` sheet, that sheet's header row is written as
       *  formula cells linking to the `i18n` sheet's header row (`=i18n!A1`, ...) instead
       *  of duplicated literal text — see issue #165. Never touches a sheet's header on
       *  any push after its creation. */
      linkHeadersToI18nSheet?: boolean;
    } = {},
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const data = await this.fetchSheetData(options.signal);
    let rtChannel = data.metadata.rtChannelId;

    let existingRows = data.sheets[sheetName]?.rows ?? [];
    let targetSheetId = data.sheetIds?.[sheetName];
    let justCreated = false;

    if (!targetSheetId) {
      // If this workbook has an untouched, empty starter 'Sheet1' (0 rows and 0 data cells),
      // rename 'Sheet1' to the target sheetName instead of adding an unnecessary extra tab,
      // avoiding a dangling empty dirty page in the workbook.
      const isSheet1Empty =
        data.sheetNames.includes('Sheet1') &&
        (data.sheets['Sheet1']?.rows.length ?? 0) === 0 &&
        Object.keys(data.sheets['Sheet1']?.cells ?? {}).length === 0;

      const shouldRenameSheet1 =
        isSheet1Empty &&
        sheetName !== 'Sheet1' &&
        (data.sheetNames.length === 1 || sheetName === I18N_SHEET_NAME);

      if (shouldRenameSheet1) {
        const sheet1Id = data.sheetIds?.['Sheet1'] ?? '6';
        this.onProgress?.(`Renaming fresh empty "Sheet1" tab to "${sheetName}".`);
        if (rtChannel) {
          await this.broadcastSheetRename(sheet1Id, 'Sheet1', sheetName, rtChannel, options.signal);
        } else {
          await this.renameSheet('Sheet1', sheetName, options.signal);
        }
        targetSheetId = sheet1Id;
        existingRows = [];
        justCreated = true;
      } else {
        this.onProgress?.(`Sheet "${sheetName}" not found — creating it.`);
        targetSheetId = await this.createSheet(sheetName, data.sheetNames.length, options.signal);
        existingRows = [];
        justCreated = true;
      }
    }

    // Determine primary key column header ('key' or 'var'). Defaults to 'key' — the same
    // header a brand-new Google Sheets sheet gets (see spreadsheetUpdater.ts) — but an
    // existing sheet's own header always wins, so sheets already using 'var' keep doing so.
    let keyColName = 'key';
    const firstExisting = existingRows[0];
    const firstIncoming = rows[0];
    if (firstExisting) {
      if ('key' in firstExisting) keyColName = 'key';
      else if ('var' in firstExisting) keyColName = 'var';
    } else if (firstIncoming) {
      if ('key' in firstIncoming) keyColName = 'key';
      else if ('var' in firstIncoming) keyColName = 'var';
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

    // Header row (row 1). Only a brand-new, non-`i18n` sheet is eligible for linked
    // (formula) headers — an existing sheet's header is never rewritten as a formula on
    // a later push, bounding this feature's risk to sheet creation only (see #165).
    const linkHeaders = options.linkHeadersToI18nSheet ?? false;
    let wroteLinkedHeader = false;

    if (justCreated && linkHeaders && sheetName !== I18N_SHEET_NAME) {
      if (!rtChannel) {
        // Rare: this pad had never been opened before this call, so the `createSheet` call
        // above had to initialize a new RT channel itself (and doesn't return it) — refetch
        // once to learn it, reused for every remaining step of this push.
        rtChannel = (await this.fetchSheetData(options.signal)).metadata.rtChannelId;
      }

      if (rtChannel) {
        const { headers: i18nHeaders } = await this.ensureI18nSheetHeader(
          data,
          rtChannel,
          colNames,
          options.signal,
        );
        const columnsAlign =
          i18nHeaders.length === colNames.length && i18nHeaders.every((h, i) => h === colNames[i]);

        if (columnsAlign) {
          await this.writeLinkedHeaderRow(
            sheetName,
            targetSheetId,
            colNames.length,
            rtChannel,
            options.signal,
          );
          wroteLinkedHeader = true;
        } else {
          // The existing `i18n` sheet's columns don't line up 1:1 with this push's columns
          // (different locale set/order) — linking would silently point header cells at the
          // wrong `i18n` columns, so fall back to literal text instead.
          this.onProgress?.(
            `"${I18N_SHEET_NAME}" sheet's header doesn't match this push's columns — writing literal header text for "${sheetName}" instead of linking.`,
          );
        }
      }
    }

    if (!wroteLinkedHeader) {
      colNames.forEach((name, idx) => {
        updates.push({
          sheet: sheetName,
          sheetId: targetSheetId,
          col: colIndexToLetter(idx),
          row: 1,
          value: name,
        });
      });
    }

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

    await this.sendCellUpdates(updates, options.signal, rtChannel);

    return updates.length;
  }
}
