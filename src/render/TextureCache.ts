const FALLBACK_KEY = "__fallback__";

interface CacheEntry<T> {
  texture: T;
  refCount: number;
}

/**
 * Reference-counted texture cache, generic over the texture type so it can
 * be unit-tested without a real WebGL/Pixi context. Implements the 4
 * avatar-as-food stability requirements from the design spec (cache reuse,
 * release on consume, fallback on failure); the board-size limit/queue lives
 * in GameState, and CORS handling lives in the real Pixi loader passed in.
 */
export class TextureCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private urlToKey = new Map<string, string>();

  constructor(
    private readonly loader: (url: string) => Promise<T>,
    private readonly loadFallback: () => Promise<T>
  ) {}

  async acquire(url: string): Promise<T> {
    const existingKey = this.urlToKey.get(url);
    if (existingKey) {
      const entry = this.cache.get(existingKey)!;
      entry.refCount++;
      return entry.texture;
    }

    try {
      const texture = await this.loader(url);
      this.cache.set(url, { texture, refCount: 1 });
      this.urlToKey.set(url, url);
      return texture;
    } catch {
      let fallbackEntry = this.cache.get(FALLBACK_KEY);
      if (!fallbackEntry) {
        const texture = await this.loadFallback();
        fallbackEntry = { texture, refCount: 0 };
        this.cache.set(FALLBACK_KEY, fallbackEntry);
      }
      fallbackEntry.refCount++;
      this.urlToKey.set(url, FALLBACK_KEY);
      return fallbackEntry.texture;
    }
  }

  release(url: string, onEvict?: (texture: T) => void): void {
    const key = this.urlToKey.get(url);
    if (!key) return;

    const entry = this.cache.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0 && key !== FALLBACK_KEY) {
      this.cache.delete(key);
      this.urlToKey.delete(url);
      onEvict?.(entry.texture);
    }
  }
}
