import { describe, test, expect } from "vitest";
import { reconcileSlots } from "./leaderboardTextures";

describe("reconcileSlots", () => {
  test("acquires textures for newly-filled slots", () => {
    const r = reconcileSlots([null, null], ["a.png", "b.png"]);
    expect(r.acquire).toEqual([
      { slot: 0, url: "a.png" },
      { slot: 1, url: "b.png" },
    ]);
    expect(r.release).toEqual([]);
    expect(r.nextHeld).toEqual(["a.png", "b.png"]);
  });

  test("does nothing for slots whose url is unchanged", () => {
    const r = reconcileSlots(["a.png", "b.png"], ["a.png", "b.png"]);
    expect(r.acquire).toEqual([]);
    expect(r.release).toEqual([]);
    expect(r.nextHeld).toEqual(["a.png", "b.png"]);
  });

  test("releases the old url and acquires the new one when a slot changes", () => {
    const r = reconcileSlots(["a.png"], ["c.png"]);
    expect(r.acquire).toEqual([{ slot: 0, url: "c.png" }]);
    expect(r.release).toEqual(["a.png"]);
    expect(r.nextHeld).toEqual(["c.png"]);
  });

  test("releases a url when a slot empties out", () => {
    const r = reconcileSlots(["a.png", "b.png"], ["a.png", null]);
    expect(r.acquire).toEqual([]);
    expect(r.release).toEqual(["b.png"]);
    expect(r.nextHeld).toEqual(["a.png", null]);
  });

  test("a url swapping between two slots nets zero cache churn (held set unchanged)", () => {
    // Viewers A and B swap ranks. Both slots 'change', but the live texture set
    // is identical, so acquire-before-release keeps both alive (no evict/reload flicker).
    const r = reconcileSlots(["a.png", "b.png"], ["b.png", "a.png"]);
    expect(r.acquire).toEqual([
      { slot: 0, url: "b.png" },
      { slot: 1, url: "a.png" },
    ]);
    expect(r.release).toEqual(["a.png", "b.png"]); // released in slot order
    // Net: each url acquired once and released once => refcount unchanged.
    const acquiredUrls = r.acquire.map((a) => a.url).sort();
    expect([...r.release].sort()).toEqual(acquiredUrls);
  });
});
