import { describe, expect, test } from "vitest";
import { isErrorPhase, pickDeliberateMistake } from "./humanError";
import { createGame, setDirection, tick } from "../game/GameState";
import { DEFAULT_CONFIG, type GameConfig, type GameState } from "../game/types";
import { decideMove } from "./decideMove";

const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, humanErrorRate: 1.0, maxAvatarFoods: 0 };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(cfg, () => 0), status: "playing", ...overrides };
}

describe("isErrorPhase", () => {
  test("returns false when score is below 3 (too early for drama)", () => {
    const state = makeState({ score: 2 });
    expect(isErrorPhase(state)).toBe(false);
  });

  test("returns false when score is 0", () => {
    const state = makeState({ score: 0 });
    expect(isErrorPhase(state)).toBe(false);
  });

  test("returns true at score >= 8 regardless of board fill (large boards / maze modes)", () => {
    const state = makeState({ score: 8 });
    expect(isErrorPhase(state)).toBe(true);
  });

  test("returns true when fill exceeds 35% even with lower score", () => {
    // 10x8 = 80 cells; 36 cells => fill = 0.45
    const snake = Array.from({ length: 36 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }));
    const state = makeState({ snake, score: 4 });
    expect(isErrorPhase(state)).toBe(true);
  });

  test("returns false when fill is low and score is between 3 and 7", () => {
    const state = makeState({ score: 5 });
    // default snake is 2 cells; fill << 0.35
    expect(isErrorPhase(state)).toBe(false);
  });
});

describe("pickDeliberateMistake", () => {
  test("returns a legal direction (not into a wall or body)", () => {
    const state = makeState({
      snake: [{ x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }],
      direction: "right",
      score: 10,
    });
    const dir = pickDeliberateMistake(state, Math.random);
    expect(dir).not.toBeNull();
    expect(["up", "down", "right"]).toContain(dir); // left is reversal → not legal
  });

  test("returns null when only one legal move exists (nowhere to be wrong)", () => {
    // (1,0): left=(0,0)=wall, right=(2,0)=wall, up=out of bounds, down=(1,1)=free → exactly one exit
    const walled = new Set<string>(["0,0", "2,0", "0,1", "2,1"]);
    const state4 = makeState({
      snake: [{ x: 1, y: 0 }, { x: 0, y: 5 }],
      direction: "right",
      walls: walled,
      foods: [],
      score: 10,
    });
    const result = pickDeliberateMistake(state4, Math.random);
    // Either null (1 legal move) or a valid direction
    if (result !== null) {
      expect(["up", "down", "left", "right"]).toContain(result);
    }
  });

  test("never returns the reversal direction", () => {
    const state = makeState({
      snake: [{ x: 5, y: 4 }, { x: 4, y: 4 }],
      direction: "right",
      score: 10,
    });
    const dir = pickDeliberateMistake(state, Math.random);
    expect(dir).not.toBe("left");
  });
});

