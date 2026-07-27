import { describe, expect, test } from "vitest";
import { carryOverAvatarFoods, createGame, enqueueAvatarFood, reenqueueAvatarFoods, setDirection, tick } from "./GameState";
import { DEFAULT_CONFIG, type BoardFood, type GameConfig, type GameState } from "./types";

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
    // Snake/walls set explicitly (not derived from the generated maze, whose
    // exact tail orientation is legitimately random) so this only exercises
    // the maze_race victory-on-target-fruit rule in tick().
    state = {
      ...state,
      status: "playing",
      direction: "right",
      snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
      walls: new Set(["5,4", "5,5"]),
      foods: [basicFood({ x: 3, y: 2 })],
    };
    const next = tick(state);
    expect(next.status).toBe("victory");
    expect(next.score).toBe(1);
  });

  test("maze race does NOT win when a chat avatar food is eaten instead of the target", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 10, boardHeight: 8, gameMode: "maze_race", maxAvatarFoods: 3 };
    let state = createGame(cfg);
    // Push the real target fruit far away, and place a viewer's avatar food
    // directly in the snake's path — eating it should score but not end the
    // round; only the target fruit (unaffected here) may trigger victory.
    // Snake/walls set explicitly for the same reason as the test above.
    state = {
      ...state,
      status: "playing",
      direction: "right",
      snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
      walls: new Set(),
      foods: [
        { ...state.foods[0]!, pos: { x: 9, y: 7 } },
        { id: "viewer-1", pos: { x: 3, y: 2 }, type: "apple_red", kind: "avatar", avatarUrl: "x", authorName: "x" },
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

describe("full_food avatar spawn (#105 — never overlaps another cell)", () => {
  test("in a fully-packed full_food board, the avatar swaps onto an existing basic food's cell", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 6, boardHeight: 6, gameMode: "full_food", maxAvatarFoods: 3 };
    let state: GameState = { ...createGame(cfg, rngSeq([0])), status: "playing" };
    const totalFoodsBefore = state.foods.length;
    expect(state.foods.every((food) => food.kind === "basic")).toBe(true);

    const next = enqueueAvatarFood(state, { id: "viewer-1", avatarUrl: "x", authorName: "x" }, rngSeq([0.9]));

    const avatar = next.foods.find((food) => food.id === "viewer-1");
    expect(avatar).toBeDefined();
    // Total food count on the board is unchanged (one basic swapped for one avatar).
    expect(next.foods.length).toBe(totalFoodsBefore);
    // The avatar never overlaps the snake or another food.
    const occupiedBySnake = state.snake.some((seg) => seg.x === avatar!.pos.x && seg.y === avatar!.pos.y);
    expect(occupiedBySnake).toBe(false);
    const overlappingFoods = next.foods.filter(
      (food) => food.id !== "viewer-1" && food.pos.x === avatar!.pos.x && food.pos.y === avatar!.pos.y,
    );
    expect(overlappingFoods.length).toBe(0);
  });

  test("queues the avatar instead of overlapping when even the avatar limit's worth of basic food is unavailable", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 4, boardHeight: 4, gameMode: "full_food", maxAvatarFoods: 20 };
    let state: GameState = { ...createGame(cfg, rngSeq([0])), status: "playing" };
    // Swap every single basic food out for an avatar first, leaving none to swap onto.
    for (let i = 0; i < state.foods.length; i++) {
      state = enqueueAvatarFood(state, { id: `viewer-${i}`, avatarUrl: "x", authorName: "x" }, rngSeq([0]));
    }
    expect(state.foods.some((food) => food.kind === "basic")).toBe(false);

    const beforeCount = state.foods.length;
    const next = enqueueAvatarFood(state, { id: "viewer-overflow", avatarUrl: "x", authorName: "x" }, rngSeq([0]));
    // No basic food left to swap onto — queues instead of overlapping anything.
    expect(next.foods.length).toBe(beforeCount);
    expect(next.foodQueue.some((food) => food.id === "viewer-overflow")).toBe(true);
  });

  test("promoting a queued avatar in full_food also swaps onto a basic food's cell, never overlapping", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 6, boardHeight: 6, gameMode: "full_food", maxAvatarFoods: 1 };
    let state: GameState = { ...createGame(cfg, rngSeq([0])), status: "playing", direction: "right" };
    const head = state.snake[0]!;
    const eatPos = { x: head.x + 1, y: head.y };
    // Turn whatever basic food sits directly ahead of the head into the
    // avatar the snake is about to eat, and queue a second avatar behind it
    // — deterministic, so promotion can't collide with a food already
    // occupying the same cell by chance of the real (random) spawn.
    state = {
      ...state,
      foods: state.foods.map((food) =>
        food.pos.x === eatPos.x && food.pos.y === eatPos.y
          ? { ...food, id: "viewer-1", kind: "avatar" as const, avatarUrl: "x", authorName: "x" }
          : food,
      ),
      foodQueue: [{ id: "viewer-2", pos: { x: -1, y: -1 }, type: "apple_red", kind: "avatar", avatarUrl: "x", authorName: "x" }],
    };

    const next = tick(state, rngSeq([0.9]));
    const promoted = next.foods.find((food) => food.id === "viewer-2");
    expect(promoted).toBeDefined();
    expect(next.foodQueue.length).toBe(0);
    const overlapping = next.foods.filter(
      (food) => food.id !== "viewer-2" && food.pos.x === promoted!.pos.x && food.pos.y === promoted!.pos.y,
    );
    expect(overlapping.length).toBe(0);
  });
});

