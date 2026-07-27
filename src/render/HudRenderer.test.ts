import { describe, expect, test } from "vitest";
import { shallowEqual } from "./HudRenderer";

// HudRenderer itself instantiates PixiJS Text/Graphics at construction time,
// which need a canvas context this Node test environment doesn't provide —
// see TextureCache.test.ts/leaderboardTextures.test.ts for the existing
// pattern of only unit-testing the pure logic extracted out of the render
// layer. shallowEqual is exactly that extraction for #112's dirty-check:
// setSpeed/setCounters/setScene each compare against it before touching any
// PixiJS object, so proving it here proves the redraw-skip decision is
// correct independent of the rendering itself.
describe("shallowEqual (#112 dirty-check)", () => {
  test("true for two objects with identical primitive fields", () => {
    expect(shallowEqual({ a: 1, b: "x", c: true }, { a: 1, b: "x", c: true })).toBe(true);
  });

  test("false when any field differs", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 2, b: "x" })).toBe(false);
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(false);
  });

  test("false when a field becomes null vs a real value", () => {
    expect(shallowEqual({ a: 1, foodGoal: null as number | null }, { a: 1, foodGoal: 10 })).toBe(false);
  });

  test("true for two separate but value-identical scene-shaped objects", () => {
    const a = { status: "playing", coverage: 0.42, speed: 2.5, score: 7, foodGoal: null as number | null };
    const b = { status: "playing", coverage: 0.42, speed: 2.5, score: 7, foodGoal: null as number | null };
    expect(shallowEqual(a, b)).toBe(true);
  });

  test("false when only one out of many fields changes (the common per-tick case)", () => {
    const a = { status: "playing", coverage: 0.42, speed: 2.5, score: 7, foodGoal: null as number | null };
    const b = { ...a, score: 8 };
    expect(shallowEqual(a, b)).toBe(false);
  });
});
