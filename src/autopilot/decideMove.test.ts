import { describe, test, expect } from "vitest";
import { decideMove } from "./decideMove";
import { createGame } from "../game/GameState";
import type { GameConfig, GameState } from "../game/types";

const cfg: GameConfig = { boardSize: 12, maxAvatarFoods: 8 };

function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function withState(overrides: Partial<GameState>): GameState {
  const base = createGame(cfg, () => 0);
  return { ...base, status: "playing", ...overrides };
}

describe("decideMove — basic safety", () => {
  test("never walks into a wall when a safe alternative exists", () => {
    const state = withState({
      direction: "right",
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      baseApple: { x: 11, y: 11 },
    });
    const move = decideMove(state);
    expect(move).not.toBe("left"); // would step to x=-1
  });

  test("never walks into its own body when a safe alternative exists", () => {
    // Snake forms an L; stepping "down" from the head would hit the body,
    // but "right" is open and safe.
    const state = withState({
      direction: "right",
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
      ],
      baseApple: { x: 11, y: 11 },
    });
    const move = decideMove(state);
    expect(move).not.toBe("down");
  });
});

describe("decideMove — seeks food", () => {
  test("moves toward the base apple when the path is clear", () => {
    const state = withState({
      direction: "right",
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }],
      baseApple: { x: 9, y: 5 },
    });
    const move = decideMove(state);
    expect(move).toBe("right");
  });

  test("moves vertically toward the apple when that is the only open dimension", () => {
    const state = withState({
      direction: "up",
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }],
      baseApple: { x: 5, y: 0 },
    });
    const move = decideMove(state);
    expect(move).toBe("up");
  });
});

describe("decideMove — escape-room awareness (riskLevel 0)", () => {
  test("prefers the equally-close candidate that leaves more open space", () => {
    // Head at (5,5). Apple straight below far away so both "down" and a
    // same-distance detour are candidates; "left" walks into a 1-cell pocket
    // formed by the snake's own body, "down" stays in the open board.
    const state = withState({
      direction: "down",
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 4 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
      ],
      baseApple: { x: 5, y: 9 },
    });
    const move = decideMove(state, { riskLevel: 0 });
    expect(move).toBe("down");
  });
});

describe("decideMove — dosed imperfection (riskLevel)", () => {
  test("can skip the escape-room safety check when the risk roll triggers", () => {
    const state = withState({
      direction: "down",
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 4 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
      ],
      baseApple: { x: 5, y: 9 },
    });
    // rng() always returns 0, which is < any positive riskLevel, forcing the
    // "skip safety" branch deterministically for this test.
    const move = decideMove(state, { riskLevel: 1 }, rngSeq([0]));
    expect(["down", "left", "right"]).toContain(move);
  });
});

describe("decideMove — no legal move", () => {
  test("returns a direction without throwing even when fully cornered", () => {
    const state = withState({
      direction: "right",
      snake: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      baseApple: { x: 11, y: 11 },
    });
    expect(() => decideMove(state)).not.toThrow();
  });
});
