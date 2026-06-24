import { describe, test, expect } from "vitest";
import { createSpeedMeter, addComment, decay, MIN_MULTIPLIER, MAX_MULTIPLIER } from "./SpeedMeter";

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
