import { describe, expect, test } from "vitest";
import { decideMove } from "./decideMove";
import { createGame, setDirection, tick } from "../game/GameState";
import { DEFAULT_CONFIG, type BoardFood, type GameConfig, type GameState } from "../game/types";

const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 10, maxAvatarFoods: 8 };

function basicFood(pos: { x: number; y: number }, id = "food-0"): BoardFood {
  return { id, pos, type: "apple_red", kind: "basic" };
}

function withState(overrides: Partial<GameState>): GameState {
  const base = createGame(cfg, () => 0);
  return { ...base, status: "playing", ...overrides };
}

describe("decideMove natural early play", () => {
  test("eats food sitting right next to the head instead of passing it by", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      foods: [basicFood({ x: 3, y: 2 })],
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
      foods: [basicFood({ x: 6, y: 2 })],
    });
    const before = Math.abs(2 - 6);
    const next = tick(setDirection(state, decideMove(state)));
    const head = next.snake[0]!;
    const after = Math.abs(head.x - 6);
    expect(after).toBeLessThan(before);
  });

  test("never reverses into its own neck", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      foods: [basicFood({ x: 0, y: 2 })],
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
      foods: [basicFood({ x: 0, y: 0 })],
    });
    const dir = decideMove(state);
    const next = tick(setDirection(state, dir));
    expect(next.status).not.toBe("lost");
  });

  test("eats food sitting right next to the head on a non-square board", () => {
    const wideCfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, maxAvatarFoods: 0 };
    const state: GameState = {
      ...createGame(wideCfg, () => 0),
      status: "playing",
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      foods: [basicFood({ x: 3, y: 2 })],
    };
    expect(decideMove(state)).toBe("right");
  });

  test("returns a non-deadly move on a non-square board with distant food", () => {
    const wideCfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, maxAvatarFoods: 0 };
    const state: GameState = {
      ...createGame(wideCfg, () => 0),
      status: "playing",
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      foods: [basicFood({ x: 8, y: 2 })],
    };
    const dir = decideMove(state);
    const next = tick(setDirection(state, dir));
    expect(next.status).not.toBe("lost");
  });

  test("respects maze walls and chooses the open lane toward food", () => {
    const state = withState({
      snake: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      direction: "right",
      foods: [basicFood({ x: 1, y: 3 })],
      walls: new Set(["2,1", "2,2", "2,3", "1,0"]),
    });
    expect(decideMove(state)).toBe("down");
  });
});

describe("decideMove heads straight for food instead of circling it", () => {
  test("walks directly toward food in an open lane rather than detouring around it", () => {
    const state = withState({
      snake: [
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ],
      direction: "right",
      foods: [basicFood({ x: 5, y: 4 })],
    });
    expect(decideMove(state)).toBe("right");
  });

  test("steps onto food the tick before reaching it instead of turning away", () => {
    const state = withState({
      snake: [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
      ],
      direction: "right",
      foods: [basicFood({ x: 5, y: 4 })],
    });
    expect(decideMove(state)).toBe("right");
  });

  test("different food placements produce different move sequences (no fixed pattern)", () => {
    function moveSequence(seed: number): string {
      let rngCalls = 0;
      const rng = () => {
        rngCalls++;
        return ((seed * 9301 + rngCalls * 49297) % 233280) / 233280;
      };
      let state: GameState = { ...createGame(cfg, rng), status: "playing" };
      const moves: string[] = [];
      for (let turn = 0; turn < 40; turn++) {
        const dir = decideMove(state);
        moves.push(dir);
        state = tick(setDirection(state, dir));
        if (state.status !== "playing") state = { ...state, status: "playing" };
      }
      return moves.join(",");
    }

    expect(moveSequence(1)).not.toBe(moveSequence(2));
  });
});

function playToEnd(boardWidth: number, boardHeight: number): "win" | "loss" | "stall" {
  let state: GameState = {
    ...createGame({ ...DEFAULT_CONFIG, boardWidth, boardHeight, maxAvatarFoods: 0 }),
    status: "playing",
  };
  const cap = boardWidth * boardHeight * 80;
  for (let turn = 0; turn < cap; turn++) {
    state = tick(setDirection(state, decideMove(state)));
    if (state.status === "victory") return "win";
    if (state.status === "lost") return "loss";
  }
  return "stall";
}

describe("decideMove survives well on open boards", () => {
  test("wins or survives the vast majority of games at normal speed (no induced mistakes)", () => {
    let wins = 0;
    let total = 0;
    for (const [width, height] of [[6, 6], [8, 8], [10, 8]] as const) {
      for (let game = 0; game < 8; game++) {
        total++;
        if (playToEnd(width, height) === "win") wins++;
      }
    }
    expect(wins / total).toBeGreaterThan(0.75);
  });
});

describe("decideMove speed handling", () => {
  test("never injects a random mistake at normal speed (<=3x)", () => {
    const state = withState({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      direction: "right",
      foods: [basicFood({ x: 6, y: 2 })],
    });
    const dir = decideMove(state, 3, () => 0);
    expect(dir).toBe("right");
  });

  test("does not inject random per-tick mistakes at high speed", () => {
    const state = withState({
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      direction: "right",
      foods: [basicFood({ x: 9, y: 5 })],
    });
    const dir = decideMove(state, 6, () => 0);
    expect(dir).toBe("right");
  });
});
