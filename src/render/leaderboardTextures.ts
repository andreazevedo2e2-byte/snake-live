export interface SlotReconciliation {
  /** Slots that changed and now need a texture loaded + assigned. */
  acquire: Array<{ slot: number; url: string }>;
  /** URLs to release back to the cache (the previous occupants of changed slots). */
  release: string[];
  /** The new per-slot held-URL state to remember for next time. */
  nextHeld: Array<string | null>;
}

/**
 * Pure reconciliation for the leaderboard's fixed set of avatar slots.
 *
 * The HUD calls setLeaderboard on every chat message; the previous code
 * acquired a texture for each visible entry every time and never released
 * any, so refcounts climbed without bound over a multi-hour stream. This
 * computes the minimal acquire/release set so at most N textures (one per
 * slot) are ever held alive.
 *
 * Callers should apply `acquire` BEFORE `release` so a URL that merely moves
 * between slots is never transiently evicted (and reloaded with a flicker).
 */
export function reconcileSlots(
  held: Array<string | null>,
  next: Array<string | null>
): SlotReconciliation {
  const acquire: Array<{ slot: number; url: string }> = [];
  const release: string[] = [];

  for (let slot = 0; slot < next.length; slot++) {
    const oldUrl = held[slot] ?? null;
    const newUrl = next[slot] ?? null;
    if (oldUrl === newUrl) continue;
    if (oldUrl !== null) release.push(oldUrl);
    if (newUrl !== null) acquire.push({ slot, url: newUrl });
  }

  return { acquire, release, nextHeld: [...next] };
}
