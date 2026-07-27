/** The autopilot's open-board strategy (any wall-free mode) relies on a
 * Hamiltonian cycle, which needs at least one even board dimension
 * (buildCycleOrder in autopilot/hamiltonian.ts throws otherwise). A
 * width×height that are both odd doesn't crash — decideMove just silently
 * falls back to weaker heuristics — so the settings panel should never let
 * that combination through in the first place. Bumps height up by 1 (to the
 * next even number); if that would exceed maxHeight, bumps it down instead
 * (still even, since an odd number ± 1 is always even). Width is untouched:
 * either dimension being even is enough. */
export function normalizeOddDimensions(width: number, height: number, maxHeight: number): { width: number; height: number } {
  if (width % 2 === 0 || height % 2 === 0) return { width, height };
  const bumpedUp = height + 1;
  return { width, height: bumpedUp <= maxHeight ? bumpedUp : height - 1 };
}
