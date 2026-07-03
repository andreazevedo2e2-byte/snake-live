import { describe, expect, test } from "vitest";
import { createGame, enqueueAvatarFood, setDirection, tick } from "./GameState";
import { DEFAULT_CONFIG, type BoardFood, type GameConfig } from "./types";

const smallConfig: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 8 };

function rngSeq(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

function basicFood(pos: { x: number; y: number }, id = "food-0"): BoardFood {
  return { id, pos, type: "apple_red", kind: "basic" };
}

describe("createGame", () => {
  test("starts with a snake of length 2, status start, and at least one food", () => {
    const state = createGame(smallConfig);
    expect(state.snake.length).toBe(2);
    expect(state.status).toBe("start");
    expect(state.foods.length).toBeGreaterThan(0);
    expect(state.score).toBe(0);
  });

  test("snake starts fully inside the board", () => {
    const state = createGame(smallConfig);
    for (const seg of state.snake) {
      expect(seg.x).toBeGreaterThanOrEqual(0);
      expect(seg.x).toBeLessThan(smallConfig.boardWidth);
      expect(seg.y).toBeGreaterThanOrEqual(0);
      expect(seg.y).toBeLessThan(smallConfig.boardHeight);
    }
  });
});

describe("food goal resolution", () => {
  test("small classic board has no goal (wins by filling the board)", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, gameMode: "classic" });
    expect(state.config.foodGoal).toBeNull();
  });

  test("large classic board (e.g. a flag map) gets a proportional food goal", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 24, boardHeight: 16, gameMode: "classic" });
    expect(state.config.foodGoal).not.toBeNull();
    expect(state.config.foodGoal!).toBeGreaterThan(0);
    expect(state.config.foodGoal!).toBeLessThan(24 * 16);
  });

  test("maze_harvest gets a proportional food goal", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 18, boardHeight: 14, gameMode: "maze_harvest" });
    expect(state.config.foodGoal).not.toBeNull();
    expect(state.config.foodGoal!).toBeGreaterThan(0);
  });

  test("pudding gets a proportional food goal", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 16, boardHeight: 12, gameMode: "pudding" });
    expect(state.config.foodGoal).not.toBeNull();
    expect(state.config.foodGoal!).toBeGreaterThan(0);
  });

  test("maze_race has no score goal (wins on the target fruit instead)", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 18, boardHeight: 14, gameMode: "maze_race" });
    expect(state.config.foodGoal).toBeNull();
  });

  test("an explicitly provided foodGoal is respected instead of the computed default", () => {
    const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 24, boardHeight: 16, gameMode: "classic", foodGoal: 42 });
    expect(state.config.foodGoal).toBe(42);
  });
});

describe("tick victory by food goal", () => {
  test("reaching the food goal wins the round even though the board is far from full", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 24, boardHeight: 16, gameMode: "classic", foodGoal: 3 };
    let state = createGame(cfg, rngSeq([0]));
    const head = state.snake[0]!;
    state = { ...state, status: "playing", direction: "right", score: 2, foods: [basicFood({ x: head.x + 1, y: head.y })] };
    const next = tick(state, rngSeq([0]));
    expect(next.status).toBe("victory");
    expect(next.score).toBe(3);
  });

  test("falling short of the food goal keeps the round playing", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 24, boardHeight: 16, gameMode: "classic", foodGoal: 10 };
    let state = createGame(cfg, rngSeq([0]));
    const head = state.snake[0]!;
    state = { ...state, status: "playing", direction: "right", score: 2, foods: [basicFood({ x: head.x + 1, y: head.y })] };
    const next = tick(state, rngSeq([0]));
    expect(next.status).toBe("playing");
    expect(next.score).toBe(3);
  });
});

