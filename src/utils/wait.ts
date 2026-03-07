/**
 * Creates a promise that resolves after a specified number of seconds
 * @param seconds - The number of seconds to wait
 * @param reason - A description of why we're waiting
 * @returns A promise that resolves after the specified delay
 */
export function wait(seconds: number, reason: string): Promise<void> {
	console.log("wait", seconds, reason);
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			resolve();
		}, seconds * 1000);
	});
}

export default wait;
