import { describe, expect, test } from "vitest";
import { hasStalledTooLong, WATCHDOG_ABSOLUTE_CAP_MS, WATCHDOG_MS, watchdogThresholdMs } from "./watchdog";

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

describe("watchdogThresholdMs", () => {
  test("uses the base WATCHDOG_MS for the small classic reference board (10x8)", () => {
    expect(watchdogThresholdMs({ boardWidth: 10, boardHeight: 8, gameMode: "classic" })).toBe(WATCHDOG_MS);
  });

  test("scales up proportionally for a larger open board", () => {
    // 16x12 = 192 cells vs the 10x8 = 80-cell reference: 2.4x the cells.
    const threshold = watchdogThresholdMs({ boardWidth: 16, boardHeight: 12, gameMode: "classic" });
    expect(threshold).toBeGreaterThan(WATCHDOG_MS * 2);
    expect(threshold).toBeLessThan(WATCHDOG_ABSOLUTE_CAP_MS);
  });

  test("gives maze modes extra time over an open board of the same size", () => {
    const openThreshold = watchdogThresholdMs({ boardWidth: 16, boardHeight: 12, gameMode: "classic" });
    const mazeThreshold = watchdogThresholdMs({ boardWidth: 16, boardHeight: 12, gameMode: "maze_race" });
    expect(mazeThreshold).toBeGreaterThan(openThreshold);
  });

  test("never exceeds the absolute cap even on a huge maze board", () => {
    const threshold = watchdogThresholdMs({ boardWidth: 36, boardHeight: 24, gameMode: "maze_harvest" });
    expect(threshold).toBe(WATCHDOG_ABSOLUTE_CAP_MS);
  });

  test("a large maze_race board never loses a round that is still making progress", () => {
    // The scenario #104 exists for: a big walled board where the snake is
    // legitimately still searching, well past the old fixed 90s.
    const config = { boardWidth: 36, boardHeight: 24, gameMode: "maze_race" as const };
    const threshold = watchdogThresholdMs(config);
    const lastScoreAt = 0;
    expect(hasStalledTooLong(lastScoreAt, 150_000, threshold)).toBe(false);
  });

  test("a genuinely stalled round (no progress past the scaled threshold) still triggers", () => {
    const config = { boardWidth: 36, boardHeight: 24, gameMode: "maze_race" as const };
    const threshold = watchdogThresholdMs(config);
    const lastScoreAt = 0;
    expect(hasStalledTooLong(lastScoreAt, threshold + 1, threshold)).toBe(true);
  });

  test("classic/full_food on a small board keeps the original 90s behavior", () => {
    expect(watchdogThresholdMs({ boardWidth: 10, boardHeight: 8, gameMode: "full_food" })).toBe(WATCHDOG_MS);
  });
});