describe("setDirection", () => {
  test("ignores a 180-degree reversal when snake length > 1", () => {
    let state = createGame(smallConfig);
    state = { ...state, status: "playing", direction: "right" };
    const next = setDirection(state, "left");
    expect(next.pendingDirection).toBeNull();
  });

  test("accepts a perpendicular direction", () => {
    let state = createGame(smallConfig);
    state = { ...state, status: "playing", direction: "right" };
    const next = setDirection(state, "up");
    expect(next.pendingDirection).toBe("up");
  });
});

describe("tick movement", () => {
  test("moving normally advances head and removes tail (no growth)", () => {
    let state = createGame(smallConfig, rngSeq([0.99]));
    state = { ...state, status: "playing", direction: "right", foods: [basicFood({ x: 0, y: 0 })] };
    const before = state.snake[0]!;
    const next = tick(state);
    expect(next.snake.length).toBe(state.snake.length);
    expect(next.snake[0]).toEqual({ x: before.x + 1, y: before.y });
  });

  test("grows the snake by 1, increments score, and respawns one basic food in classic mode", () => {
    let state = createGame(smallConfig, rngSeq([0.5]));
    const head = state.snake[0]!;
    state = {
      ...state,
      status: "playing",
      direction: "right",
      foods: [basicFood({ x: head.x + 1, y: head.y })],
    };
    const lengthBefore = state.snake.length;
    const next = tick(state, rngSeq([0.25]));
    expect(next.snake.length).toBe(lengthBefore + 1);
    expect(next.score).toBe(1);
    expect(next.foods.some((food) => food.kind === "basic")).toBe(true);
  });
});

describe("tick collisions", () => {
  test("hitting the wall ends the game as lost", () => {
    let state = createGame(smallConfig);
    state = {
      ...state,
      status: "playing",
      direction: "left",
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      foods: [basicFood({ x: 10, y: 10 })],
    };
    const next = tick(state);
    expect(next.status).toBe("lost");
  });

  test("hitting its own body ends the game as lost", () => {
    let state = createGame(smallConfig);
    state = {
      ...state,
      status: "playing",
      direction: "right",
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      foods: [basicFood({ x: 0, y: 0 })],
    };
    const next = tick(state);
    expect(next.status).toBe("lost");
  });
});

describe("tick victory", () => {
  test("filling the entire board ends the game as victory", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 2, boardHeight: 2, maxAvatarFoods: 8 };
    let state = createGame(cfg);
    state = {
      ...state,
      status: "playing",
      direction: "down",
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      foods: [basicFood({ x: 0, y: 1 })],
    };
    const next = tick(state);
    expect(next.status).toBe("victory");
  });

  test("maze race wins as soon as the target fruit is reached", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, gameMode: "maze_race" };
    let state = createGame(cfg);
    const head = state.snake[0]!;
    state = {
      ...state,
      status: "playing",
      direction: "right",
      foods: [basicFood({ x: head.x + 1, y: head.y })],
      walls: new Set(["5,4", "5,5"]),
    };
    const next = tick(state);
    expect(next.status).toBe("victory");
    expect(next.score).toBe(1);
  });

  test("maze race does NOT win when a chat avatar food is eaten instead of the target", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, gameMode: "maze_race", maxAvatarFoods: 3 };
    let state = createGame(cfg);
    const head = state.snake[0]!;
    // Push the real target fruit far away, and place a viewer's avatar food
    // directly in the snake's path — eating it should score but not end the
    // round; only the target fruit (unaffected here) may trigger victory.
    state = {
      ...state,
      status: "playing",
      direction: "right",
      foods: [
        { ...state.foods[0]!, pos: { x: 9, y: 7 } },
        { id: "viewer-1", pos: { x: head.x + 1, y: head.y }, type: "apple_red", kind: "avatar", avatarUrl: "x", authorName: "x" },
      ],
    };
    const next = tick(state);
    expect(next.status).toBe("playing");
    expect(next.score).toBe(1);
    expect(next.foods.some((food) => food.id === "viewer-1")).toBe(false);
  });
});

