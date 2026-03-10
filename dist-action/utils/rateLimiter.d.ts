/**
 * Calls `fn` and, on a rate-limit error (HTTP 429 / 503), retries with
 * exponential back-off.  Any other error is re-thrown immediately.
 *
 * @param fn           - The async operation to execute (and potentially retry)
 * @param label        - Human-readable label used in warning logs
 * @param baseDelayMs  - Base back-off delay in milliseconds (default: 1 000)
 * @param retries      - Maximum number of retry attempts (default: 3)
 * @param maxDelayMs   - Back-off ceiling in milliseconds (default: 30 000)
 * @returns The resolved value of `fn`
 * @throws  The last error if all retries are exhausted, or any non-rate-limit error immediately
 */
export declare function withRetry<T>(fn: () => Promise<T>, label: string, baseDelayMs?: number, retries?: number, maxDelayMs?: number): Promise<T>;
export default withRetry;
//# sourceMappingURL=rateLimiter.d.ts.map