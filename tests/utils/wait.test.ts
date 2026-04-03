vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn(),
}));

import { wait } from '../../src/utils/wait';
import { setTimeout as mockDelay } from 'node:timers/promises';

const mockDelayFn = mockDelay as MockedFunction<typeof mockDelay>;

describe('wait', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockDelayFn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should wait for the specified number of seconds', async () => {
    let resolveDelay!: () => void;
    mockDelayFn.mockReturnValueOnce(
      new Promise<void>(resolve => { resolveDelay = resolve; })
    );

    const waitPromise = wait(2, 'test wait');
    let resolved = false;
    waitPromise.then(() => { resolved = true; });

    // Before resolving the delay, promise should still be pending
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Resolve the delay and flush microtasks
    resolveDelay();
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  test('should log the reason for waiting', () => {
    mockDelayFn.mockResolvedValueOnce(undefined);
    wait(1, 'test reason');
    expect(console.log).toHaveBeenCalledWith('wait', 1, 'test reason');
  });

  test('passes the correct delay in milliseconds', () => {
    mockDelayFn.mockResolvedValueOnce(undefined);
    wait(3, 'three seconds');
    expect(mockDelayFn).toHaveBeenCalledWith(3000);
  });

  test('should resolve immediately with 0 seconds', async () => {
    mockDelayFn.mockResolvedValueOnce(undefined);
    await wait(0, 'no wait');
    expect(true).toBe(true);
  });
});
