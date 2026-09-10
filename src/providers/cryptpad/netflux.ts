// @ts-nocheck
import { decryptCryptPadPayload, encryptCryptPadPayload } from './crypto';

export interface NetfluxBroadcastOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  signKey?: Uint8Array;
}

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
        const candidate = match[1].trim();
        if (!candidate) {
          throw new Error('Empty websocketPath');
        }

        if (/^ws(s)?:\/\//i.test(candidate)) {
          return candidate;
        }

        if (candidate.startsWith('/') || !/^[a-z]+:\/\//i.test(candidate)) {
          try {
            const urlObj = new URL(origin);
            const baseWsScheme = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
            const normalized = candidate.startsWith('/')
              ? `${baseWsScheme}//${urlObj.host}${candidate}`
              : `${baseWsScheme}//${urlObj.host}/${candidate.replace(/^\//, '')}`;
            return normalized;
          } catch {
            // Fall through to default guess below
          }
        }

        return candidate;
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
    let abortListener: (() => void) | null = null;
    let settled = false;

    const cleanup = () => {
      if (quietTimer) clearTimeout(quietTimer);
      if (overallTimeout) clearTimeout(overallTimeout);
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
      try {
        ws.close();
      } catch {
        // Ignore close errors
      }
    };

    const finish = (result: string[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const resetQuietTimer = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (decryptedMessages.length > 0) {
          finish(decryptedMessages);
        } else {
          rejectOnce(
            new Error(
              `Timeout after ${timeoutMs}ms waiting for CryptPad channel "${channelHex}" history.`,
            ),
          );
        }
      }, quietPeriodMs);
    };

    overallTimeout = setTimeout(() => {
      if (decryptedMessages.length > 0) {
        finish(decryptedMessages);
      } else {
        rejectOnce(
          new Error(
            `Timeout after ${timeoutMs}ms waiting for CryptPad channel "${channelHex}" history.`,
          ),
        );
      }
    }, timeoutMs);

    if (signal) {
      abortListener = () => {
        rejectOnce(new Error('Operation aborted'));
      };
      signal.addEventListener('abort', abortListener);
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
                JSON.stringify(['GET_FULL_HISTORY', channelHex]),
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
            // Case A: FULL_HISTORY streaming frames from GET_FULL_HISTORY
            if (Array.isArray(parsed) && parsed[0] === 'FULL_HISTORY' && Array.isArray(parsed[1])) {
              encStr = parsed[1][4];
            } else if (Array.isArray(parsed) && parsed[0] === 'FULL_HISTORY_END') {
              // Entire history received: finish immediately
              finish(decryptedMessages);
              return;
            } else if (
              Array.isArray(parsed) &&
              parsed[2] === 'MSG' &&
              typeof parsed[4] === 'string'
            ) {
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

    ws.onerror = (err: unknown) => {
      cleanup();
      const errObj = err as { message?: string; error?: { message?: string } | string } | undefined;
      const detail =
        errObj?.message ||
        errObj?.error?.message ||
        (errObj?.error ? String(errObj.error) : String(err));
      reject(new Error(`CryptPad WebSocket error: ${detail}`));
    };
  });
}

/**
 * Connects to the CryptPad Netflux WebSocket server, joins a channel,
 * encrypts the given message with TweetNaCl, and broadcasts it to all peers
 * in the channel (including historyKeeper).
 */
export function broadcastChannelMessage(
  wsUrl: string,
  channelHex: string,
  cryptKey: Uint8Array,
  message: string,
  options: NetfluxBroadcastOptions = {},
): Promise<void> {
  const { timeoutMs = 8000, signal } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted'));
    }

    const ws = new WebSocket(wsUrl);
    let seq = 1;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let sent = false;
    let abortListener: (() => void) | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
      try {
        ws.close();
      } catch {
        // Ignore
      }
    };

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    timeout = setTimeout(() => {
      if (sent) {
        resolveOnce();
      } else {
        rejectOnce(
          new Error(
            `Timeout after ${timeoutMs}ms broadcasting message to CryptPad channel "${channelHex}".`,
          ),
        );
      }
    }, timeoutMs);

    if (signal) {
      abortListener = () => {
        rejectOnce(new Error('Operation aborted'));
      };
      signal.addEventListener('abort', abortListener);
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

        const [, peerId, cmd] = msg;

        // When JOIN is acknowledged by history keeper or channel peer
        if (cmd === 'JOIN' && typeof peerId === 'string' && !sent) {
          sent = true;
          const encrypted = encryptCryptPadPayload(message, cryptKey, options.signKey);
          // Broadcast to channel
          ws.send(JSON.stringify([seq++, 'MSG', channelHex, encrypted]));

          // Brief delay (350ms) to ensure WebSocket frame TCP transmission and server-side Netflux
          // dispatch before the client socket terminates. Without this delay, immediately closing
          // the WebSocket truncates pending outgoing TCP buffers on certain proxies/TLS terminators.
          setTimeout(() => {
            resolveOnce();
          }, 350);
        }
      } catch {
        // Ignore
      }
    };

    ws.onerror = (err: unknown) => {
      const errObj = err as { message?: string; error?: { message?: string } | string } | undefined;
      const detail =
        errObj?.message ||
        errObj?.error?.message ||
        (errObj?.error ? String(errObj.error) : String(err));
      rejectOnce(new Error(`CryptPad WebSocket broadcast error: ${detail}`));
    };
  });
}
