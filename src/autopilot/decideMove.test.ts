import { describe, expect, test } from "vitest";
import { decideMove } from "./decideMove";
import { createGame, enqueueAvatarFood, setDirection, tick } from "../game/GameState";
import { DEFAULT_CONFIG, type BoardFood, type GameConfig, type GameState } from "../game/types";
import { availableVariants, buildCycleOrder, cycleIndex } from "./hamiltonian";

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

  test("takes an obvious one-turn shortcut on classic boards instead of continuing the zig-zag", () => {
    const wideCfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, maxAvatarFoods: 0 };
    const state: GameState = {
      ...createGame(wideCfg, () => 0),
      status: "playing",
      snake: [
        { x: 7, y: 5 },
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
        { x: 0, y: 5 },
        { x: 0, y: 6 },
        { x: 0, y: 7 },
        { x: 1, y: 7 },
        { x: 2, y: 7 },
        { x: 3, y: 7 },
        { x: 4, y: 7 },
        { x: 5, y: 7 },
        { x: 6, y: 7 },
        { x: 7, y: 7 },
        { x: 8, y: 7 },
        { x: 9, y: 7 },
        { x: 9, y: 6 },
      ],
      direction: "right",
      foods: [basicFood({ x: 4, y: 3 })],
    };
    expect(decideMove(state)).toBe("up");
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
  test(
    "wins or survives the vast majority of games at normal speed (no induced mistakes)",
    () => {
      // Unseeded RNG (food placement varies run to run), so a small sample
      // can swing well below the true win rate (measured ~80%) by chance
      // alone; 20 games per board size cuts that variance down without
      // running long enough to hit the default test timeout.
      let wins = 0;
      let total = 0;
      for (const [width, height] of [[6, 6], [8, 8], [10, 8]] as const) {
        for (let game = 0; game < 20; game++) {
          total++;
          if (playToEnd(width, height) === "win") wins++;
        }
      }
      expect(wins / total).toBeGreaterThan(0.65);
    },
    15000,
  );
});

function playConfigToEnd(config: Partial<GameConfig>): "win" | "loss" | "stall" {
  let state: GameState = { ...createGame({ ...DEFAULT_CONFIG, ...config }), status: "playing" };
  const cap = state.config.boardWidth * state.config.boardHeight * 80;
  for (let turn = 0; turn < cap; turn++) {
    state = tick(setDirection(state, decideMove(state)));
    if (state.status === "victory") return "win";
    if (state.status === "lost") return "loss";
  }
  return "stall";
}

describe("decideMove uses the same reliable cycle strategy on every open (wall-free) board", () => {
  test("full_food wins essentially every game (the cycle visits every cell)", () => {
    let wins = 0;
    const total = 6;
    for (let game = 0; game < total; game++) {
      if (playConfigToEnd({ boardWidth: 10, boardHeight: 8, gameMode: "full_food" }) === "win") wins++;
    }
    expect(wins / total).toBeGreaterThan(0.9);
  });

  test("colorMode 'map' on an open board terminates instead of wandering forever", () => {
    let terminated = 0;
    const total = 6;
    for (let game = 0; game < total; game++) {
      const result = playConfigToEnd({ boardWidth: 10, boardHeight: 8, colorMode: "map", mapTheme: "heart" });
      if (result !== "stall") terminated++;
    }
    expect(terminated / total).toBe(1);
  });

  test(
    "a large classic board (flag-map size) always terminates via its food goal",
    () => {
      let terminated = 0;
      const total = 5;
      for (let game = 0; game < total; game++) {
        if (playConfigToEnd({ boardWidth: 24, boardHeight: 16, gameMode: "classic" }) !== "stall") terminated++;
      }
      expect(terminated / total).toBe(1);
    },
    30000,
  );
});

describe("rounds with a food goal always finish (no more eternal rounds)", () => {
  test(
    "pudding almost always ends in a win or loss well before the tick cap, essentially never stalls",
    () => {
      // A tiny residual stall rate is possible (a food target briefly stuck
      // behind a dynamic wall right at the tick cap) but should be rare —
      // the original bug was pudding walls never being placed at all,
      // which made every round stall.
      let terminated = 0;
      const total = 12;
      for (let game = 0; game < total; game++) {
        if (playConfigToEnd({ boardWidth: 16, boardHeight: 12, gameMode: "pudding" }) !== "stall") terminated++;
      }
      expect(terminated / total).toBeGreaterThan(0.8);
    },
    30000,
  );

  test(
    "pudding wins a solid majority of the time (walls placed via #002's fix + junction-preferring spawn)",
    () => {
      let wins = 0;
      const total = 15;
      for (let game = 0; game < total; game++) {
        if (playConfigToEnd({ boardWidth: 16, boardHeight: 12, gameMode: "pudding" }) === "win") wins++;
      }
      expect(wins / total).toBeGreaterThan(0.6);
    },
    60000,
  );

  test(
    "maze_harvest wins a solid majority of the time (recursive-lookahead pathing, no stall loop)",
    () => {
      // A maze_harvest board is a spanning tree (no loops), which is a
      // genuinely harder graph to navigate safely than pudding's open floor
      // with a few dynamic walls — the win rate here is lower than pudding's
      // by nature of the topology, not an algorithm regression.
      let wins = 0;
      const total = 15;
      for (let game = 0; game < total; game++) {
        if (playConfigToEnd({ boardWidth: 18, boardHeight: 14, gameMode: "maze_harvest" }) === "win") wins++;
      }
      expect(wins / total).toBeGreaterThan(0.45);
    },
    60000,
  );
});

