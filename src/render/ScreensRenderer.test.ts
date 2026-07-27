import { describe, expect, test } from "vitest";
import { animateVictoryContext, type VictoryContext } from "./ScreensRenderer";

const FINAL: VictoryContext = {
  gameMode: "maze_harvest",
  score: 50,
  foodGoal: 50,
  coverage: 0.8,
  timer: "01:23.456",
};

describe("animateVictoryContext (#115d — score count-up)", () => {
  test("starts the count at 0", () => {
    const frame = animateVictoryContext(FINAL, 0, 700);
    expect(frame.score).toBe(0);
    expect(frame.coverage).toBe(0);
  });

  test("climbs monotonically toward the real score during the window", () => {
    let prev = -1;
    for (const elapsed of [0, 100, 200, 350, 500, 650]) {
      const frame = animateVictoryContext(FINAL, elapsed, 700);
      expect(frame.score).toBeGreaterThanOrEqual(prev);
      expect(frame.score).toBeLessThanOrEqual(FINAL.score);
      prev = frame.score;
    }
  });

  test("lands exactly on the real numbers once the window has elapsed", () => {
    expect(animateVictoryContext(FINAL, 700, 700)).toEqual(FINAL);
    expect(animateVictoryContext(FINAL, 10_000, 700)).toEqual(FINAL);
  });

  test("only score and coverage animate — mode, goal and timer stay fixed", () => {
    const frame = animateVictoryContext(FINAL, 350, 700);
    expect(frame.gameMode).toBe(FINAL.gameMode);
    expect(frame.foodGoal).toBe(FINAL.foodGoal);
    expect(frame.timer).toBe(FINAL.timer);
  });

  test("treats a negative elapsed time (clock skew) as the start of the count", () => {
    const frame = animateVictoryContext(FINAL, -50, 700);
    expect(frame.score).toBe(0);
  });
});
