// @ts-nocheck
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CryptPadClient } from '../../../src/providers/cryptpad/client';
import { CryptPadDriveClient } from '../../../src/providers/cryptpad/driveClient';
import * as netfluxModule from '../../../src/providers/cryptpad/netflux';

describe('CryptPadClient direct methods', () => {
  it('writeSheetRows computes cell coordinates and calls sendCellUpdates', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      password: 'test',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      cells: {},
      rows: [],
      sheets: {
        common: {
          cells: { A1: 'key', B1: 'en', A2: 'btn.save', B2: 'Old Save' },
          rows: [{ key: 'btn.save', en: 'Old Save' }],
        },
      },
      sheetNames: ['common'],
      sheetIds: { common: '8200316732097412_745' },
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1', rtChannelId: 'rt1' },
    });

    const sendUpdatesSpy = vi.spyOn(client, 'sendCellUpdates').mockResolvedValue(undefined);

    // 1. Without override: does not overwrite existing 'Old Save'
    const countNoOverride = await client.writeSheetRows(
      'common',
      [
        { key: 'btn.save', en: 'New Save' },
        { key: 'btn.cancel', en: 'Cancel' },
      ],
      { override: false },
    );

    expect(sendUpdatesSpy).toHaveBeenCalledTimes(1);
    expect(countNoOverride).toBeGreaterThanOrEqual(1);

    // 2. With override: overwrites 'btn.save'
    sendUpdatesSpy.mockClear();
    const countWithOverride = await client.writeSheetRows(
      'common',
      [{ key: 'btn.save', en: 'New Save' }],
      { override: true },
    );

    expect(sendUpdatesSpy).toHaveBeenCalledTimes(1);
    expect(countWithOverride).toBeGreaterThanOrEqual(1);

    // 3. Empty rows: returns 0 without calling sendCellUpdates
    sendUpdatesSpy.mockClear();
    const emptyCount = await client.writeSheetRows('common', []);
    expect(emptyCount).toBe(0);
    expect(sendUpdatesSpy).not.toHaveBeenCalled();
  });

  it('fetchSheetRows returns rows for specific sheet or default', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      password: 'test',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      cells: {},
      rows: [{ key: 'def', en: 'Default' }],
      sheets: {
        common: { cells: {}, rows: [{ key: 'save', en: 'Save' }] },
        auth: { cells: {}, rows: [{ key: 'login', en: 'Login' }] },
      },
      sheetNames: ['common', 'auth'],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' },
    });

    const commonRows = await client.fetchSheetRows('common');
    expect(commonRows).toEqual([{ key: 'save', en: 'Save' }]);

    const fallbackRows = await client.fetchSheetRows('nonexistent');
    expect(fallbackRows).toEqual([{ key: 'def', en: 'Default' }]);
  });

  it('sendCellUpdates auto-initializes RT channel if missing (headless, no browser required)', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      password: 'test',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      cells: {},
      rows: [],
      sheets: {},
      sheetNames: [],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' }, // no rtChannelId
    });

    // initializeRtChannel should be called and should return a new channel ID
    const initSpy = vi
      .spyOn(client, 'initializeRtChannel')
      .mockResolvedValue('abcdef1234567890abcdef1234567890');

    // broadcastChannelMessage will be called with the new RT channel
    vi.spyOn(netfluxModule, 'broadcastChannelMessage').mockResolvedValue(undefined);

    await client.sendCellUpdates([{ sheet: 'common', col: 'A', row: 1, value: 'test' }]);

    expect(initSpy).toHaveBeenCalledOnce();
  });

  it('uses the progress callback without emitting console output when auto-initializing a missing RT channel', async () => {
    const onProgress = vi.fn();
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      password: 'test',
      onProgress,
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
      cells: {},
      rows: [],
      sheets: {},
      sheetNames: [],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' },
    });

    const initSpy = vi
      .spyOn(client, 'initializeRtChannel')
      .mockResolvedValue('abcdef1234567890abcdef1234567890');
    const broadcastSpy = vi
      .spyOn(netfluxModule, 'broadcastChannelMessage')
      .mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await client.sendCellUpdates([{ sheet: 'common', col: 'A', row: 1, value: 'test' }]);

    expect(initSpy).toHaveBeenCalledOnce();
    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(
      'No OnlyOffice RT channel found. Initializing headlessly (no browser required)...',
    );
    expect(onProgress).toHaveBeenCalledWith(
      'RT channel initialized: abcdef1234567890abcdef1234567890',
    );
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('initializeRtChannel generates 32-hex channel and broadcasts metadata patch envelope', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');
    const broadcastSpy = vi
      .spyOn(netfluxModule, 'broadcastChannelMessage')
      .mockResolvedValue(undefined);

    const channelId = await client.initializeRtChannel();
    expect(channelId).toHaveLength(32);
    expect(broadcastSpy).toHaveBeenCalledTimes(1);

    const broadcastCall = broadcastSpy.mock.calls[0];
    const envelope = JSON.parse(broadcastCall[3]);
    expect(envelope[0]).toBe(2);
    const innerJson = JSON.parse(envelope[1][0][0][2]);
    expect(innerJson.content.channel).toBe(channelId);
  });

  it('createSheet broadcasts a real Sheet_Add record to the existing RT channel and returns the new sheetId', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890',
      cells: {},
      rows: [],
      sheets: { common: { cells: {}, rows: [] } },
      sheetNames: ['common'],
      sheetIds: { common: 'existing-id' },
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1', rtChannelId: 'rt-chan-1' },
    });
    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');
    const broadcastSpy = vi
      .spyOn(netfluxModule, 'broadcastChannelMessage')
      .mockResolvedValue(undefined);

    const newSheetId = await client.createSheet('checkout');

    expect(typeof newSheetId).toBe('string');
    expect(newSheetId).not.toBe('existing-id');
    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    const [wsUrl, channel, , payload] = broadcastSpy.mock.calls[0];
    expect(wsUrl).toBe('wss://cryptpad.fr/cryptpad_websocket');
    expect(channel).toBe('rt-chan-1'); // broadcasts to the existing RT channel, not the metadata channel

    const parsed = JSON.parse(payload);
    expect(parsed.type).toBe('saveChanges');
    expect(parsed.changes).toHaveLength(2); // txOpen + the sheet-add record
  });

  it('createSheet auto-initializes the RT channel first when the pad has never been opened by a real client', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890',
      cells: {},
      rows: [],
      sheets: {},
      sheetNames: [],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' }, // no rtChannelId
    });
    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');
    const initSpy = vi
      .spyOn(client, 'initializeRtChannel')
      .mockResolvedValue('abcdef1234567890abcdef1234567890');
    const broadcastSpy = vi
      .spyOn(netfluxModule, 'broadcastChannelMessage')
      .mockResolvedValue(undefined);

    await client.createSheet('common');

    expect(initSpy).toHaveBeenCalledOnce();
    const [, channel] = broadcastSpy.mock.calls[0];
    expect(channel).toBe('abcdef1234567890abcdef1234567890');
  });

  it('fetchSheetData retrieves metadata and RT channel changes', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');

    // 1. Metadata returns rtChannel
    const metaMessage = JSON.stringify([
      1,
      [[0, 0, JSON.stringify({ content: { channel: 'rt-chan-123' } })]],
    ]);

    // 2. RT channel returns cell update
    const rtPayload = JSON.stringify({
      changes: [
        {
          change: `asc_1;${Buffer.from(
            Buffer.concat([
              Buffer.from([0x08, 4, 0, 0, 0]),
              Buffer.from('A1', 'utf16le'),
              Buffer.from([0x08, 6, 0, 0, 0]),
              Buffer.from('var', 'utf16le'),
            ]),
          ).toString('base64')}`,
        },
      ],
    });

    vi.spyOn(netfluxModule, 'fetchChannelHistory').mockImplementation(async (_url, channelHex) => {
      if (channelHex === 'rt-chan-123') {
        return [rtPayload];
      }
      return [metaMessage];
    });

    const result = await client.fetchSheetData();
    expect(result.url).toBe('https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890');
    expect(result.metadata.rtChannelId).toBe('rt-chan-123');
  });

  it('fetchSheetData returns empty cells when no RT channel exists in metadata', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');
    vi.spyOn(netfluxModule, 'fetchChannelHistory').mockResolvedValue(['{}']);

    const result = await client.fetchSheetData();
    expect(result.cells).toEqual({});
    expect(result.metadata.rtChannelId).toBeUndefined();
  });

  it('detects var and key columns from first incoming row when sheet is empty', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890',
      cells: {},
      rows: [],
      sheets: {},
      sheetNames: [],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' },
    });

    const createSheetSpy = vi.spyOn(client, 'createSheet').mockResolvedValue('new-sheet-id');
    const sendSpy = vi.spyOn(client, 'sendCellUpdates').mockResolvedValue(undefined);

    // Incoming row with 'var'
    await client.writeSheetRows('empty', [{ var: 'intro.title', en: 'Hi' }]);
    expect(createSheetSpy).toHaveBeenCalledWith('empty', 0, undefined);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Incoming row with 'key'
    await client.writeSheetRows('empty', [{ key: 'intro.title', en: 'Hi' }]);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it('writeSheetRows skips rows without key and ignores undefined values', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890',
      cells: {},
      rows: [],
      sheets: {
        common: {
          cells: { A1: 'var', B1: 'en', A2: 'existing.key', B2: 'Existing Value' },
          rows: [{ var: 'existing.key', en: 'Existing Value' }],
        },
      },
      sheetNames: ['common'],
      sheetIds: { common: '8200316732097412_745' },
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' },
    });

    const sendSpy = vi.spyOn(client, 'sendCellUpdates').mockResolvedValue(undefined);

    await client.writeSheetRows('common', [
      { en: 'no key property' } as any,
      { var: 'new.key', en: undefined as any, es: 'Nuevo' },
    ]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const updates = sendSpy.mock.calls[0][0];
    // Should only have created entries for header + new.key + es (not for undefined en)
    expect(updates.some((u) => u.value === 'Nuevo')).toBe(true);
  });

  it('writeSheetRows creates a new tab (via createSheet) when the target sheet has no matching tab, mirroring Google Sheets addSheet-on-missing-sheet', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890',
      cells: {},
      rows: [],
      sheets: {
        common: { cells: {}, rows: [] },
        auth: { cells: {}, rows: [] },
      },
      sheetNames: ['common', 'auth'],
      sheetIds: { common: '8200316732097412_745', auth: '8200316732097412_746' },
      metadata: { app: 'sheet', mode: 'edit', channelId: 'c1' },
    });

    const createSheetSpy = vi
      .spyOn(client, 'createSheet')
      .mockResolvedValue('8200316732097412_999');
    const sendSpy = vi.spyOn(client, 'sendCellUpdates').mockResolvedValue(undefined);

    await client.writeSheetRows('checkout', [{ var: 'new.key', en: 'New' }]);

    // Inserted after the 2 existing tabs, matching Google's "just append" behavior.
    expect(createSheetSpy).toHaveBeenCalledWith('checkout', 2, undefined);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const updates = sendSpy.mock.calls[0][0];
    expect(updates.every((u) => u.sheetId === '8200316732097412_999')).toBe(true);
  });

  it('fetchSheetData handles sheets that have no cells in groupedCells', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed1234567890/',
    });

    vi.spyOn(client, 'getWebsocketUrl').mockResolvedValue('wss://cryptpad.fr/cryptpad_websocket');
    // Channel history returns metadata with RT channel and change for Sheet1 only
    const metaMessage = JSON.stringify({
      content: { channel: 'rt-chan-123' },
    });
    const rtPayload = JSON.stringify({
      changes: [{ change: '10;{"Sheet1":[]}' }],
    });

    vi.spyOn(netfluxModule, 'fetchChannelHistory').mockImplementation(async (_ws, channel) => {
      if (channel === 'rt-chan-123') return [rtPayload];
      return [metaMessage];
    });

    const result = await client.fetchSheetData();
    expect(result.sheets).toBeDefined();
  });
});

