import { describe, test, expect } from "vitest";
import { createLeaderboard, creditViewer, topViewers, getHero } from "./Leaderboard";

describe("Leaderboard", () => {
  test("starts empty", () => {
    const board = createLeaderboard();
    expect(topViewers(board, 5)).toEqual([]);
    expect(getHero(board)).toBeNull();
  });

  test("crediting a viewer adds them with a score of 1", () => {
    let board = createLeaderboard();
    board = creditViewer(board, { channelId: "UC1", name: "Ana", avatarUrl: "a.png" });
    const top = topViewers(board, 5);
    expect(top).toEqual([{ channelId: "UC1", name: "Ana", avatarUrl: "a.png", score: 1, foodCount: 0, speedCount: 0 }]);
  });

  test("crediting the same viewer again accumulates their score", () => {
    let board = createLeaderboard();
    board = creditViewer(board, { channelId: "UC1", name: "Ana", avatarUrl: "a.png" });
    board = creditViewer(board, { channelId: "UC1", name: "Ana", avatarUrl: "a.png" });
    expect(topViewers(board, 5)[0]!.score).toBe(2);
  });

  test("topViewers is sorted descending by score and respects the limit", () => {
    let board = createLeaderboard();
    board = creditViewer(board, { channelId: "UC1", name: "Ana", avatarUrl: "a.png" });
    board = creditViewer(board, { channelId: "UC2", name: "Bia", avatarUrl: "b.png" });
    board = creditViewer(board, { channelId: "UC2", name: "Bia", avatarUrl: "b.png" });
    board = creditViewer(board, { channelId: "UC3", name: "Caio", avatarUrl: "c.png" });
    const top2 = topViewers(board, 2);
    expect(top2.map((v) => v.channelId)).toEqual(["UC2", "UC1"]);
  });

  test("the #1 HERO is the viewer with the highest session score", () => {
    let board = createLeaderboard();
    board = creditViewer(board, { channelId: "UC1", name: "Ana", avatarUrl: "a.png" });
    board = creditViewer(board, { channelId: "UC2", name: "Bia", avatarUrl: "b.png" });
    board = creditViewer(board, { channelId: "UC2", name: "Bia", avatarUrl: "b.png" });
    expect(getHero(board)?.channelId).toBe("UC2");
  });

  test("tracks food and speed commands separately", () => {
    let board = createLeaderboard();
    const viewer = { channelId: "UC1", name: "Ana", avatarUrl: "a.png" };
    board = creditViewer(board, viewer, "food");
    board = creditViewer(board, viewer, "speed");
    expect(topViewers(board, 1)[0]).toMatchObject({ score: 2, foodCount: 1, speedCount: 1 });
  });
});
