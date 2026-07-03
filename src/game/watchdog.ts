/** A healthy round always keeps scoring well within this window. If it
 * doesn't (an unforeseen autopilot bug traps the snake), the round should
 * force a theatrical loss and restart rather than freezing the stream —
 * measured in wall-clock time so it fires consistently regardless of tick
 * rate or speed multiplier. */
export const WATCHDOG_MS = 90000;

export function hasStalledTooLong(lastScoreAt: number, now: number, thresholdMs = WATCHDOG_MS): boolean {
  return now - lastScoreAt > thresholdMs;
}
