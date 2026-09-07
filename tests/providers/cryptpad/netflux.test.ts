import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveCryptPadWebsocketUrl,
  fetchChannelHistory,
} from '../../../src/providers/cryptpad/netflux';
import { CryptPadClient } from '../../../src/providers/cryptpad/client';
import { createProvidersFromRuntimeConfig } from '../../../src/providers/runtime';
import { parseOnlyOfficeChanges } from '../../../src/providers/cryptpad/sheetParser';
import nacl from 'tweetnacl';
import { b64Encode } from '../../../src/providers/cryptpad/crypto';

describe('resolveCryptPadWebsocketUrl', () => {
  it('extracts websocketPath from /api/config', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"websocketPath": "wss://api.example.com/custom_ws"}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const wsUrl = await resolveCryptPadWebsocketUrl('https://example.com');
    expect(wsUrl).toBe('wss://api.example.com/custom_ws');
  });

  it('falls back to default guess on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const wsUrl = await resolveCryptPadWebsocketUrl('https://custom-pad.org');
    expect(wsUrl).toBe('wss://custom-pad.org/cryptpad_websocket');
  });
});

describe('fetchChannelHistory with Mock WebSocket', () => {
  class MockWebSocket {
    static instances: MockWebSocket[] = [];
    url: string;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(url: string) {
      this.url = url;
      MockWebSocket.instances.push(this);
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 5);
    }

    send(msg: string) {
      this.sent.push(msg);
      const parsed = JSON.parse(msg);
      // If client sent JOIN, simulate server response with historyKeeper JOIN
      if (parsed[1] === 'JOIN') {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({
              data: JSON.stringify([0, '0123456789abcdef', 'JOIN', parsed[2]]),
            });
          }
        }, 10);
      }
    }

    close() {
      if (this.onclose) this.onclose();
    }
  }

  const originalWs = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.stubGlobal('WebSocket', originalWs);
    vi.unstubAllGlobals();
  });

  it('connects, requests history, decrypts messages and finishes', async () => {
    const key = nacl.randomBytes(32);
    const nonce = nacl.randomBytes(24);
    const plaintext = JSON.stringify({ changes: [{ change: '"10;hello"' }] });
    const cipher = nacl.secretbox(Buffer.from(plaintext, 'utf8'), nonce, key);
    const encPayload = `${b64Encode(nonce)}|${b64Encode(cipher)}`;

    const historyPromise = fetchChannelHistory('wss://test.cryptpad/ws', 'testchan123', key, {
      timeoutMs: 2000,
      quietPeriodMs: 50,
    });

    // After history request is sent, simulate historyKeeper sending message
    setTimeout(() => {
      const wsInstance = MockWebSocket.instances[0];
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify([0, '0123456789abcdef', 'MSG', 'testchan123', encPayload]),
        });
      }
    }, 30);

    const messages = await historyPromise;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(plaintext);
  });

  it('rejects if aborted via signal', async () => {
    const key = nacl.randomBytes(32);
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Operation aborted');
  });

  it('handles WebSocket error', async () => {
    const key = nacl.randomBytes(32);
    const promise = fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
      timeoutMs: 1000,
    });

    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      if (ws && ws.onerror) {
        ws.onerror(new Error('Connection failed'));
      }
    }, 15);

    await expect(promise).rejects.toThrow('CryptPad WebSocket error');
  });
});

describe('CryptPadClient methods and runtime integration', () => {
  it('instantiates CryptPadClient and derives keys', () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
    });

    const keys = client.getKeys();
    expect(keys.channelHex).toBe('89f46131586f54a4e0aef4feeb4ed932');
    expect(keys.cryptKey).toHaveLength(32);
  });

  it('getWebsocketUrl returns custom websocketUrl when configured', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
      websocketUrl: 'wss://custom.cryptpad.net/ws',
    });

    const url = await client.getWebsocketUrl();
    expect(url).toBe('wss://custom.cryptpad.net/ws');
  });

  it('fetchSheetRows delegates to fetchSheetData', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
    });

    vi.spyOn(client, 'fetchSheetData').mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      cells: { A1: 'key', B1: 'en', A2: 'hi', B2: 'Hello' },
      rows: [{ key: 'hi', en: 'Hello' }],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'ch1' },
    });

    const rows = await client.fetchSheetRows();
    expect(rows).toEqual([{ key: 'hi', en: 'Hello' }]);
  });

  it('wires into runtime createProvidersFromRuntimeConfig', async () => {
    const selection = createProvidersFromRuntimeConfig({
      input: {
        provider: 'cryptpad-sheet',
        options: {
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
          password: 'test-test',
        },
      },
    });

    expect(selection.inputProvider.providerId).toBe('cryptpad-sheet');
    expect(selection.inputProvider.capabilities.readTables).toBe(true);
  });
});

describe('parseOnlyOfficeChanges edge cases', () => {
  it('parses binary coordinates with UTF-16 text', () => {
    // Construct a buffer with r1=0, c1=1 (B1), and UTF-16LE text 'Title'
    const header = Buffer.alloc(40);
    header.writeUInt32LE(1, 14); // c1 = 1 (col B)
    header.writeUInt32LE(0, 18); // r1 = 0 (row 1)

    const textBuf = Buffer.from('Title', 'utf16le');
    const marker = Buffer.alloc(5);
    marker[0] = 0x08;
    marker.writeUInt32LE(textBuf.length, 1);

    const changeBytes = Buffer.concat([header, marker, textBuf]);
    const changeStr = JSON.stringify(`10;${changeBytes.toString('base64')}`);

    const rtMessages = [
      JSON.stringify({
        changes: [{ change: changeStr }],
      }),
    ];

    const cells = parseOnlyOfficeChanges(rtMessages);
    expect(cells['B1']).toBe('Title');
  });
});