describe("avatar foods", () => {
  test("adds avatar food directly to the board while under the limit", () => {
    let state = createGame({ ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 2 }, rngSeq([0.1, 0.2]));
    state = { ...state, status: "playing" };
    const next = enqueueAvatarFood(state, {
      id: "viewer-1",
      avatarUrl: "https://example.com/a.png",
      authorName: "Ana",
    });
    expect(next.foods.filter((food) => food.kind === "avatar").length).toBe(1);
    expect(next.foodQueue.length).toBe(0);
  });

  test("never spawns avatar food on an unreachable cell, even with walls carving off a pocket", () => {
    // A 5x5 board where the whole right-hand column (x=4) is sealed off from
    // the snake by a solid wall at x=3, for every y. Spawn logic that doesn't
    // check reachability (e.g. plain randomEmptyCell scanning x then y) puts
    // the unreachable x=4 cells at the end of its candidate list, so a high
    // rng roll exposes the bug deterministically.
    const walls = new Set<string>();
    for (let y = 0; y < 5; y++) walls.add(`3,${y}`);
    let state = createGame({ ...DEFAULT_CONFIG, boardWidth: 5, boardHeight: 5, maxAvatarFoods: 8 }, rngSeq([0]));
    state = {
      ...state,
      status: "playing",
      snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      foods: [],
      walls,
    };
    const next = enqueueAvatarFood(state, { id: "viewer-1", avatarUrl: "x", authorName: "x" }, rngSeq([0.999]));
    const spawned = next.foods.find((food) => food.id === "viewer-1");
    expect(spawned).toBeDefined();
    expect(spawned!.pos.x).toBeLessThan(3);
  });

  test("queues overflow once the avatar limit is reached", () => {
    let state = createGame({ ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 1 }, rngSeq([0.1, 0.2, 0.3]));
    state = { ...state, status: "playing" };
    state = enqueueAvatarFood(state, {
      id: "viewer-1",
      avatarUrl: "https://example.com/a.png",
      authorName: "Ana",
    });
    state = enqueueAvatarFood(state, {
      id: "viewer-2",
      avatarUrl: "https://example.com/b.png",
      authorName: "Bia",
    });
    expect(state.foods.filter((food) => food.kind === "avatar").length).toBe(1);
    expect(state.foodQueue.length).toBe(1);
    expect(state.foodQueue[0]!.id).toBe("viewer-2");
  });

  test("eating an avatar food promotes the next queued one onto the board", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 1 };
    let state = createGame(cfg, rngSeq([0.1]));
    const head = state.snake[0]!;
    state = { ...state, status: "playing", direction: "right", foods: [basicFood({ x: 0, y: 0 })] };
    state = enqueueAvatarFood(state, {
      id: "viewer-1",
      avatarUrl: "https://example.com/a.png",
      authorName: "Ana",
    });
    state = {
      ...state,
      foods: state.foods.map((food) => food.kind === "avatar" ? { ...food, pos: { x: head.x + 1, y: head.y } } : food),
    };
    state = enqueueAvatarFood(state, {
      id: "viewer-2",
      avatarUrl: "https://example.com/b.png",
      authorName: "Bia",
    });
    expect(state.foodQueue.length).toBe(1);

    const next = tick(state);
    expect(next.foods.find((food) => food.id === "viewer-1")).toBeUndefined();
    expect(next.foods.filter((food) => food.kind === "avatar").length).toBe(1);
    expect(next.foods.find((food) => food.kind === "avatar")?.id).toBe("viewer-2");
    expect(next.foodQueue.length).toBe(0);
    expect(next.snake.length).toBe(state.snake.length + 1);
  });

  test("promoting a queued avatar food never lands it on an unreachable cell", () => {
    const walls = new Set<string>();
    for (let y = 0; y < 5; y++) walls.add(`3,${y}`);
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 5, boardHeight: 5, maxAvatarFoods: 1 };
    let state = createGame(cfg, rngSeq([0]));
    state = { ...state, status: "playing", direction: "right", snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }], walls, foods: [] };
    state = enqueueAvatarFood(state, { id: "viewer-1", avatarUrl: "x", authorName: "x" }, rngSeq([0]));
    // Place the first avatar food directly ahead of the head so the next tick eats it.
    state = {
      ...state,
      foods: state.foods.map((food) => (food.kind === "avatar" ? { ...food, pos: { x: 1, y: 0 } } : food)),
    };
    state = enqueueAvatarFood(state, { id: "viewer-2", avatarUrl: "x", authorName: "x" }, rngSeq([0]));

    // A high rng roll during promotion is what exposes a reachability bug.
    const next = tick(state, rngSeq([0.999]));
    const promoted = next.foods.find((food) => food.id === "viewer-2");
    expect(promoted).toBeDefined();
    expect(promoted!.pos.x).toBeLessThan(3);
  });
});

