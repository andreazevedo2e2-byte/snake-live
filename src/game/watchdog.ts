import type { GameConfig } from "./types";

/** A healthy round always keeps scoring well within this window. If it
 * doesn't (an unforeseen autopilot bug traps the snake), the round should
 * force a theatrical loss and restart rather than freezing the stream —
 * measured in wall-clock time so it fires consistently regardless of tick
 * rate or speed multiplier. This is the reference threshold for a small
 * classic board (10x8); see watchdogThresholdMs for how it scales up. */
export const WATCHDOG_MS = 90000;

/** Hard ceiling on the scaled threshold — however large or maze-like the
 * board gets, a round that hasn't scored in this long is being generous
 * about "still legitimately searching," not doubting a real bug. Keeps a
 * misconfigured huge board from recreating the original frozen-stream
 * problem the watchdog exists to prevent. */
export const WATCHDOG_ABSOLUTE_CAP_MS = 240000;

const REFERENCE_CELLS = 80; // 10x8 classic board — the size WATCHDOG_MS was tuned for
const MAZE_MODE_FACTOR = 1.5; // maze corridors take longer to search than an open board

/** Scales the stall threshold by board size (a big board legitimately takes
 * longer between food) and game mode (maze corridors take longer to
 * navigate than an open floor), capped at WATCHDOG_ABSOLUTE_CAP_MS. */
export function watchdogThresholdMs(config: Pick<GameConfig, "boardWidth" | "boardHeight" | "gameMode">): number {
  const cells = config.boardWidth * config.boardHeight;
  const sizeFactor = Math.max(1, cells / REFERENCE_CELLS);
  const modeFactor = config.gameMode === "maze_race" || config.gameMode === "maze_harvest" ? MAZE_MODE_FACTOR : 1;
  return Math.min(WATCHDOG_MS * sizeFactor * modeFactor, WATCHDOG_ABSOLUTE_CAP_MS);
}

export function hasStalledTooLong(lastScoreAt: number, now: number, thresholdMs = WATCHDOG_MS): boolean {
  return now - lastScoreAt > thresholdMs;
}
