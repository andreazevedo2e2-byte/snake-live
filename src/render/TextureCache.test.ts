import { describe, test, expect, vi } from "vitest";
import { TextureCache } from "./TextureCache";

describe("TextureCache", () => {
  test("loads a texture once and reuses it on a second acquire for the same URL", async () => {
    const loader = vi.fn().mockResolvedValue("texture-A");
    const fallback = vi.fn().mockResolvedValue("fallback-texture");
    const cache = new TextureCache(loader, fallback);

    const a = await cache.acquire("https://cdn/a.png");
    const b = await cache.acquire("https://cdn/a.png");

    expect(a).toBe("texture-A");
    expect(b).toBe("texture-A");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("evicts the texture only once every holder has released it", async () => {
    const loader = vi.fn().mockResolvedValue("texture-A");
    const fallback = vi.fn().mockResolvedValue("fallback-texture");
    const cache = new TextureCache(loader, fallback);
    const onEvict = vi.fn();

    await cache.acquire("https://cdn/a.png");
    await cache.acquire("https://cdn/a.png"); // refCount = 2

    cache.release("https://cdn/a.png", onEvict);
    expect(onEvict).not.toHaveBeenCalled();

    cache.release("https://cdn/a.png", onEvict);
    expect(onEvict).toHaveBeenCalledWith("texture-A");

    await cache.acquire("https://cdn/a.png");
    expect(loader).toHaveBeenCalledTimes(2); // re-fetched after full eviction
  });

  test("falls back to the default texture when loading fails, without throwing", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("404"));
    const fallback = vi.fn().mockResolvedValue("fallback-texture");
    const cache = new TextureCache(loader, fallback);

    const texture = await cache.acquire("https://cdn/broken.png");
    expect(texture).toBe("fallback-texture");
  });

  test("the fallback texture is shared and never evicted", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("404"));
    const fallback = vi.fn().mockResolvedValue("fallback-texture");
    const cache = new TextureCache(loader, fallback);
    const onEvict = vi.fn();

    await cache.acquire("https://cdn/broken1.png");
    await cache.acquire("https://cdn/broken2.png");
    cache.release("https://cdn/broken1.png", onEvict);
    cache.release("https://cdn/broken2.png", onEvict);

    expect(onEvict).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test("a release during a still-pending load does not leak (evicts once it resolves)", async () => {
    // This is the real-world race: a food/leaderboard avatar is removed before
    // its texture finishes downloading. The cache must register the URL
    // synchronously on acquire so the early release is not a no-op.
    let resolve!: (t: string) => void;
    const loader = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const fallback = vi.fn().mockResolvedValue("fallback-texture");
    const cache = new TextureCache<string>(loader, fallback);
    const onEvict = vi.fn();

    const p = cache.acquire("https://cdn/slow.png"); // refCount 1, load pending
    cache.release("https://cdn/slow.png", onEvict); // released while still loading
    resolve("texture-slow"); // download finishes AFTER the release
    await p;
    await Promise.resolve(); // flush the deferred eviction

    expect(onEvict).toHaveBeenCalledWith("texture-slow");

    // The entry must have been evicted, so a fresh acquire reloads from scratch.
    cache.acquire("https://cdn/slow.png");
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
