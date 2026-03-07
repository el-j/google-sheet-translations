import { setTimeout as delay } from 'node:timers/promises';

/**
 * Creates a promise that resolves after a specified number of seconds.
 * Uses the built-in `node:timers/promises` API which is designed for
 * use with `await` and keeps the event loop alive until the delay expires.
 *
 * @param seconds - The number of seconds to wait
 * @param reason  - A description of why we are waiting (for logging)
 * @returns A promise that resolves after the specified delay
 */
export function wait(seconds: number, reason: string): Promise<void> {
	console.log('wait', seconds, reason);
	return delay(seconds * 1000);
}

export default wait;
