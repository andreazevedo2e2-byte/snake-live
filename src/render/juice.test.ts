import { describe, expect, test } from "vitest";
import {
  CONFETTI_COUNT,
  CONFETTI_LIFETIME_MS,
  confettiFrame,
  FLOAT_TEXT_MS,
  floatingTextFrame,
  HEAD_SQUASH_MS,
  headSquashScale,
  SHAKE_DURATION_MS,
  shakeOffset,
  SPAWN_POP_MS,
  spawnConfetti,
  spawnPopScale,
} from "./juice";

describe("shakeOffset (eat screen-shake)", () => {
  test("shakes within amplitude during the window and settles to exactly zero after", () => {
    const mid = shakeOffset(SHAKE_DURATION_MS / 4);
    expect(Math.hypot(mid.x, mid.y)).toBeGreaterThan(0);
    expect(Math.abs(mid.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(mid.y)).toBeLessThanOrEqual(5);
    expect(shakeOffset(SHAKE_DURATION_MS)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(SHAKE_DURATION_MS * 10)).toEqual({ x: 0, y: 0 });
  });

  test("returns zero for a negative elapsed time (never shakes before an eat)", () => {
    expect(shakeOffset(-100)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(Number.NEGATIVE_INFINITY)).toEqual({ x: 0, y: 0 });
  });

  test("decays: shake near the end is smaller than at the start", () => {
    const early = shakeOffset(10, 3);
    const late = shakeOffset(SHAKE_DURATION_MS - 10, 3);
    expect(Math.hypot(late.x, late.y)).toBeLessThan(Math.hypot(early.x, early.y));
  });
});

describe("spawnPopScale (food pop-in)", () => {
  test("starts at 0, overshoots past 1 mid-way, lands exactly on 1", () => {
    expect(spawnPopScale(0)).toBeCloseTo(0, 10);
    const overshoot = Math.max(...[0.5, 0.6, 0.7, 0.8].map((t) => spawnPopScale(SPAWN_POP_MS * t)));
    expect(overshoot).toBeGreaterThan(1);
    expect(spawnPopScale(SPAWN_POP_MS)).toBe(1);
    expect(spawnPopScale(SPAWN_POP_MS * 100)).toBe(1);
  });
});

describe("headSquashScale (gulp)", () => {
  test("bulges above 1 during the window, exactly 1 outside it", () => {
    expect(headSquashScale(HEAD_SQUASH_MS / 2)).toBeCloseTo(1.35, 2);
    expect(headSquashScale(-1)).toBe(1);
    expect(headSquashScale(HEAD_SQUASH_MS)).toBe(1);
    expect(headSquashScale(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe("floatingTextFrame (+1)", () => {
  test("rises and fades over the window, null outside it", () => {
    const early = floatingTextFrame(FLOAT_TEXT_MS * 0.1)!;
    const late = floatingTextFrame(FLOAT_TEXT_MS * 0.9)!;
    expect(late.dy).toBeLessThan(early.dy); // more negative = higher up
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(floatingTextFrame(-5)).toBeNull();
    expect(floatingTextFrame(FLOAT_TEXT_MS)).toBeNull();
  });
});

describe("confetti (victory)", () => {
  test("spawns the full count, launching upward", () => {
    const pieces = spawnConfetti(100, 50, 200, 1000, () => 0.5);
    expect(pieces.length).toBe(CONFETTI_COUNT);
    for (const piece of pieces) {
      expect(piece.vy).toBeLessThan(0); // negative vy = upward
      expect(piece.startedAt).toBe(1000);
    }
  });

  test("gravity brings a piece back down over its lifetime", () => {
    const piece = spawnConfetti(0, 0, 200, 0, () => 0.5)[0]!;
    const early = confettiFrame(piece, CONFETTI_LIFETIME_MS * 0.1, 800)!;
    const late = confettiFrame(piece, CONFETTI_LIFETIME_MS * 0.95, 800)!;
    expect(late.y).toBeGreaterThan(early.y);
  });

  test("fades out near the end of life and expires to null", () => {
    const piece = spawnConfetti(0, 0, 200, 0, () => 0.5)[0]!;
    expect(confettiFrame(piece, CONFETTI_LIFETIME_MS * 0.5, 800)!.alpha).toBe(1);
    expect(confettiFrame(piece, CONFETTI_LIFETIME_MS * 0.9, 800)!.alpha).toBeLessThan(1);
    expect(confettiFrame(piece, CONFETTI_LIFETIME_MS, 800)).toBeNull();
  });
});
