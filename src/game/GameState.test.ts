import { describe, test, expect } from "vitest";
import {
  createGame,
  setDirection,
  tick,
  enqueueAvatarFood,
} from "./GameState";
import type { GameConfig } from "./types";

const smallConfig: GameConfig = { boardSize: 12, maxAvatarFoods: 8 };

function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("createGame", () => {
  test("starts with a snake of length 2, status start, exactly one base apple", () => {
    const state = createGame(smallConfig);
    expect(state.snake.length).toBe(2);
    expect(state.status).toBe("start");
    expect(state.baseApple).toBeDefined();
    expect(state.score).toBe(0);
  });

  test("snake starts fully inside the board", () => {
    const state = createGame(smallConfig);
    for (const seg of state.snake) {
      expect(seg.x).toBeGreaterThanOrEqual(0);
      expect(seg.x).toBeLessThan(smallConfig.boardSize);
      expect(seg.y).toBeGreaterThanOrEqual(0);
      expect(seg.y).toBeLessThan(smallConfig.boardSize);
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

describe("tick — movement", () => {
  test("moving normally advances head and removes tail (no growth)", () => {
    let state = createGame(smallConfig, rngSeq([0.99]));
    state = { ...state, status: "playing", direction: "right" };
    // Move the base apple far away so this tick is a normal (non-eating) move.
    state = { ...state, baseApple: { x: 0, y: 0 } };
    const before = state.snake[0];
    const next = tick(state);
    expect(next.snake.length).toBe(state.snake.length);
    expect(next.snake[0]).toEqual({ x: before.x + 1, y: before.y });
  });
});

describe("tick — eating the base apple", () => {
  test("grows the snake by 1, increments score, and respawns exactly one base apple", () => {
    let state = createGame(smallConfig, rngSeq([0.5]));
    const head = state.snake[0];
    state = {
      ...state,
      status: "playing",
      direction: "right",
      baseApple: { x: head.x + 1, y: head.y },
    };
    const lengthBefore = state.snake.length;
    const next = tick(state);
    expect(next.snake.length).toBe(lengthBefore + 1);
    expect(next.score).toBe(1);
    expect(next.baseApple).toBeDefined();
    expect(next.baseApple).not.toEqual({ x: head.x + 1, y: head.y });
  });
});

describe("tick — collisions", () => {
  test("hitting the wall ends the game as lost", () => {
    let state = createGame(smallConfig);
    state = {
      ...state,
      status: "playing",
      direction: "left",
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      baseApple: { x: 10, y: 10 },
    };
    const next = tick(state);
    expect(next.status).toBe("lost");
  });

  test("hitting its own body ends the game as lost", () => {
    let state = createGame(smallConfig);
    // Length-3 snake reversing directly into its neck segment (not the tail,
    // which would otherwise vacate and make the move safe).
    state = {
      ...state,
      status: "playing",
      direction: "right",
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      baseApple: { x: 0, y: 0 },
    };
    const next = tick(state);
    expect(next.status).toBe("lost");
  });
});

describe("tick — victory", () => {
  test("filling the entire board ends the game as victory", () => {
    const cfg: GameConfig = { boardSize: 2, maxAvatarFoods: 8 };
    let state = createGame(cfg);
    // 2x2 board; snake occupies 3 of 4 cells, apple on the last cell, moving onto it wins.
    state = {
      ...state,
      status: "playing",
      direction: "down",
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      baseApple: { x: 0, y: 1 },
    };
    const next = tick(state);
    expect(next.status).toBe("victory");
  });
});

describe("avatar foods — limit and queue", () => {
  test("adds avatar food directly to the board while under the limit", () => {
    let state = createGame({ boardSize: 12, maxAvatarFoods: 2 }, rngSeq([0.1, 0.2]));
    state = { ...state, status: "playing" };
    const next = enqueueAvatarFood(state, {
      id: "viewer-1",
      avatarUrl: "https://example.com/a.png",
      authorName: "Ana",
    });
    expect(next.avatarFoods.length).toBe(1);
    expect(next.avatarQueue.length).toBe(0);
  });

  test("queues overflow once the board limit is reached", () => {
    let state = createGame({ boardSize: 12, maxAvatarFoods: 1 }, rngSeq([0.1, 0.2, 0.3]));
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
    expect(state.avatarFoods.length).toBe(1);
    expect(state.avatarQueue.length).toBe(1);
    expect(state.avatarQueue[0].id).toBe("viewer-2");
  });

  test("eating an avatar food promotes the next queued one onto the board", () => {
    const cfg: GameConfig = { boardSize: 12, maxAvatarFoods: 1 };
    let state = createGame(cfg, rngSeq([0.1]));
    const head = state.snake[0];
    state = { ...state, status: "playing", direction: "right", baseApple: { x: 0, y: 0 } };
    state = enqueueAvatarFood(state, {
      id: "viewer-1",
      avatarUrl: "https://example.com/a.png",
      authorName: "Ana",
    });
    // Force the on-board avatar food to sit right in front of the head.
    state = {
      ...state,
      avatarFoods: [{ ...state.avatarFoods[0], pos: { x: head.x + 1, y: head.y } }],
    };
    state = enqueueAvatarFood(state, {
      id: "viewer-2",
      avatarUrl: "https://example.com/b.png",
      authorName: "Bia",
    });
    expect(state.avatarQueue.length).toBe(1);

    const next = tick(state);
    expect(next.avatarFoods.find((f) => f.id === "viewer-1")).toBeUndefined();
    expect(next.avatarFoods.length).toBe(1);
    expect(next.avatarFoods[0].id).toBe("viewer-2");
    expect(next.avatarQueue.length).toBe(0);
    expect(next.snake.length).toBe(state.snake.length + 1);
  });
});
