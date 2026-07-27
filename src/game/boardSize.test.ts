import { describe, expect, test } from "vitest";
import { normalizeOddDimensions } from "./boardSize";

describe("normalizeOddDimensions", () => {
  test("bumps an odd×odd board up to the next even height", () => {
    expect(normalizeOddDimensions(9, 7, 24)).toEqual({ width: 9, height: 8 });
  });

  test("leaves an already-valid board (at least one even dimension) untouched", () => {
    expect(normalizeOddDimensions(10, 8, 24)).toEqual({ width: 10, height: 8 });
    expect(normalizeOddDimensions(9, 8, 24)).toEqual({ width: 9, height: 8 });
    expect(normalizeOddDimensions(10, 7, 24)).toEqual({ width: 10, height: 7 });
  });

  test("bumps down instead when bumping up would exceed the max height", () => {
    expect(normalizeOddDimensions(9, 23, 23)).toEqual({ width: 9, height: 22 });
  });

  test("handles the documented board-size edge cases (8–36 wide, 6–24 tall)", () => {
    expect(normalizeOddDimensions(8, 6, 24)).toEqual({ width: 8, height: 6 });
    expect(normalizeOddDimensions(35, 23, 24)).toEqual({ width: 35, height: 24 });
    expect(normalizeOddDimensions(9, 6, 24)).toEqual({ width: 9, height: 6 });
  });
});
