import { describe, test, expect } from "vitest";
import { createSpeedMeter, addComment, decay, cappedEffectiveSpeed, MIN_MULTIPLIER, MAX_MULTIPLIER, MAX_EFFECTIVE_SPEED } from "./SpeedMeter";

describe("SpeedMeter", () => {
  test("starts at the minimum multiplier", () => {
    const meter = createSpeedMeter();
    expect(meter.multiplier).toBe(MIN_MULTIPLIER);
  });

  test("can start from a configured multiplier", () => {
    const meter = createSpeedMeter(6);
    expect(meter.multiplier).toBe(MAX_MULTIPLIER);
  });

  test("a comment increases the multiplier", () => {
    const meter = createSpeedMeter();
    const next = addComment(meter);
    expect(next.multiplier).toBeGreaterThan(meter.multiplier);
  });

  test("multiplier never exceeds the maximum, however many comments arrive", () => {
    let meter = createSpeedMeter();
    for (let i = 0; i < 200; i++) meter = addComment(meter);
    expect(meter.multiplier).toBeLessThanOrEqual(MAX_MULTIPLIER);
  });

  test("decay keeps the multiplier stable during the current round", () => {
    let meter = createSpeedMeter();
    for (let i = 0; i < 10; i++) meter = addComment(meter);
    const charged = meter.multiplier;
    meter = decay(meter, 5);
    expect(meter.multiplier).toBe(charged);
  });

  test("locked meters ignore new comment boosts", () => {
    const meter = createSpeedMeter(3);
    const next = addComment(meter, true);
    expect(next.multiplier).toBe(3);
  });

  test("decay never drops the multiplier below the minimum", () => {
    let meter = createSpeedMeter();
    meter = decay(meter, 1000);
    expect(meter.multiplier).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
  });
});

describe("cappedEffectiveSpeed", () => {
  test("chat max (6×) × base 1.0 stays at 6", () => {
    expect(cappedEffectiveSpeed(MAX_MULTIPLIER, 1.0)).toBe(6);
  });

  test("chat max (6×) × base 2.4 is capped at MAX_EFFECTIVE_SPEED (6), not 14.4", () => {
    expect(cappedEffectiveSpeed(MAX_MULTIPLIER, 2.4)).toBe(MAX_EFFECTIVE_SPEED);
  });

  test("below the ceiling the product is returned as-is", () => {
    expect(cappedEffectiveSpeed(2, 1.5)).toBe(3);
  });

  test("tick interval at capped speed never goes below BASE_TICK_MS / MAX_EFFECTIVE_SPEED", () => {
    const BASE_TICK_MS = 420;
    const minInterval = BASE_TICK_MS / MAX_EFFECTIVE_SPEED;
    const worstCaseInterval = BASE_TICK_MS / cappedEffectiveSpeed(MAX_MULTIPLIER, 99);
    expect(worstCaseInterval).toBeGreaterThanOrEqual(minInterval);
  });
});
