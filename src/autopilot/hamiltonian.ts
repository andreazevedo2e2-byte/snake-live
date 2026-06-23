import type { Vec2 } from "../game/types";

/**
 * Builds a Hamiltonian cycle over a width x height grid: an ordering that
 * visits every cell exactly once and returns to the start, with consecutive
 * cells always grid-adjacent. A snake that follows this order can never trap
 * itself, so it is guaranteed to eventually fill the board and win.
 *
 * Returns an array indexed by cell (y*width + x) giving each cell's position
 * in the cycle. Requires an even number of cells (otherwise no cycle exists
 * on a grid, which is bipartite); throws if given an odd-odd board.
 */
export function buildCycleOrder(width: number, height: number): number[] {
  if (height % 2 === 0) return buildRowMajor(width, height);
  if (width % 2 === 0) return buildColMajor(width, height);
  throw new Error("Hamiltonian cycle requires an even number of cells");
}

// Zig-zag the columns 1..w-1 across the rows, then return up column 0.
// Valid when height is even (so the last row ends next to the return column).
function buildRowMajor(w: number, h: number): number[] {
  const order = new Array<number>(w * h);
  let idx = 0;
  for (let y = 0; y < h; y++) {
    if (y % 2 === 0) {
      for (let x = 1; x < w; x++) order[y * w + x] = idx++;
    } else {
      for (let x = w - 1; x >= 1; x--) order[y * w + x] = idx++;
    }
  }
  for (let y = h - 1; y >= 0; y--) order[y * w] = idx++;
  return order;
}

// Transpose of the above, for an odd height but even width.
function buildColMajor(w: number, h: number): number[] {
  const order = new Array<number>(w * h);
  let idx = 0;
  for (let x = 0; x < w; x++) {
    if (x % 2 === 0) {
      for (let y = 1; y < h; y++) order[y * w + x] = idx++;
    } else {
      for (let y = h - 1; y >= 1; y--) order[y * w + x] = idx++;
    }
  }
  for (let x = w - 1; x >= 0; x--) order[x] = idx++;
  return order;
}

export function cycleIndex(order: number[], pos: Vec2, width: number): number {
  return order[pos.y * width + pos.x]!;
}