describe("maze wall generation (#101 — occupies the whole board)", () => {
  function freeCellsConnected(width: number, height: number, walls: Set<string>): boolean {
    let start: { x: number; y: number } | null = null;
    let total = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!walls.has(`${x},${y}`)) {
          if (!start) start = { x, y };
          total++;
        }
      }
    }
    if (!start) return true;
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue = [start];
    let cursor = 0;
    while (cursor < queue.length) {
      const c = queue[cursor++]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, ny = c.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (walls.has(key) || seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return seen.size === total;
  }

  // A mix of even/even (the two real presets), even/odd, and odd/odd boards —
  // the algorithm's border-anchoring behaves differently in each case.
  const dims: [number, number][] = [
    [16, 12], [18, 14], [10, 8], [9, 8], [8, 9], [15, 11], [17, 13],
  ];

  test("every free cell is reachable from every other free cell (full connectivity, no isolated pockets)", () => {
    for (const [w, h] of dims) {
      for (let seed = 0; seed < 3; seed++) {
        let calls = 0;
        const rng = () => ((seed * 7919 + calls++ * 104729) % 233280) / 233280;
        const state = createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "maze_harvest" }, rng);
        expect(freeCellsConnected(w, h, state.walls), `${w}x${h} seed=${seed}`).toBe(true);
      }
    }
  });

  test("the board perimeter is never entirely free (no moat ring around the maze)", () => {
    for (const [w, h] of dims) {
      for (let seed = 0; seed < 3; seed++) {
        let calls = 0;
        const rng = () => ((seed * 6151 + calls++ * 89653) % 233280) / 233280;
        const state = createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "maze_race" }, rng);
        const perimeterHasWall =
          Array.from({ length: w }, (_, x) => state.walls.has(`${x},0`) || state.walls.has(`${x},${h - 1}`)).some(Boolean) ||
          Array.from({ length: h }, (_, y) => state.walls.has(`0,${y}`) || state.walls.has(`${w - 1},${y}`)).some(Boolean);
        expect(perimeterHasWall, `${w}x${h} seed=${seed}`).toBe(true);
      }
    }
  });

  test("no internal row or column is entirely wall (no redundant dead strip)", () => {
    for (const [w, h] of dims) {
      const state = createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "maze_harvest" }, rngSeq([0.6]));
      for (let y = 1; y < h - 1; y++) {
        const rowFullWall = Array.from({ length: w }, (_, x) => state.walls.has(`${x},${y}`)).every(Boolean);
        expect(rowFullWall, `row ${y} of ${w}x${h}`).toBe(false);
      }
      for (let x = 1; x < w - 1; x++) {
        const colFullWall = Array.from({ length: h }, (_, y) => state.walls.has(`${x},${y}`)).every(Boolean);
        expect(colFullWall, `col ${x} of ${w}x${h}`).toBe(false);
      }
    }
  });

  test("the snake's starting cell and every initial food/target are connected", () => {
    for (const [w, h] of dims) {
      const state = createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "maze_race" }, rngSeq([0.4]));
      const head = state.snake[0]!;
      const seen = new Set<string>([`${head.x},${head.y}`]);
      const queue = [head];
      let cursor = 0;
      while (cursor < queue.length) {
        const c = queue[cursor++]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = c.x + dx, ny = c.y + dy;
          const key = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (state.walls.has(key) || seen.has(key)) continue;
          seen.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
      for (const food of state.foods) {
        expect(seen.has(`${food.pos.x},${food.pos.y}`), `${w}x${h} food ${food.id}`).toBe(true);
      }
    }
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

  test("a new pudding wall is never placed 4-adjacent to the current food (#116)", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 14, boardHeight: 10, gameMode: "pudding" };
    for (let seed = 0; seed < 8; seed++) {
      let calls = 0;
      const rng = () => ((seed * 9301 + (calls++ * 49297)) % 233280) / 233280;
      let state = { ...createGame(cfg, rng), status: "playing" as const };
      let prevWalls = state.walls;
      for (let t = 0; t < 200; t++) {
        state = tick(state, rng) as typeof state;
        if (state.status !== "playing") break;
        if (state.walls.size > prevWalls.size) {
          const addedWall = [...state.walls].find((w) => !prevWalls.has(w))!;
          const [wx, wy] = addedWall.split(",").map(Number);
          for (const food of state.foods) {
            const dx = Math.abs(wx - food.pos.x);
            const dy = Math.abs(wy - food.pos.y);
            const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
            expect(isAdjacent, `seed=${seed} t=${t}: wall ${addedWall} is 4-adjacent to food ${food.id} at ${food.pos.x},${food.pos.y}`).toBe(false);
          }
        }
        prevWalls = state.walls;
      }
    }
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

describe("avatar food carry-over across a round reset (#111)", () => {
  test("carryOverAvatarFoods collects both on-board avatars and queued ones", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 1 };
    let state = createGame(cfg, rngSeq([0.1]));
    state = { ...state, status: "playing" };
    state = enqueueAvatarFood(state, { id: "on-board", avatarUrl: "a", authorName: "Ana" });
    state = enqueueAvatarFood(state, { id: "queued", avatarUrl: "b", authorName: "Bia" });

    const pending = carryOverAvatarFoods(state);
    expect(pending.map((a) => a.id).sort()).toEqual(["on-board", "queued"]);
  });

  test("reenqueueAvatarFoods places carried-over avatars back onto a fresh round's state", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 3 };
    const freshState = { ...createGame(cfg, rngSeq([0.2])), status: "playing" as const };
    const pending = [
      { id: "viewer-1", avatarUrl: "a", authorName: "Ana" },
      { id: "viewer-2", avatarUrl: "b", authorName: "Bia" },
    ];

    const next = reenqueueAvatarFoods(freshState, pending, rngSeq([0.3]));
    const ids = next.foods.filter((f) => f.kind === "avatar").map((f) => f.id);
    expect(ids.sort()).toEqual(["viewer-1", "viewer-2"]);
  });

  test("a full round trip (carry over then reenqueue) never duplicates an already-eaten avatar", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 3 };
    let state: GameState = { ...createGame(cfg, rngSeq([0.1])), status: "playing" };
    state = enqueueAvatarFood(state, { id: "eaten", avatarUrl: "a", authorName: "Ana" });
    state = enqueueAvatarFood(state, { id: "still-there", avatarUrl: "b", authorName: "Bia" });
    // Simulate "eaten" having already been consumed this round (removed from foods).
    state = { ...state, foods: state.foods.filter((f) => f.id !== "eaten") };

    const pending = carryOverAvatarFoods(state);
    expect(pending.some((a) => a.id === "eaten")).toBe(false);
    expect(pending.some((a) => a.id === "still-there")).toBe(true);

    const fresh = { ...createGame(cfg, rngSeq([0.2])), status: "playing" as const };
    const next = reenqueueAvatarFoods(fresh, pending, rngSeq([0.3]));
    const stillThereCount = next.foods.filter((f) => f.id === "still-there").length;
    expect(stillThereCount).toBe(1);
    expect(next.foods.some((f) => f.id === "eaten")).toBe(false);
  });

  test("overflow beyond maxAvatarFoods stays queued rather than dropped on reenqueue", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 12, maxAvatarFoods: 1 };
    const fresh = { ...createGame(cfg, rngSeq([0.1])), status: "playing" as const };
    const pending = [
      { id: "viewer-1", avatarUrl: "a", authorName: "Ana" },
      { id: "viewer-2", avatarUrl: "b", authorName: "Bia" },
    ];
    const next = reenqueueAvatarFoods(fresh, pending, rngSeq([0.2]));
    expect(next.foods.filter((f) => f.kind === "avatar").length).toBe(1);
    expect(next.foodQueue.length).toBe(1);
  });
});

