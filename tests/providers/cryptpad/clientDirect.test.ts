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
});