describe("pudding wall invariants", () => {
  function freeCellsConnected(boardWidth: number, boardHeight: number, walls: Set<string>): boolean {
    let start: { x: number; y: number } | null = null;
    let totalFree = 0;
    for (let x = 0; x < boardWidth; x++) {
      for (let y = 0; y < boardHeight; y++) {
        if (!walls.has(`${x},${y}`)) {
          if (!start) start = { x, y };
          totalFree++;
        }
      }
    }
    if (!start || totalFree === 0) return true;
    const queue: { x: number; y: number }[] = [start];
    const seen = new Set<string>([`${start.x},${start.y}`]);
    let cursor = 0;
    while (cursor < queue.length) {
      const c = queue[cursor++]!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const nx = c.x + dx, ny = c.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= boardWidth || ny >= boardHeight) continue;
        if (walls.has(key) || seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return seen.size === totalFree;
  }

  function hasSolidBlock(boardWidth: number, boardHeight: number, walls: Set<string>): boolean {
    for (let x = 0; x < boardWidth - 1; x++) {
      for (let y = 0; y < boardHeight - 1; y++) {
        if (
          walls.has(`${x},${y}`) &&
          walls.has(`${x+1},${y}`) &&
          walls.has(`${x},${y+1}`) &&
          walls.has(`${x+1},${y+1}`)
        ) return true;
      }
    }
    return false;
  }

  test(
    "free cells always stay connected after each pudding wall is placed",
    () => {
      const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 14, boardHeight: 10, gameMode: "pudding" };
      for (let seed = 0; seed < 8; seed++) {
        let calls = 0;
        const rng = () => ((seed * 9301 + (calls++ * 49297)) % 233280) / 233280;
        let state = { ...createGame(cfg, rng), status: "playing" as const };
        let prevWallCount = state.walls.size;
        for (let t = 0; t < 200; t++) {
          state = tick(state, rng) as typeof state;
          if (state.status !== "playing") break;
          if (state.walls.size > prevWallCount) {
            expect(
              freeCellsConnected(cfg.boardWidth, cfg.boardHeight, state.walls),
              `seed=${seed} tick=${t}: free cells disconnected after wall placed`
            ).toBe(true);
            prevWallCount = state.walls.size;
          }
        }
      }
    },
    15000,
  );

  test(
    "no 2x2 solid wall block ever appears in a pudding game",
    () => {
      const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 14, boardHeight: 10, gameMode: "pudding" };
      for (let seed = 0; seed < 8; seed++) {
        let calls = 0;
        const rng = () => ((seed * 9301 + (calls++ * 49297)) % 233280) / 233280;
        let state = { ...createGame(cfg, rng), status: "playing" as const };
        for (let t = 0; t < 200; t++) {
          state = tick(state, rng) as typeof state;
          if (state.status !== "playing") break;
          expect(
            hasSolidBlock(cfg.boardWidth, cfg.boardHeight, state.walls),
            `seed=${seed} tick=${t}: 2×2 solid block found`
          ).toBe(false);
        }
      }
    },
    15000,
  );

  test("walls that would disconnect free cells are rejected", () => {
    // A 6x4 board where the only cell that doesn't split the board in two is
    // position (2,2); we can verify a wall at (2,1) — which separates top from
    // bottom — is NOT placed.
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 6, boardHeight: 4, gameMode: "pudding" };
    const state = {
      ...createGame(cfg, () => 0),
      status: "playing" as const,
      score: 2,
      walls: new Set<string>(["0,2","1,2","3,2","4,2","5,2"]),
      snake: [{ x: 2, y: 0 }, { x: 2, y: 1 }],
      direction: "up" as const,
      foods: [{ id: "food-0", pos: { x: 5, y: 0 }, type: "apple_red" as const, kind: "basic" as const }],
    };
    // Tick should NOT add a wall at (2,2) — the only remaining cell in that row —
    // because it would disconnect y=0..1 from y=3.
    const next = tick(state);
    expect(next.walls.has("2,2")).toBe(false);
  });
});

