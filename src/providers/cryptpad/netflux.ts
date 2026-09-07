import { decryptCryptPadPayload } from './crypto';

export interface NetfluxHistoryOptions {
  timeoutMs?: number;
  quietPeriodMs?: number;
  signal?: AbortSignal;
}

/**
 * Discovers the real WebSocket URL for a CryptPad instance by querying its `/api/config` endpoint.
 */
export async function resolveCryptPadWebsocketUrl(
  origin: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const configUrl = `${origin.replace(/\/$/, '')}/api/config`;
    const res = await fetch(configUrl, { signal });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/"websocketPath":\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // Fall back to default guess
  }

  const urlObj = new URL(origin);
  const isSecure = urlObj.protocol === 'https:';
  return `${isSecure ? 'wss:' : 'ws:'}//${urlObj.host}/cryptpad_websocket`;
}

/**
 * Connects to the CryptPad Netflux WebSocket server, joins a channel,
 * requests its complete history from the historyKeeper peer, decrypts all messages,
 * and returns the decrypted message strings.
 */
export function fetchChannelHistory(
  wsUrl: string,
  channelHex: string,
  cryptKey: Uint8Array,
  options: NetfluxHistoryOptions = {},
): Promise<string[]> {
  const { timeoutMs = 8000, quietPeriodMs = 1200, signal } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted'));
    }

    const ws = new WebSocket(wsUrl);
    let seq = 1;
    const decryptedMessages: string[] = [];
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let overallTimeout: ReturnType<typeof setTimeout> | null = null;
    let requestedHistory = false;

    const cleanup = () => {
      if (quietTimer) clearTimeout(quietTimer);
      if (overallTimeout) clearTimeout(overallTimeout);
      try {
        ws.close();
      } catch {
        // Ignore close errors
      }
    };

    const finish = () => {
      cleanup();
      resolve(decryptedMessages);
    };

    const resetQuietTimer = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietPeriodMs);
    };

    overallTimeout = setTimeout(() => {
      cleanup();
      if (decryptedMessages.length > 0) {
        resolve(decryptedMessages);
      } else {
        reject(
          new Error(
            `Timeout after ${timeoutMs}ms waiting for CryptPad channel "${channelHex}" history.`,
          ),
        );
      }
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Operation aborted'));
      });
    }

    ws.onopen = () => {
      // Send Netflux JOIN
      ws.send(JSON.stringify([seq++, 'JOIN', channelHex]));
    };

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString();
        const msg = JSON.parse(raw);
        if (!Array.isArray(msg)) return;

        const [, peerId, cmd, , payload] = msg;

        // Discover historyKeeper
        if (cmd === 'JOIN' && typeof peerId === 'string' && peerId.length === 16) {
          if (!requestedHistory) {
            requestedHistory = true;
            ws.send(
              JSON.stringify([
                seq++,
                'MSG',
                peerId,
                JSON.stringify(['GET_HISTORY', channelHex, {}]),
              ]),
            );
            resetQuietTimer();
          }
        }

        // Handle incoming history / broadcast message
        if (cmd === 'MSG') {
          // Payload can be in msg[4] or nested array
          let encStr = payload;
          if (!encStr && typeof msg[3] === 'string' && msg[3].length > 50) {
            encStr = msg[3];
          }

          try {
            const parsed = JSON.parse(encStr);
            if (Array.isArray(parsed) && parsed[2] === 'MSG' && typeof parsed[4] === 'string') {
              encStr = parsed[4];
            }
          } catch {
            // Use as is
          }

          if (typeof encStr === 'string' && encStr.length > 30) {
            const decrypted = decryptCryptPadPayload(encStr, cryptKey);
            if (decrypted) {
              decryptedMessages.push(decrypted);
              resetQuietTimer();
            }
          }
        }
      } catch {
        // Ignore unparseable frames
      }
    };

    ws.onerror = (err) => {
      cleanup();
      reject(new Error(`CryptPad WebSocket error: ${String(err)}`));
    };
  });
}
