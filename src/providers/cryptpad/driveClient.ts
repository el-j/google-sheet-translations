import { parsePadUrl, deriveCryptPadKeys, type ParsedCryptPadUrl } from './crypto';
import { resolveCryptPadWebsocketUrl, fetchChannelHistory } from './netflux';

export interface CryptPadDriveItem {
  id: string;
  title: string;
  type: 'sheet' | 'file' | 'pad' | 'folder';
  url: string;
  password?: string;
  channel?: string;
  path: string;
  ctime?: number;
  mtime?: number;
}

export interface CryptPadDriveClientOptions {
  /** Full CryptPad Drive URL (e.g. https://cryptpad.fr/drive/#/2/drive/edit/seed/p/). */
  url: string;
  /** Optional password if the drive pad is password-protected. */
  password?: string;
  /** Optional map of passwords keyed by pad URL or title. */
  passwords?: Record<string, string>;
  /** Optional timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Headless client for inspecting and traversing encrypted CryptPad Drive folders.
 */
export class CryptPadDriveClient {
  readonly parsedUrl: ParsedCryptPadUrl;
  readonly password?: string;
  readonly passwords: Record<string, string>;
  readonly timeoutMs: number;

  constructor(options: CryptPadDriveClientOptions) {
    if (!options.url || typeof options.url !== 'string') {
      throw new Error('CryptPadDriveClient requires a valid "url" option.');
    }

    this.parsedUrl = parsePadUrl(options.url);
    this.password = options.password ?? process.env.CRYPTPAD_PASSWORD;
    this.passwords = options.passwords ?? {};
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Fetches the drive pad's Netflux history, decrypts all changes, and parses
   * the hierarchical filesystem tree into a flat list of items.
   */
  async listDriveItems(signal?: AbortSignal): Promise<CryptPadDriveItem[]> {
    const wsUrl = await resolveCryptPadWebsocketUrl(this.parsedUrl.origin, signal);
    const { channelHex, cryptKey } = deriveCryptPadKeys(this.parsedUrl.seed, this.password);

    const messages = await fetchChannelHistory(wsUrl, channelHex, cryptKey, {
      timeoutMs: this.timeoutMs,
      signal,
    });

    const items: CryptPadDriveItem[] = [];

    for (const raw of messages) {
      try {
        const parsed = JSON.parse(raw);

        // Format A: Object with files/folders dictionary
        if (parsed && typeof parsed === 'object') {
          const fileDict = parsed.files || parsed.data?.files || parsed;

          if (fileDict && typeof fileDict === 'object' && !Array.isArray(fileDict)) {
            for (const [id, val] of Object.entries(fileDict)) {
              if (!val || typeof val !== 'object') continue;
              const fileObj = val as Record<string, unknown>;
              const title = String(fileObj.title || fileObj.name || id);
              const href = String(fileObj.href || fileObj.url || '');
              const typeStr = String(
                fileObj.type || fileObj.app || (href.includes('/sheet/') ? 'sheet' : 'file'),
              );

              const type: CryptPadDriveItem['type'] = typeStr.includes('sheet')
                ? 'sheet'
                : typeStr.includes('folder')
                  ? 'folder'
                  : typeStr.includes('pad')
                    ? 'pad'
                    : 'file';

              const itemUrl = href.startsWith('http')
                ? href
                : `${this.parsedUrl.origin}${href.startsWith('/') ? '' : '/'}${href}`;

              const password =
                (fileObj.password as string | undefined) ??
                this.passwords[itemUrl] ??
                this.passwords[title] ??
                this.password;

              items.push({
                id,
                title,
                type,
                url: itemUrl,
                password,
                channel: typeof fileObj.channel === 'string' ? fileObj.channel : undefined,
                path: title,
                ctime: typeof fileObj.ctime === 'number' ? fileObj.ctime : undefined,
                mtime: typeof fileObj.mtime === 'number' ? fileObj.mtime : undefined,
              });
            }
          }

          // Format B: Array of items
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              if (!entry || typeof entry !== 'object') continue;
              const fileObj = entry as Record<string, unknown>;
              const title = String(fileObj.title || fileObj.name || 'untitled');
              const href = String(fileObj.href || fileObj.url || '');
              const typeStr = String(
                fileObj.type || fileObj.app || (href.includes('/sheet/') ? 'sheet' : 'file'),
              );

              const type: CryptPadDriveItem['type'] = typeStr.includes('sheet')
                ? 'sheet'
                : typeStr.includes('folder')
                  ? 'folder'
                  : typeStr.includes('pad')
                    ? 'pad'
                    : 'file';

              const itemUrl = href.startsWith('http')
                ? href
                : `${this.parsedUrl.origin}${href.startsWith('/') ? '' : '/'}${href}`;

              const password =
                (fileObj.password as string | undefined) ??
                this.passwords[itemUrl] ??
                this.passwords[title] ??
                this.password;

              items.push({
                id: String(fileObj.id || title),
                title,
                type,
                url: itemUrl,
                password,
                channel: typeof fileObj.channel === 'string' ? fileObj.channel : undefined,
                path: title,
              });
            }
          }
        }
      } catch {
        // Ignore unparseable message
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduplicated: CryptPadDriveItem[] = [];
    for (const item of items) {
      if (item.url && !seen.has(item.url)) {
        seen.add(item.url);
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }

  /**
   * Filters and returns only spreadsheets found within the drive folder.
   */
  async listSheets(signal?: AbortSignal): Promise<CryptPadDriveItem[]> {
    const items = await this.listDriveItems(signal);
    return items.filter((item) => item.type === 'sheet' || item.url.includes('/sheet/'));
  }
}
