interface CacheEntry<T> {
  refCount: number;
  /** Resolved texture, or null while the load is still in flight. */
  texture: T | null;
  /** True if the load failed and we resolved to the shared fallback texture. */
  isFallback: boolean;
  promise: Promise<T>;
}

/**
 * Reference-counted texture cache, generic over the texture type so it can
 * be unit-tested without a real WebGL/Pixi context. Implements the 4
 * avatar-as-food stability requirements from the design spec (cache reuse,
 * release on consume, fallback on failure); the board-size limit/queue lives
 * in GameState, and CORS handling lives in the real Pixi loader passed in.
 *
 * The URL is registered **synchronously** on acquire (before the async load
 * resolves) so that a release issued while the texture is still downloading —
 * e.g. a food eaten, or a leaderboard slot changing, faster than the avatar
 * loads — is never a silent no-op that leaks the entry forever.
 */
export class TextureCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private fallbackPromise: Promise<T> | null = null;

  constructor(
    private readonly loader: (url: string) => Promise<T>,
    private readonly loadFallback: () => Promise<T>
  ) {}

  private getFallback(): Promise<T> {
    if (!this.fallbackPromise) this.fallbackPromise = this.loadFallback();
    return this.fallbackPromise;
  }

  acquire(url: string): Promise<T> {
    const existing = this.entries.get(url);
    if (existing) {
      existing.refCount++;
      return existing.promise;
    }

    const entry: CacheEntry<T> = {
      refCount: 1,
      texture: null,
      isFallback: false,
      promise: undefined as unknown as Promise<T>,
    };
    this.entries.set(url, entry);

    entry.promise = this.loader(url)
      .then((texture) => {
        entry.texture = texture;
        return texture;
      })
      .catch(() =>
        this.getFallback().then((fallback) => {
          entry.isFallback = true;
          entry.texture = fallback;
          return fallback;
        })
      );

    return entry.promise;
  }

  release(url: string, onEvict?: (texture: T) => void): void {
    const entry = this.entries.get(url);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount > 0) return;

    this.entries.delete(url);

    // Never destroy the shared fallback — it's reused across every failed load.
    const destroy = () => {
      if (!entry.isFallback && entry.texture !== null) onEvict?.(entry.texture);
    };
    if (entry.texture !== null) destroy();
    else void entry.promise.then(destroy);
  }
}