describe("maze spawn forces exploration (#114)", () => {
  function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  test("initial food in maze_harvest spawns reasonably far from the head, not immediately adjacent", () => {
    let closeSpawns = 0;
    const total = 20;
    for (let seed = 0; seed < total; seed++) {
      let calls = 0;
      const rng = () => ((seed * 7919 + calls++ * 104729) % 233280) / 233280;
      const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 18, boardHeight: 14, gameMode: "maze_harvest" }, rng);
      const head = state.snake[0]!;
      const food = state.foods[0]!;
      if (manhattan(head, food.pos) <= 2) closeSpawns++;
    }
    // Not a hard guarantee (tight local pockets can still force a close spawn),
    // but the vast majority should land meaningfully far from the head.
    expect(closeSpawns / total).toBeLessThan(0.2);
  });

  test("maze_harvest avatar spawns prefer a different quadrant than the head's current one", () => {
    let differentQuadrant = 0;
    const total = 20;
    const w = 18;
    const h = 14;
    const quadrantOf = (pos: { x: number; y: number }) => (pos.x < w / 2 ? 0 : 1) + (pos.y < h / 2 ? 0 : 2);
    for (let seed = 0; seed < total; seed++) {
      let calls = 0;
      const rng = () => ((seed * 6151 + calls++ * 89653) % 233280) / 233280;
      let state: GameState = { ...createGame({ ...DEFAULT_CONFIG, boardWidth: w, boardHeight: h, gameMode: "maze_harvest", maxAvatarFoods: 3 }, rng), status: "playing" };
      const headQuadrant = quadrantOf(state.snake[0]!);
      state = enqueueAvatarFood(state, { id: "viewer-1", avatarUrl: "x", authorName: "x" }, rng);
      const avatar = state.foods.find((f) => f.kind === "avatar")!;
      if (quadrantOf(avatar.pos) !== headQuadrant) differentQuadrant++;
    }
    expect(differentQuadrant / total).toBeGreaterThan(0.6);
  });

  test("falls back to a closer spawn on a small/tight maze rather than finding nothing", () => {
    // A small 8x6 maze_harvest board may not have any cell 6+ away from the
    // head — pickSafeSpawn (exercised via createGame's initial food spawn)
    // must still return a valid, reachable cell instead of failing.
    for (let seed = 0; seed < 10; seed++) {
      let calls = 0;
      const rng = () => ((seed * 3571 + calls++ * 65537) % 233280) / 233280;
      const state = createGame({ ...DEFAULT_CONFIG, boardWidth: 8, boardHeight: 6, gameMode: "maze_harvest" }, rng);
      expect(state.foods.length).toBeGreaterThan(0);
      expect(state.walls.has(`${state.foods[0]!.pos.x},${state.foods[0]!.pos.y}`)).toBe(false);
    }
  });
});

