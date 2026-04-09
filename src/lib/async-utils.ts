/**
 * Small async helpers for polling and retries. Prefer explicit use sites over
 * wrapping all HTTP traffic — see discussion on idempotency and status codes.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keep polling while value is still null/undefined, and (if `retryIfEmpty`) while value is `[]`. */
function shouldKeepPolling<T>(value: T, retryIfEmpty: boolean): boolean {
  if (value == null) return true;
  if (Array.isArray(value) && value.length === 0) {
    return retryIfEmpty;
  }
  return false;
}

/**
 * Calls `fn(...args)` until a “stable” result or `maxAttempts` is reached.
 * Retries while the result is `null`/`undefined`. If `retryIfEmpty` is true, also retries
 * while the result is an empty array (use for APIs where a lag can return `[]` before data exists).
 */
export async function pollUntil<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  args: A,
  maxAttempts = 3,
  delayMs = 2000,
  retryIfEmpty = false
): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await fn(...args);
    if (!shouldKeepPolling(last, retryIfEmpty)) {
      return last as T;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }
  return last as T;
}

export interface RetryOnThrowOptions {
  maxAttempts?: number;
  delayMs?: number;
}

/**
 * Retries when `fn` throws. Does not inspect return values.
 * Use only where retries are safe (e.g. idempotent reads or idempotent-keyed writes).
 */
export async function retryOnThrow<T>(
  fn: () => Promise<T>,
  options?: RetryOnThrowOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const delayMs = options?.delayMs ?? 2000;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}
