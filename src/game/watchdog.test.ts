import { describe, expect, test } from "vitest";
import { hasStalledTooLong, WATCHDOG_MS } from "./watchdog";

describe("hasStalledTooLong", () => {
  test("does not trigger right after scoring", () => {
    const lastScoreAt = 10_000;
    expect(hasStalledTooLong(lastScoreAt, lastScoreAt + 1000)).toBe(false);
  });

  test("does not trigger just under the threshold", () => {
    const lastScoreAt = 0;
    expect(hasStalledTooLong(lastScoreAt, WATCHDOG_MS - 1)).toBe(false);
  });

  test("triggers once the threshold is exceeded", () => {
    const lastScoreAt = 0;
    expect(hasStalledTooLong(lastScoreAt, WATCHDOG_MS + 1)).toBe(true);
  });

  test("respects a custom threshold (accelerated clock for testing)", () => {
    const lastScoreAt = 0;
    expect(hasStalledTooLong(lastScoreAt, 1500, 1000)).toBe(true);
    expect(hasStalledTooLong(lastScoreAt, 500, 1000)).toBe(false);
  });
});
