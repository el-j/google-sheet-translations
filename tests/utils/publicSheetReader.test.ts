import { readPublicSheet } from '../../src/utils/publicSheetReader';
import https from 'node:https';
import { EventEmitter } from 'node:events';

jest.mock('node:https');
jest.mock('node:http');

interface FakeResponse extends EventEmitter {
  statusCode?: number;
  headers: Record<string, string>;
}

/** Build a minimal fake IncomingMessage + ClientRequest pair that resolves with `body`. */
function buildFakeHttp(statusCode: number, body: string, headers: Record<string, string> = {}) {
  const res: FakeResponse = Object.assign(new EventEmitter(), {
    statusCode,
    headers,
  });

  // `req` needs an `end()` method because fetchUrl calls req.end()
  const req = Object.assign(new EventEmitter(), { end: jest.fn() });

  const trigger = (cb: (r: FakeResponse) => void) => {
    process.nextTick(() => {
      cb(res);
      process.nextTick(() => {
        res.emit('data', Buffer.from(body));
        res.emit('end');
      });
    });
    return req;
  };

  return { res, req, trigger };
}

/** Wraps the gviz response body the same way Google does. */
function gvizWrap(payload: object): string {
  return `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`;
}

describe('readPublicSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses headers=1 in the gviz URL so column labels are always populated', async () => {
    const payload = {
      status: 'ok',
      table: {
        cols: [
          { id: 'A', label: 'key', type: 'string' },
          { id: 'B', label: 'en', type: 'string' },
        ],
        rows: [{ c: [{ v: 'hello' }, { v: 'Hello' }] }],
      },
    };
    const { trigger } = buildFakeHttp(200, gvizWrap(payload));
    let capturedUrl = '';
    (https.get as jest.Mock).mockImplementation((url: string, cb: (r: unknown) => void) => {
      capturedUrl = url;
      return trigger(cb);
    });

    await readPublicSheet('SPREADSHEET_ID', 'mySheet');

    expect(capturedUrl).toContain('headers=1');
  });

  test('parses a valid gviz response into SheetRow[]', async () => {
    const payload = {
      status: 'ok',
      table: {
        cols: [
          { id: 'A', label: 'key', type: 'string' },
          { id: 'B', label: 'en', type: 'string' },
          { id: 'C', label: 'de', type: 'string' },
        ],
        rows: [
          { c: [{ v: 'welcome' }, { v: 'Welcome' }, { v: 'Willkommen' }] },
          { c: [{ v: 'goodbye' }, { v: 'Goodbye' }, { v: 'Auf Wiedersehen' }] },
        ],
      },
    };
    const { trigger } = buildFakeHttp(200, gvizWrap(payload));
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    const rows = await readPublicSheet('SPREADSHEET_ID', 'home');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ key: 'welcome', en: 'Welcome', de: 'Willkommen' });
    expect(rows[1]).toEqual({ key: 'goodbye', en: 'Goodbye', de: 'Auf Wiedersehen' });
  });

  test('returns empty array when table has no rows', async () => {
    const payload = {
      status: 'ok',
      table: { cols: [{ id: 'A', label: 'key', type: 'string' }], rows: [] },
    };
    const { trigger } = buildFakeHttp(200, gvizWrap(payload));
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    const rows = await readPublicSheet('SPREADSHEET_ID', 'empty_sheet');
    expect(rows).toEqual([]);
  });

  test('handles null cells by mapping them to empty string', async () => {
    const payload = {
      status: 'ok',
      table: {
        cols: [
          { id: 'A', label: 'key', type: 'string' },
          { id: 'B', label: 'en', type: 'string' },
        ],
        rows: [{ c: [{ v: 'hello' }, null] }],
      },
    };
    const { trigger } = buildFakeHttp(200, gvizWrap(payload));
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    const rows = await readPublicSheet('SPREADSHEET_ID', 'home');
    expect(rows[0]).toEqual({ key: 'hello', en: '' });
  });

  test('throws when gviz status is not "ok"', async () => {
    const payload = {
      status: 'error',
      errors: [{ message: 'Access denied' }],
      table: null,
    };
    const { trigger } = buildFakeHttp(200, gvizWrap(payload));
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    await expect(readPublicSheet('SPREADSHEET_ID', 'home')).rejects.toThrow('Access denied');
  });

  test('throws when the response body is not a valid gviz wrapper', async () => {
    const { trigger } = buildFakeHttp(200, '<html>Login required</html>');
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    await expect(readPublicSheet('SPREADSHEET_ID', 'home')).rejects.toThrow(
      /Failed to parse response/,
    );
  });

  test('throws when the HTTP request itself fails', async () => {
    const req = Object.assign(new EventEmitter(), { end: jest.fn() });
    (https.get as jest.Mock).mockImplementation(() => {
      process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
      return req;
    });

    await expect(readPublicSheet('SPREADSHEET_ID', 'home')).rejects.toThrow(
      /Failed to fetch public sheet/,
    );
  });

  test('throws on HTTP 4xx responses', async () => {
    const { trigger } = buildFakeHttp(403, 'Forbidden');
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) =>
      trigger(cb),
    );

    await expect(readPublicSheet('SPREADSHEET_ID', 'home')).rejects.toThrow(/Failed to fetch/);
  });

  test('follows a single redirect', async () => {
    const redirectRes: FakeResponse = Object.assign(new EventEmitter(), {
      statusCode: 302,
      headers: { location: 'https://docs.google.com/spreadsheets/redirect' },
    });
    const redirectReq = Object.assign(new EventEmitter(), { end: jest.fn() });

    const payload = {
      status: 'ok',
      table: {
        cols: [{ id: 'A', label: 'key', type: 'string' }],
        rows: [{ c: [{ v: 'hi' }] }],
      },
    };
    const { trigger: finalTrigger } = buildFakeHttp(200, gvizWrap(payload));

    let callCount = 0;
    (https.get as jest.Mock).mockImplementation((_url: string, cb: (r: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        process.nextTick(() => cb(redirectRes));
        return redirectReq;
      }
      return finalTrigger(cb);
    });

    const rows = await readPublicSheet('SPREADSHEET_ID', 'home');
    expect(rows).toHaveLength(1);
    expect(callCount).toBe(2);
  });
});
