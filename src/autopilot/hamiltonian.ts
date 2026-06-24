import type { Vec2 } from "../game/types";

export type CycleVariant =
  | "row"
  | "row-flip"
  | "row-reverse"
  | "row-flip-reverse"
  | "col"
  | "col-flip"
  | "col-reverse"
  | "col-flip-reverse";

/**
 * Builds a Hamiltonian cycle over a width x height grid: an ordering that
 * visits every cell exactly once and returns to the start, with consecutive
 * cells always grid-adjacent. Used only as a last-resort safety net once the
 * board is too full for greedy play — following it guarantees the snake can
 * never trap itself. Four geometrically distinct variants are available so
 * different rounds don't all converge on the same visual sweep.
 *
 * Returns an array indexed by cell (y*width + x) giving each cell's position
 * in the cycle. A row/row-flip cycle needs an even height; a col/col-flip
 * cycle needs an even width. Throws if the requested variant doesn't fit.
 */
export function buildCycleOrder(width: number, height: number, variant: CycleVariant = "row"): number[] {
  if (variant.startsWith("row") && height % 2 === 0) {
    const order = buildRowMajor(width, height);
    const flipped = variant.includes("flip") ? flipX(order, width, height) : order;
    return variant.includes("reverse") ? reverseOrder(flipped) : flipped;
  }
  if (variant.startsWith("col") && width % 2 === 0) {
    const order = buildColMajor(width, height);
    const flipped = variant.includes("flip") ? flipY(order, width, height) : order;
    return variant.includes("reverse") ? reverseOrder(flipped) : flipped;
  }
  // Fall back to whichever orientation the board actually supports.
  if (height % 2 === 0) return buildRowMajor(width, height);
  if (width % 2 === 0) return buildColMajor(width, height);
  throw new Error("Hamiltonian cycle requires an even width or height");
}

export function availableVariants(width: number, height: number): CycleVariant[] {
  const out: CycleVariant[] = [];
  if (height % 2 === 0) out.push("row", "row-flip", "row-reverse", "row-flip-reverse");
  if (width % 2 === 0) out.push("col", "col-flip", "col-reverse", "col-flip-reverse");
  return out;
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

function flipX(order: number[], w: number, h: number): number[] {
  const out = new Array<number>(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + (w - 1 - x)] = order[y * w + x]!;
    }
  }
  return out;
}

function flipY(order: number[], w: number, h: number): number[] {
  const out = new Array<number>(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[(h - 1 - y) * w + x] = order[y * w + x]!;
    }
  }
  return out;
}

function reverseOrder(order: number[]): number[] {
  const n = order.length;
  return order.map((value) => (n - value) % n);
}

export function cycleIndex(order: number[], pos: Vec2, width: number): number {
  return order[pos.y * width + pos.x]!;
}
