// @ts-nocheck
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

  it('rejects if channel history does not reply before timeout', async () => {
    const key = nacl.randomBytes(32);
    await expect(
      fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
        timeoutMs: 50,
        quietPeriodMs: 10,
      }),
    ).rejects.toThrow('Timeout after 50ms waiting for CryptPad channel "testchan" history.');
  });

  it('finishes with decrypted messages if overallTimeout fires when messages exist', async () => {
    const key = nacl.randomBytes(32);
    const nonce = nacl.randomBytes(24);
    const plaintext = JSON.stringify({ changes: [{ change: '"10;timeout-finish"' }] });
    const cipher = nacl.secretbox(Buffer.from(plaintext, 'utf8'), nonce, key);
    const encPayload = `${b64Encode(nonce)}|${b64Encode(cipher)}`;

    const historyPromise = fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
      timeoutMs: 50,
      quietPeriodMs: 300,
    });

    setTimeout(() => {
      const wsInstance = MockWebSocket.instances[0];
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify([0, '0123456789abcdef', 'MSG', '', encPayload]),
        });
      }
    }, 15);

    const messages = await historyPromise;
    expect(messages).toHaveLength(1);
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

  it('aborts fetchChannelHistory when signal is aborted before start', async () => {
    const key = nacl.randomBytes(32);
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Operation aborted');
  });

  it('aborts fetchChannelHistory when signal is aborted during execution', async () => {
    const key = nacl.randomBytes(32);
    const controller = new AbortController();

    const promise = fetchChannelHistory('wss://test.cryptpad/ws', 'testchan', key, {
      timeoutMs: 5000,
      signal: controller.signal,
    });

    setTimeout(() => {
      controller.abort();
    }, 15);

    await expect(promise).rejects.toThrow('Operation aborted');
  });

  it('handles alternative message formats with payload in msg[3] and nested MSG array', async () => {
    const key = nacl.randomBytes(32);
    const nonce = nacl.randomBytes(24);
    const plaintext = JSON.stringify({ changes: [{ change: '"10;alt-format"' }] });
    const cipher = nacl.secretbox(Buffer.from(plaintext, 'utf8'), nonce, key);
    const encPayload = `${b64Encode(nonce)}|${b64Encode(cipher)}`;

    const historyPromise = fetchChannelHistory('wss://test.cryptpad/ws', 'testchan123', key, {
      timeoutMs: 2000,
      quietPeriodMs: 40,
    });

    setTimeout(() => {
      const wsInstance = MockWebSocket.instances[0];
      if (wsInstance && wsInstance.onmessage) {
        // Format A: payload is empty, but msg[3] has length > 50
        wsInstance.onmessage({
          data: JSON.stringify([0, 'peer', 'MSG', encPayload]),
        });

        // Format B: nested MSG array
        const nestedMsg = JSON.stringify([0, 'peer2', 'MSG', '', encPayload]);
        wsInstance.onmessage({
          data: JSON.stringify([0, 'peer', 'MSG', nestedMsg]),
        });
      }
    }, 20);

    const messages = await historyPromise;
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('broadcastChannelMessage timeout and abort handling', () => {
  class MockBroadcastSocket {
    static instances: MockBroadcastSocket[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    closed = false;

    constructor(public url: string) {
      MockBroadcastSocket.instances.push(this);
      setTimeout(() => this.onopen?.(), 5);
    }

    send(msg: string) {
      if (msg.includes('JOIN')) {
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify([0, 'peer123', 'JOIN', 'channel123']),
          });
        }, 10);
      }
    }

    close() {
      this.closed = true;
    }
  }

  const originalWs = globalThis.WebSocket;

  beforeEach(() => {
    MockBroadcastSocket.instances = [];
    vi.stubGlobal('WebSocket', MockBroadcastSocket as any);
  });

  afterEach(() => {
    vi.stubGlobal('WebSocket', originalWs);
    vi.unstubAllGlobals();
  });

  it('broadcasts and resolves after join acknowledgement', async () => {
    const key = nacl.randomBytes(32);
    await expect(
      import('../../../src/providers/cryptpad/netflux').then(({ broadcastChannelMessage }) =>
        broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
          timeoutMs: 500,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects when broadcast is immediately aborted with pre-aborted signal', async () => {
    const key = nacl.randomBytes(32);
    const controller = new AbortController();
    controller.abort();

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Operation aborted');
  });

  it('rejects when broadcast times out before JOIN is acknowledged', async () => {
    const key = nacl.randomBytes(32);

    // Custom socket that never replies to JOIN
    class SilentSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      closed = false;
      constructor() {
        setTimeout(() => this.onopen?.(), 5);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', SilentSocket as any);

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        timeoutMs: 30,
      }),
    ).rejects.toThrow('Timeout after 30ms broadcasting message to CryptPad channel "channel123".');
  });

  it('rejects when WebSocket encounters an error during broadcast', async () => {
    const key = nacl.randomBytes(32);

    class ErrorSocket {
      onopen: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      closed = false;
      constructor() {
        setTimeout(() => {
          this.onerror?.(new Error('Socket network failed'));
        }, 5);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', ErrorSocket as any);

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        timeoutMs: 500,
      }),
    ).rejects.toThrow('CryptPad WebSocket broadcast error');
  });

  it('ignores malformed messages received over broadcast WebSocket', async () => {
    const key = nacl.randomBytes(32);

    class MalformedMessageSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: any }) => void) | null = null;
      closed = false;
      constructor() {
        setTimeout(() => {
          this.onopen?.();
          // Send non-json string
          this.onmessage?.({ data: 'NOT_JSON' });
          // Send non-array json
          this.onmessage?.({ data: JSON.stringify({ not: 'an array' }) });
          // Send actual join acknowledgement
          this.onmessage?.({
            data: JSON.stringify([0, 'peer123', 'JOIN', 'channel123']),
          });
        }, 5);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', MalformedMessageSocket as any);

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        timeoutMs: 500,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects when broadcast signal aborts while in-flight', async () => {
    const key = nacl.randomBytes(32);
    const controller = new AbortController();

    class StalledSocket {
      onopen: (() => void) | null = null;
      closed = false;
      constructor() {
        setTimeout(() => {
          this.onopen?.();
          controller.abort();
        }, 5);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', StalledSocket as any);

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        signal: controller.signal,
        timeoutMs: 500,
      }),
    ).rejects.toThrow('Operation aborted');
  });

  it('resolves when timeout fires after message is marked sent', async () => {
    const key = nacl.randomBytes(32);

    class FastSendSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: any }) => void) | null = null;
      closed = false;
      constructor() {
        setTimeout(() => {
          this.onopen?.();
          this.onmessage?.({
            data: JSON.stringify([0, 'peer123', 'JOIN', 'channel123']),
          });
        }, 2);
      }
      send() {}
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('WebSocket', FastSendSocket as any);

    const { broadcastChannelMessage } = await import('../../../src/providers/cryptpad/netflux');
    // Set timeout to 50ms (shorter than the 350ms frame flush timer, but after message is sent)
    await expect(
      broadcastChannelMessage('wss://test.cryptpad/ws', 'channel123', key, 'hello world', {
        timeoutMs: 50,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('resolveCryptPadWebsocketUrl', () => {
  it('discovers custom websocketPath from /api/config', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"websocketPath": "wss://custom.cryptpad/ws_endpoint"}'),
    } as any);

    const { resolveCryptPadWebsocketUrl } = await import('../../../src/providers/cryptpad/netflux');
    const wsUrl = await resolveCryptPadWebsocketUrl('https://cryptpad.fr');
    expect(wsUrl).toBe('wss://custom.cryptpad/ws_endpoint');

    globalThis.fetch = originalFetch;
  });

  it('falls back to default guess on fetch failure or missing path', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { resolveCryptPadWebsocketUrl } = await import('../../../src/providers/cryptpad/netflux');
    const httpsWs = await resolveCryptPadWebsocketUrl('https://cryptpad.fr');
    expect(httpsWs).toBe('wss://cryptpad.fr/cryptpad_websocket');

    const httpWs = await resolveCryptPadWebsocketUrl('http://localhost:3000');
    expect(httpWs).toBe('ws://localhost:3000/cryptpad_websocket');

    globalThis.fetch = originalFetch;
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
