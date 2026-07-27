import { describe, expect, test } from "vitest";
import { DEFAULT_RETRY_POLICY, hasExhaustedRetries, retryDelayMs, type RetryPolicy } from "./retryPolicy";

describe("retryDelayMs", () => {
  test("starts at the base delay on the first attempt", () => {
    expect(retryDelayMs(0)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs);
  });

  test("doubles with each attempt", () => {
    expect(retryDelayMs(1)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs * 2);
    expect(retryDelayMs(2)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs * 4);
  });

  test("never exceeds the max delay, however high the attempt count", () => {
    expect(retryDelayMs(20)).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  test("respects a custom policy", () => {
    const policy: RetryPolicy = { baseDelayMs: 100, maxDelayMs: 500, maxAttempts: 3 };
    expect(retryDelayMs(0, policy)).toBe(100);
    expect(retryDelayMs(1, policy)).toBe(200);
    expect(retryDelayMs(3, policy)).toBe(500); // would be 800 uncapped
  });
});

describe("hasExhaustedRetries", () => {
  test("false while under the attempt limit", () => {
    expect(hasExhaustedRetries(0)).toBe(false);
    expect(hasExhaustedRetries(DEFAULT_RETRY_POLICY.maxAttempts - 1)).toBe(false);
  });

  test("true once the attempt count reaches the limit", () => {
    expect(hasExhaustedRetries(DEFAULT_RETRY_POLICY.maxAttempts)).toBe(true);
    expect(hasExhaustedRetries(DEFAULT_RETRY_POLICY.maxAttempts + 5)).toBe(true);
  });
});
