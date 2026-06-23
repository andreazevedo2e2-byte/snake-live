import { describe, test, expect } from "vitest";
import { createSpeedMeter, addComment, decay, MIN_MULTIPLIER, MAX_MULTIPLIER } from "./SpeedMeter";

describe("SpeedMeter", () => {
  test("starts at the minimum multiplier", () => {
    const meter = createSpeedMeter();
    expect(meter.multiplier).toBe(MIN_MULTIPLIER);
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

  test("decay reduces the multiplier back toward the minimum over time", () => {
    let meter = createSpeedMeter();
    for (let i = 0; i < 10; i++) meter = addComment(meter);
    const charged = meter.multiplier;
    meter = decay(meter, 5);
    expect(meter.multiplier).toBeLessThan(charged);
  });

  test("decay never drops the multiplier below the minimum", () => {
    let meter = createSpeedMeter();
    meter = decay(meter, 1000);
    expect(meter.multiplier).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
  });
});
