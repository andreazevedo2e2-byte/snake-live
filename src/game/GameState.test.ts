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
});
