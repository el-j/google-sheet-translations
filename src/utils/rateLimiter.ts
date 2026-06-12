import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_RETRIES = 3;
const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * Returns true when the error looks like a Google Sheets API rate-limit or
 * transient server error (HTTP 429 or 503).
 */
function isRateLimitError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as Record<string, unknown>;
	const response = e['response'] as Record<string, unknown> | undefined;
	const status =
		typeof e['status'] === 'number'
			? e['status']
			: typeof response?.['status'] === 'number'
				? (response['status'] as number)
				: undefined;
	return status === 429 || status === 503;
}

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
export async function withRetry<T>(
	fn: () => Promise<T>,
	label: string,
	baseDelayMs = 1_000,
	retries = DEFAULT_RETRIES,
	maxDelayMs = DEFAULT_MAX_DELAY_MS,
): Promise<T> {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (!isRateLimitError(err) || attempt === retries) throw err;
			const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
			console.warn(
				`[rate-limit] ${label}: retry ${attempt + 1}/${retries} in ${backoff} ms`,
			);
			await delay(backoff);
		}
	}
	// The loop above always returns (on success) or throws (on exhausted retries or
	// non-rate-limit errors).  This line is here solely to satisfy TypeScript's
	// control-flow analysis — it cannot actually be reached at runtime.
	/* c8 ignore next */
	throw new Error('withRetry: unreachable');
}

export default withRetry;
