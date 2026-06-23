import { describe, test, expect } from "vitest";
import { hueForLength, lerpHue } from "./colorHue";

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

describe("lerpHue", () => {
  test("moves the current hue toward the target", () => {
    const next = lerpHue(0, 100, 0.5);
    expect(next).toBeCloseTo(50);
  });

  test("returns a value within [0,360)", () => {
    expect(lerpHue(350, 10, 0.5)).toBeGreaterThanOrEqual(0);
    expect(lerpHue(350, 10, 0.5)).toBeLessThan(360);
  });

  test("takes the SHORT way across the 360->0 seam (forward), not backward", () => {
    // From 350 toward 10: shortest path is +20 (forward through 360), not -340.
    // At t=0.5 we expect ~0 (i.e. 350 + 10), never sweeping down toward 180.
    const next = lerpHue(350, 10, 0.5);
    // halfway across a 20-degree forward arc starting at 350 => 360 => 0
    expect(next).toBeCloseTo(0, 0);
  });

  test("takes the short way backward across the seam too", () => {
    // From 10 toward 350: shortest is -20 (backward through 0), landing near 0.
    const next = lerpHue(10, 350, 0.5);
    expect(next).toBeCloseTo(0, 0);
  });

  test("with t=1 lands on the target", () => {
    expect(lerpHue(350, 10, 1)).toBeCloseTo(10);
  });
});
