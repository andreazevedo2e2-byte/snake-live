import { describe, test, expect } from "vitest";
import { hueForLength } from "./colorHue";

describe("hueForLength", () => {
  test("returns 0 for the starting length", () => {
    expect(hueForLength(2, 2)).toBe(0);
  });

  test("increases as the snake grows", () => {
    const a = hueForLength(2, 2);
    const b = hueForLength(5, 2);
    expect(b).toBeGreaterThan(a);
  });

  test("wraps around the 0-360 hue circle", () => {
    const hue = hueForLength(2 + 40, 2);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  test("is deterministic for the same length", () => {
    expect(hueForLength(7, 2)).toBe(hueForLength(7, 2));
  });
});
