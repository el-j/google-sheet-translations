import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  GcpApiError,
  getGcpAccessToken,
  gcpFetch,
  waitForOperation,
} from '../../src/setup/gcpTransport';
import { GoogleAuth } from 'google-auth-library';

const mockGetAccessToken = vi.fn();
const mockGetClient = vi.fn();

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn(function () {
    return { getClient: mockGetClient };
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('gcpTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GcpApiError', () => {
    it('creates an instance with message and status', () => {
      const err = new GcpApiError('Forbidden', 403);
      expect(err.message).toBe('Forbidden');
      expect(err.status).toBe(403);
      expect(err.name).toBe('GcpApiError');
    });
  });

  describe('getGcpAccessToken', () => {
    it('returns access token on success', async () => {
      mockGetAccessToken.mockResolvedValue({ token: 'test-token' });
      mockGetClient.mockResolvedValue({ getAccessToken: mockGetAccessToken });

      const token = await getGcpAccessToken('/path/to/key.json');
      expect(token).toBe('test-token');
      expect(GoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({ keyFilename: '/path/to/key.json' }),
      );
    });

    it('throws when no token is returned', async () => {
      mockGetAccessToken.mockResolvedValue({ token: null });
      mockGetClient.mockResolvedValue({ getAccessToken: mockGetAccessToken });

      await expect(getGcpAccessToken()).rejects.toThrow(
        'Failed to obtain a Google Cloud access token',
      );
    });
  });

  describe('gcpFetch', () => {
    it('performs GET request and returns JSON data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ foo: 'bar' }),
      });

      const res = await gcpFetch('https://example.googleapis.com', 'token-123');
      expect(res).toEqual({ foo: 'bar' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.googleapis.com',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        }),
      );
    });

    it('performs POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const res = await gcpFetch('https://example.googleapis.com', 'token-123', 'POST', {
        hello: 'world',
      });
      expect(res).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.googleapis.com',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ hello: 'world' }),
        }),
      );
    });

    it('throws GcpApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Not found' } }),
      });

      await expect(gcpFetch('https://example.googleapis.com', 'token')).rejects.toThrow(
        GcpApiError,
      );
    });

    it('falls back to HTTP status message when error payload has no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(gcpFetch('https://example.googleapis.com', 'token')).rejects.toThrow('HTTP 500');
    });
  });

  describe('waitForOperation', () => {
    it('waits for relative operation name until done', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'operations/123', done: true }),
      });

      await waitForOperation('operations/123', 'token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://iam.googleapis.com/v1/operations/123',
        expect.anything(),
      );
    });

    it('supports full Google API operation URL (line 117)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'op-full', done: true }),
      });

      await waitForOperation('https://iam.googleapis.com/v1/operations/custom', 'token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://iam.googleapis.com/v1/operations/custom',
        expect.anything(),
      );
    });

    it('throws for invalid operation URL hostname', async () => {
      await expect(
        waitForOperation('https://untrusted-domain.com/operations/123', 'token-123'),
      ).rejects.toThrow('Invalid operation URL');
    });

    it('catches URL parse errors for malformed http strings', async () => {
      await expect(waitForOperation('https://[::invalid', 'token')).rejects.toThrow(
        'Invalid operation URL',
      );
    });

    it('throws when operation finishes with an error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          name: 'operations/err',
          done: true,
          error: { message: 'Quota exceeded' },
        }),
      });

      await expect(waitForOperation('operations/err', 'token')).rejects.toThrow(
        'Operation failed: Quota exceeded',
      );
    });

    it('throws timeout when deadline is exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ name: 'operations/slow', done: false }),
      });

      // maxWaitMs = 10ms
      await expect(waitForOperation('operations/slow', 'token', 10)).rejects.toThrow(
        'Operation timed out',
      );
    });
  });
});
