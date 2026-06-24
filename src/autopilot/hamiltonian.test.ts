import { describe, expect, test } from "vitest";
import { buildCycleOrder, cycleIndex, availableVariants, type CycleVariant } from "./hamiltonian";
import type { Vec2 } from "../game/types";

function cellAt(order: number[], index: number, width: number): Vec2 {
  const cell = order.findIndex((v) => v === index);
  return { x: cell % width, y: Math.floor(cell / width) };
}

function assertValidCycle(width: number, height: number, variant: CycleVariant): void {
  const order = buildCycleOrder(width, height, variant);
  const n = width * height;
  expect(order.length).toBe(n);
  expect(new Set(order).size).toBe(n); // permutation: every index used exactly once

  for (let i = 0; i < n; i++) {
    const a = cellAt(order, i, width);
    const b = cellAt(order, (i + 1) % n, width);
    const manhattan = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(manhattan).toBe(1); // consecutive cycle cells are always grid-adjacent
  }
}

describe("buildCycleOrder", () => {
  test.each([
    [6, 6, "row"],
    [8, 8, "row"],
    [8, 8, "col"],
    [10, 8, "row"],
    [10, 8, "row-flip"],
    [10, 8, "row-reverse"],
    [10, 8, "row-flip-reverse"],
    [10, 8, "col"],
    [10, 8, "col-flip"],
    [10, 8, "col-reverse"],
    [10, 8, "col-flip-reverse"],
  ] as const)("produces a valid Hamiltonian cycle for %ix%i (%s)", (w, h, variant) => {
    assertValidCycle(w, h, variant);
  });

  test("row and row-flip produce geometrically different orderings", () => {
    const row = buildCycleOrder(10, 8, "row");
    const flipped = buildCycleOrder(10, 8, "row-flip");
    expect(row).not.toEqual(flipped);
  });

  test("row and col variants produce geometrically different orderings", () => {
    const row = buildCycleOrder(8, 8, "row");
    const col = buildCycleOrder(8, 8, "col");
    expect(row).not.toEqual(col);
  });
});

describe("availableVariants", () => {
  test("a board with both even dimensions supports all four variants", () => {
    expect(availableVariants(10, 8).sort()).toEqual([
      "col",
      "col-flip",
      "col-flip-reverse",
      "col-reverse",
      "row",
      "row-flip",
      "row-flip-reverse",
      "row-reverse",
    ]);
  });
});

describe("cycleIndex", () => {
  test("maps a position back to its place in the cycle order", () => {
    const order = buildCycleOrder(4, 2, "row");
    expect(cycleIndex(order, { x: 0, y: 0 }, 4)).toBe(order[0]);
    expect(cycleIndex(order, { x: 3, y: 1 }, 4)).toBe(order[2 * 4 - 1]);
  });
});
