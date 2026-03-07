import { wait } from '../../src/utils/wait';

// Mock setTimeout to avoid actually waiting in tests
jest.useFakeTimers();

describe('wait', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should wait for the specified number of seconds', async () => {
    const waitPromise = wait(2, 'test wait');
    
    // The promise should not resolve immediately
    let resolved = false;
    waitPromise.then(() => {
      resolved = true;
    });
    
    // Fast-forward time by less than the wait duration
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // Let any pending microtasks run
    
    // Promise should not be resolved yet
    expect(resolved).toBe(false);
    
    // Fast-forward time to complete the wait duration
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // Let any pending microtasks run
    
    // Promise should now be resolved
    expect(resolved).toBe(true);
  });

  test('should log the reason for waiting', () => {
    wait(1, 'test reason');
    expect(console.log).toHaveBeenCalledWith('wait', 1, 'test reason');
  });

  test('should resolve immediately with 0 seconds', async () => {
    const waitPromise = wait(0, 'no wait');
    
    // Fast-forward all timers
    jest.runAllTimers();
    await waitPromise;
    
    // If we got here, the promise resolved successfully
    expect(true).toBe(true);
  });

  test('timer should not be unref\'d (prevents Node.js exit code 13 in ESM consumers)', () => {
    // Spy on setTimeout to capture the returned timer ID.
    // afterEach's jest.restoreAllMocks() will clean this up automatically.
    const mockTimerId = { unref: jest.fn() };
    jest.spyOn(global, 'setTimeout').mockReturnValueOnce(mockTimerId as unknown as ReturnType<typeof setTimeout>);

    wait(1, 'ref check');

    // The timer's unref method must NOT have been called.
    // Calling unref() on the only active timer causes Node.js to exit with
    // code 13 ("Unfinished Top-Level Await") when the package is used from
    // an ESM script (.mjs) with a top-level await.
    expect(mockTimerId.unref).not.toHaveBeenCalled();
  });
});
