import { describe, test, expect } from "vitest";
import { buildCycleOrder, cycleIndex } from "./hamiltonian";

function isAdjacent(a: number, b: number, w: number): boolean {
  const ax = a % w, ay = Math.floor(a / w);
  const bx = b % w, by = Math.floor(b / w);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

describe("buildCycleOrder", () => {
  for (const [w, h] of [[4, 2], [6, 6], [8, 8], [10, 10], [10, 8]] as const) {
    test(`produces a valid Hamiltonian cycle on ${w}x${h}`, () => {
      const order = buildCycleOrder(w, h);
      const n = w * h;
      expect(order).toHaveLength(n);

      // Every cell has a unique position 0..n-1 (a permutation).
      expect(new Set(order).size).toBe(n);
      expect(Math.min(...order)).toBe(0);
      expect(Math.max(...order)).toBe(n - 1);

      // Cells consecutive in the cycle (including the wrap n-1 -> 0) are grid-neighbors.
      const cellAt = new Array<number>(n);
      order.forEach((pos, cell) => (cellAt[pos] = cell));
      for (let pos = 0; pos < n; pos++) {
        const here = cellAt[pos]!;
        const next = cellAt[(pos + 1) % n]!;
        expect(isAdjacent(here, next, w)).toBe(true);
      }
    });
  }
});

describe("cycleIndex", () => {
  test("maps (x,y) to its position in the cycle order", () => {
    const w = 4, h = 2;
    const order = buildCycleOrder(w, h);
    expect(cycleIndex(order, { x: 0, y: 0 }, w)).toBe(order[0]);
    expect(cycleIndex(order, { x: 3, y: 1 }, w)).toBe(order[1 * w + 3]);
  });
});