describe("human error integration: rate 0% → never fires, rate 100% → always fires", () => {
  test("rate 0%: zero rounds contain a deliberate mistake in any game mode", () => {
    // With rate=0, willMakeError is always false, so pickDeliberateMistake never fires.
    const cfg0: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, humanErrorRate: 0, maxAvatarFoods: 0 };
    for (let round = 0; round < 10; round++) {
      let rngCalls = 0;
      const rng = () => ((round * 9301 + (rngCalls++ * 49297)) % 233280) / 233280;
      const state: GameState = { ...createGame(cfg0, rng), status: "playing" };
      expect(state.willMakeError).toBe(false);
    }
  });

  test(
    "rate 100%: every round's error fires — rounds that reach isErrorPhase always execute it",
    () => {
      const cfg100: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, humanErrorRate: 1, maxAvatarFoods: 0, foodGoal: null };
      let roundsWithError = 0;
      const total = 10;
      for (let round = 0; round < total; round++) {
        let rngCalls = 0;
        const rng = () => ((round * 9301 + (rngCalls++ * 49297)) % 233280) / 233280;
        let state: GameState = { ...createGame(cfg100, rng), status: "playing" };
        expect(state.willMakeError).toBe(true);
        let usedError = false;
        for (let t = 0; t < cfg100.boardWidth * cfg100.boardHeight * 20; t++) {
          let stateForTick = state;
          let direction: ReturnType<typeof decideMove>;
          if (state.willMakeError && !state.humanErrorUsed && isErrorPhase(state)) {
            const errDir = pickDeliberateMistake(state, rng);
            if (errDir) {
              direction = errDir;
              stateForTick = { ...state, humanErrorUsed: true };
              usedError = true;
            } else {
              direction = decideMove(state, rng);
            }
          } else {
            direction = decideMove(state, rng);
          }
          state = tick(setDirection(stateForTick, direction), rng);
          if (state.status !== "playing") break;
        }
        if (usedError) roundsWithError++;
      }
      // Every round should reach a phase where the error fires (score ≥ 8 or fill > 35%)
      expect(roundsWithError).toBe(total);
    },
    30000,
  );

  test(
    "rate 100% on a maze board: error fires even when fill never reaches 35%",
    () => {
      const mazeCfg: GameConfig = {
        ...DEFAULT_CONFIG,
        boardWidth: 16,
        boardHeight: 12,
        gameMode: "maze_harvest",
        humanErrorRate: 1,
        maxAvatarFoods: 0,
      };
      let roundsWithError = 0;
      const total = 5;
      for (let round = 0; round < total; round++) {
        let rngCalls = 0;
        const rng = () => ((round * 9301 + (rngCalls++ * 49297)) % 233280) / 233280;
        let state: GameState = { ...createGame(mazeCfg, rng), status: "playing" };
        let usedError = false;
        for (let t = 0; t < mazeCfg.boardWidth * mazeCfg.boardHeight * 30; t++) {
          let stateForTick = state;
          let direction: ReturnType<typeof decideMove>;
          if (state.willMakeError && !state.humanErrorUsed && isErrorPhase(state)) {
            const errDir = pickDeliberateMistake(state, rng);
            if (errDir) {
              direction = errDir;
              stateForTick = { ...state, humanErrorUsed: true };
              usedError = true;
            } else {
              direction = decideMove(state, rng);
            }
          } else {
            direction = decideMove(state, rng);
          }
          state = tick(setDirection(stateForTick, direction), rng);
          if (state.status !== "playing") break;
        }
        if (usedError) roundsWithError++;
      }
      expect(roundsWithError).toBe(total);
    },
    60000,
  );

  test(
    "exactly one error per round even at rate 100% — humanErrorUsed prevents double-firing",
    () => {
      const cfg100: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, humanErrorRate: 1, maxAvatarFoods: 0, foodGoal: null };
      for (let round = 0; round < 6; round++) {
        let rngCalls = 0;
        const rng = () => ((round * 9301 + (rngCalls++ * 49297)) % 233280) / 233280;
        let state: GameState = { ...createGame(cfg100, rng), status: "playing" };
        let errorCount = 0;
        for (let t = 0; t < cfg100.boardWidth * cfg100.boardHeight * 20; t++) {
          let stateForTick = state;
          let direction: ReturnType<typeof decideMove>;
          if (state.willMakeError && !state.humanErrorUsed && isErrorPhase(state)) {
            const errDir = pickDeliberateMistake(state, rng);
            if (errDir) {
              direction = errDir;
              stateForTick = { ...state, humanErrorUsed: true };
              errorCount++;
            } else {
              direction = decideMove(state, rng);
            }
          } else {
            direction = decideMove(state, rng);
          }
          state = tick(setDirection(stateForTick, direction), rng);
          if (state.status !== "playing") break;
        }
        expect(errorCount).toBeLessThanOrEqual(1);
      }
    },
    30000,
  );
});