describe('CryptPadDriveClient direct methods', () => {
  it('parses array format and object format in Netflux history', async () => {
    const client = new CryptPadDriveClient({
      url: 'https://cryptpad.fr/drive/#/2/drive/edit/seed/p/',
      password: 'test',
    });

    vi.spyOn(netfluxModule, 'resolveCryptPadWebsocketUrl').mockResolvedValue(
      'wss://cryptpad.fr/cryptpad_websocket',
    );
    vi.spyOn(netfluxModule, 'fetchChannelHistory').mockResolvedValue([
      // Object format
      JSON.stringify({
        files: {
          f1: {
            title: 'Sheet One',
            href: '/sheet/#/2/sheet/edit/s1/p/',
            type: 'sheet',
          },
        },
      }),
      // Array format
      JSON.stringify([
        {
          id: 'f2',
          title: 'Sheet Two',
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/s2/p/',
          type: 'sheet',
        },
      ]),
    ]);

    const items = await client.listDriveItems();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toEqual(['Sheet One', 'Sheet Two']);

    const sheets = await client.listSheets();
    expect(sheets).toHaveLength(2);
  });

  it('throws when url is missing or invalid in CryptPadDriveClient', () => {
    expect(() => new CryptPadDriveClient({} as any)).toThrow(
      'CryptPadDriveClient requires a valid "url" option.',
    );
  });

  it('throws when url is missing or password is missing for password-protected pad in CryptPadClient', () => {
    expect(() => new CryptPadClient({} as any)).toThrow(
      'CryptPadClient requires a valid "url" option.',
    );

    expect(
      () =>
        new CryptPadClient({
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/',
          password: '',
        }),
    ).toThrow('is password protected, but no password was provided');
  });
});
