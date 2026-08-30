import { withRetry } from '../../src/utils/rateLimiter';

vi.useFakeTimers();

describe('withRetry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('calls fn once and returns its result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 'test');
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('re-throws non-rate-limit errors immediately without retrying', async () => {
    const error = new Error('network failure');
    const fn = vi.fn().mockRejectedValue(error);
    await expect(withRetry(fn, 'test')).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on HTTP 429 and succeeds on second attempt', async () => {
    const rateLimitErr = { status: 429 };
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 'test', 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[rate-limit]'));
  });

  test('retries on HTTP 503 and succeeds on second attempt', async () => {
    const serviceErr = { status: 503 };
    const fn = vi.fn()
      .mockRejectedValueOnce(serviceErr)
      .mockResolvedValue('done');

    const promise = withRetry(fn, 'test', 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('also detects rate-limit errors via response.status', async () => {
    const nestedErr = { response: { status: 429 } };
    const fn = vi.fn()
      .mockRejectedValueOnce(nestedErr)
      .mockResolvedValue('nested-ok');

    const promise = withRetry(fn, 'test', 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('nested-ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('exhausts all retries and re-throws the rate-limit error', async () => {
    const rateLimitErr = { status: 429 };
    const fn = vi.fn().mockRejectedValue(rateLimitErr);

    const promise = withRetry(fn, 'test', 100, 3);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(rateLimitErr);
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  test('does not retry on unrecognised error status', async () => {
    const notFoundErr = { status: 404 };
    const fn = vi.fn().mockRejectedValue(notFoundErr);
    await expect(withRetry(fn, 'test')).rejects.toBe(notFoundErr);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
