export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

/** A transient scraper failure (network blip, YouTube hiccup) shouldn't take
 * the whole live down for the rest of the stream — retry with exponential
 * backoff, capped so it doesn't wait forever, and give up after enough
 * consecutive failures that it's clearly not transient anymore. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  maxAttempts: 6,
};

/** Exponential backoff with a cap: attempt 0 → baseDelayMs, doubling each
 * time, never exceeding maxDelayMs. */
export function retryDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const delay = policy.baseDelayMs * 2 ** Math.max(0, attempt);
  return Math.min(delay, policy.maxDelayMs);
}

export function hasExhaustedRetries(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return attempt >= policy.maxAttempts;
}
