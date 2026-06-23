import { describe, expect, test } from "vitest";
import { decideMove } from "./decideMove";
import { createGame, setDirection, tick } from "../game/GameState";
import type { GameConfig, GameState } from "../game/types";

const cfg: GameConfig = { boardSize: 10, maxAvatarFoods: 8 };

function withState(overrides: Partial<GameState>): GameState {
  const base = createGame(cfg, () => 0);
  return { ...base, status: "playing", ...overrides };
}

describe("decideMove — natural early play", () => {
  test("eats food sitting right next to the head instead of passing it by", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      baseApple: { x: 3, y: 2 }, // directly to the right of the head
    });
    expect(decideMove(state)).toBe("right");
  });

  test("heads toward food that is a few cells away on an open board", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      baseApple: { x: 6, y: 2 },
    });
    // The move must strictly reduce the Manhattan distance to the food.
    const before = Math.abs(2 - 6) + Math.abs(2 - 2);
    const next = tick(setDirection(state, decideMove(state)));
    const head = next.snake[0]!;
    const after = Math.abs(head.x - 6) + Math.abs(head.y - 2);
    expect(after).toBeLessThan(before);
  });

  test("never reverses into its own neck", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      baseApple: { x: 0, y: 2 },
    });
    expect(decideMove(state)).not.toBe("left");
  });

  test("returns a non-deadly move whenever any safe move exists", () => {
    const state = withState({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
      ],
      direction: "up",
      baseApple: { x: 0, y: 0 },
    });
    const dir = decideMove(state);
    const next = tick(setDirection(state, dir));
    expect(next.status).not.toBe("lost");
  });
});

/** Plays a full no-chat game to completion, autopilot driving every tick. */
function playToEnd(boardSize: number): "win" | "loss" | "stall" {
  let state: GameState = {
    ...createGame({ boardSize, maxAvatarFoods: 0 }),
    status: "playing",
  };
  const cap = boardSize * boardSize * 80;
  for (let t = 0; t < cap; t++) {
    state = tick(setDirection(state, decideMove(state)));
    if (state.status === "victory") return "win";
    if (state.status === "lost") return "loss";
  }
  return "stall";
}

describe("decideMove — guaranteed completion", () => {
  test("fills the board and wins every game across several board sizes", () => {
    for (const size of [6, 8, 10]) {
      for (let game = 0; game < 6; game++) {
        expect(playToEnd(size)).toBe("win");
      }
    }
  });
});