describe("golden (enchanted) apple (v3.3)", () => {
  function seededRng(seed: number): () => number {
    let calls = 0;
    return () => ((seed * 9301 + calls++ * 49297) % 233280) / 233280;
  }

  test("eating a golden apple scatters 5-6 apples and bumps goldenPulse", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 14, boardHeight: 12, gameMode: "classic", maxAvatarFoods: 0 };
    let state: GameState = { ...createGame(cfg, seededRng(1)), status: "playing", score: 5, direction: "right" };
    const head = state.snake[0]!;
    state = {
      ...state,
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }],
      foods: [{ id: "golden-x", pos: { x: 6, y: 5 }, type: "apple_gold", kind: "golden" }],
    };
    void head;
    const next = tick(state, seededRng(7));
    expect(next.goldenPulse).toBe(state.goldenPulse + 1);
    // The eaten golden is gone; a burst of 5-6 basics is now on the board.
    expect(next.foods.some((f) => f.id === "golden-x")).toBe(false);
    const basics = next.foods.filter((f) => f.kind === "basic");
    expect(basics.length).toBeGreaterThanOrEqual(5);
    expect(basics.length).toBeLessThanOrEqual(6);
  });

  test("a fresh classic game starts with goldenPulse 0 and no golden apple on the board", () => {
    const state = createGame({ ...DEFAULT_CONFIG, gameMode: "classic" }, seededRng(3));
    expect(state.goldenPulse).toBe(0);
    expect(state.foods.some((f) => f.kind === "golden")).toBe(false);
  });

  test("a golden apple spawns on a lucky roll in classic mode", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 10, gameMode: "classic", maxAvatarFoods: 0 };
    let state: GameState = { ...createGame(cfg, rngSeq([0.5])), status: "playing", score: 5, direction: "right" };
    // Snake moves right into an empty cell (no eat this tick), with a basic
    // food already present elsewhere so ensureBasicFood consumes no rng before
    // the golden roll. First rng value < GOLDEN_APPLE_SPAWN_CHANCE fires it.
    state = {
      ...state,
      snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
      foods: [basicFood({ x: 9, y: 8 })],
    };
    const next = tick(state, rngSeq([0.005, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(next.foods.some((f) => f.kind === "golden")).toBe(true);
  });

  test("no second golden apple spawns while one is already on the board", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 12, boardHeight: 10, gameMode: "classic", maxAvatarFoods: 0 };
    let state: GameState = { ...createGame(cfg, rngSeq([0.5])), status: "playing", score: 5, direction: "right" };
    state = {
      ...state,
      snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
      foods: [basicFood({ x: 9, y: 8 }), { id: "golden-a", pos: { x: 5, y: 5 }, type: "apple_gold", kind: "golden" }],
    };
    const next = tick(state, rngSeq([0.005, 0.5, 0.5, 0.5]));
    expect(next.foods.filter((f) => f.kind === "golden").length).toBe(1);
  });

  test("a golden apple never appears in a maze game (classic-only event)", () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, boardWidth: 18, boardHeight: 14, gameMode: "maze_harvest" };
    let state: GameState = { ...createGame(cfg, seededRng(2)), status: "playing", score: 5 };
    let sawGolden = false;
    for (let t = 0; t < 800; t++) {
      state = tick(state, seededRng(t + 100));
      if (state.status !== "playing") break;
      if (state.foods.some((f) => f.kind === "golden")) { sawGolden = true; break; }
    }
    expect(sawGolden).toBe(false);
  });
});