describe("cycle shortcut correctness", () => {
  test("mid-game shortcut: snake eats nearby food across a body-formed gap instead of following cycle all the way round", () => {
    // Board 10×8.  Snake covers most of the bottom rows in a U-shape so that
    // the head and food are on the same side of the U — a naive floodFill
    // from the head would see only the small open pocket, not the food's side,
    // and would reject the shortcut.  The fix trusts the cycle order instead.
    const w = 10;
    const h = 8;
    const baseCfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, maxAvatarFoods: 0 };
    const state: GameState = {
      ...createGame(baseCfg, () => 0),
      status: "playing",
      score: 10,
      // Snake fills rows 4-7 in a serpentine, head at (7,3) pointing right.
      snake: [
        { x: 7, y: 3 },
        { x: 6, y: 3 },
        { x: 5, y: 3 },
        { x: 4, y: 3 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 6, y: 4 },
        { x: 7, y: 4 },
        { x: 8, y: 4 },
        { x: 9, y: 4 },
        { x: 9, y: 5 },
        { x: 8, y: 5 },
        { x: 7, y: 5 },
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
        { x: 0, y: 5 },
        { x: 0, y: 6 },
        { x: 1, y: 6 },
        { x: 2, y: 6 },
        { x: 3, y: 6 },
      ],
      direction: "right",
      foods: [{ id: "f0", pos: { x: 9, y: 2 }, type: "apple_red", kind: "basic" }],
    };
    // fill ≈ 32/80 = 0.4 — well below the 0.88 endgame threshold
    const dir = decideMove(state);
    // The snake must move toward the food (right or up) rather than
    // blindly continuing the cycle which would go in the wrong direction.
    const head = state.snake[0]!;
    const food = state.foods[0]!.pos;
    const next = tick(setDirection(state, dir));
    const nextHead = next.snake[0]!;
    // After the move, the head must be closer to the food in at least one axis.
    const distBefore = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
    const distAfter = Math.abs(nextHead.x - food.x) + Math.abs(nextHead.y - food.y);
    expect(distAfter).toBeLessThan(distBefore);
  });

  test("endgame: snake follows cycle strictly and never skips empty cycle cells to grab food early", () => {
    // Run complete full_food games (fills the board 100%) and check that no
    // food-eating move skips empty cycle positions — which would force an extra
    // full loop to cover them before the game ends.
    const w = 6;
    const h = 4;
    const order = buildCycleOrder(w, h, availableVariants(w, h)[0]!);
    const n = w * h;

    let shortcutsOverEmptyCells = 0;
    let gamesRun = 0;

    for (let game = 0; game < 8; game++) {
      let state: GameState = {
        ...createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "full_food", maxAvatarFoods: 0 }),
        status: "playing",
      };
      gamesRun++;
      const cap = n * 10;
      for (let t = 0; t < cap && state.status === "playing"; t++) {
        const dir = decideMove(state);
        const head = state.snake[0]!;
        const dv = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[dir]!;
        const nextHead = { x: head.x + dv.x, y: head.y + dv.y };
        const prevLen = state.snake.length;
        state = tick(setDirection(state, dir));
        if (state.snake.length <= prevLen) continue;
        // Food was eaten. Check fill at the time of eating.
        const fillAtEat = prevLen / n;
        if (fillAtEat <= 0.88) continue; // only check endgame moves
        // Did the snake skip any empty cycle cells to reach this food?
        const headRank = cycleIndex(order, head, w);
        const foodRank = cycleIndex(order, nextHead, w);
        const forward = (foodRank - headRank + n) % n;
        const tailRank = cycleIndex(order, state.snake[state.snake.length - 1]!, w);
        const distToTail = (tailRank - headRank + n) % n;
        if (forward <= 1 || forward >= distToTail) continue; // normal step or tail jump
        // A shortcut happened — verify no empty cells were in the skipped positions.
        const snakeBody = new Set(state.snake.map((p) => `${p.x},${p.y}`));
        for (let rel = 1; rel < forward; rel++) {
          const absRank = (headRank + rel) % n;
          const linear = order[absRank]!;
          const cell = { x: linear % w, y: Math.floor(linear / w) };
          if (!snakeBody.has(`${cell.x},${cell.y}`)) {
            shortcutsOverEmptyCells++;
            break;
          }
        }
      }
    }

    expect(gamesRun).toBeGreaterThan(0);
    expect(shortcutsOverEmptyCells).toBe(0);
  });
});

describe("maze_race never ends on a chat avatar food, only the target", () => {
  test(
    "every simulated victory happens while eating the maze's target fruit, even with avatar foods injected throughout",
    () => {
      const width = 12;
      const height = 10;
      let victories = 0;
      let victoriesAtTarget = 0;
      for (let game = 0; game < 6; game++) {
        let state: GameState = {
          ...createGame({ ...DEFAULT_CONFIG, boardWidth: width, boardHeight: height, gameMode: "maze_race", maxAvatarFoods: 3 }),
          status: "playing",
        };
        const targetId = state.foods.find((food) => food.kind === "basic")!.id;
        const cap = width * height * 80;
        for (let turn = 0; turn < cap; turn++) {
          if (turn % 15 === 0) {
            state = enqueueAvatarFood(state, { id: `viewer-${game}-${turn}`, avatarUrl: "x", authorName: "x" });
          }
          const before = state;
          state = tick(setDirection(state, decideMove(state)));
          if (state.status === "victory") {
            victories++;
            const eatenId = before.foods.find(
              (food) => food.pos.x === state.snake[0]!.x && food.pos.y === state.snake[0]!.y,
            )?.id;
            if (eatenId === targetId) victoriesAtTarget++;
            break;
          }
          if (state.status !== "playing") break;
        }
      }
      expect(victories).toBeGreaterThan(0);
      expect(victoriesAtTarget).toBe(victories);
    },
    30000,
  );
});