// relocateStuckFoods only runs in pudding mode (dynamic walls can permanently seal
// off food; other modes either have no walls or static walls with food placed reachably).
describe("stuck food self-heals", () => {
  test("increments the stuck counter for food that remains unreachable, without relocating early", () => {
    const walls = new Set<string>();
    for (let y = 0; y < 5; y++) walls.add(`3,${y}`);
    let state = createGame({ ...DEFAULT_CONFIG, gameMode: "pudding", boardWidth: 5, boardHeight: 5 }, rngSeq([0]));
    state = {
      ...state,
      status: "playing",
      direction: "down",
      snake: [{ x: 0, y: 2 }, { x: 0, y: 1 }],
      walls,
      // On the far side of the wall column: unreachable from the snake.
      foods: [{ id: "stuck-food", pos: { x: 4, y: 4 }, type: "apple_red", kind: "basic" }],
      foodBlockedTicks: {},
    };
    const next = tick(state, rngSeq([0.9]));
    expect(next.foods.find((food) => food.id === "stuck-food")?.pos).toEqual({ x: 4, y: 4 });
    expect(next.foodBlockedTicks["stuck-food"]).toBe(1);
  });

  test("relocates food once its stuck counter crosses the threshold", () => {
    const walls = new Set<string>();
    for (let y = 0; y < 5; y++) walls.add(`3,${y}`);
    let state = createGame({ ...DEFAULT_CONFIG, gameMode: "pudding", boardWidth: 5, boardHeight: 5 }, rngSeq([0]));
    state = {
      ...state,
      status: "playing",
      direction: "down",
      snake: [{ x: 0, y: 2 }, { x: 0, y: 1 }],
      walls,
      foods: [{ id: "stuck-food", pos: { x: 4, y: 4 }, type: "apple_red", kind: "basic" }],
      foodBlockedTicks: { "stuck-food": 7 },
    };
    const next = tick(state, rngSeq([0.1]));
    const relocated = next.foods.find((food) => food.id === "stuck-food");
    expect(relocated).toBeDefined();
    expect(relocated!.pos.x).toBeLessThan(3);
    expect(next.foodBlockedTicks["stuck-food"]).toBe(0);
  });

  test("does not relocate food that is currently reachable, and resets its counter", () => {
    let state = createGame({ ...DEFAULT_CONFIG, gameMode: "pudding", boardWidth: 10, boardHeight: 8 }, rngSeq([0]));
    const head = state.snake[0]!;
    const foodPos = { x: head.x + 3, y: head.y };
    state = {
      ...state,
      status: "playing",
      direction: "right",
      foods: [{ id: "reachable-food", pos: foodPos, type: "apple_red", kind: "basic" }],
      foodBlockedTicks: { "reachable-food": 5 },
    };
    const next = tick(state, rngSeq([0.9]));
    const food = next.foods.find((entry) => entry.id === "reachable-food");
    expect(food?.pos).toEqual(foodPos);
    expect(next.foodBlockedTicks["reachable-food"]).toBe(0);
  });
});
