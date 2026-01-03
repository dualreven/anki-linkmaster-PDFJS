/* @jest-environment jsdom */
import { describe, test, expect } from "@jest/globals";
import { formatHHMM, normalizeStoredPositionToPercent, normalizePercentToStoredPosition } from "../anchor-utils.js";

describe("pdf-anchor/anchor-utils", () => {
  test("formatHHMM formats HH:MM with zero padding", () => {
    const d = new Date(2026, 0, 3, 5, 7, 0);
    expect(formatHHMM(d)).toBe("05:07");
  });

  test("normalizeStoredPositionToPercent converts 0..1 to 0..100 percent", () => {
    expect(normalizeStoredPositionToPercent(0.5)).toBe(50);
    expect(normalizeStoredPositionToPercent(1)).toBe(100);
  });

  test("normalizeStoredPositionToPercent keeps 0..100 as percent and clamps", () => {
    expect(normalizeStoredPositionToPercent(30)).toBe(30);
    expect(normalizeStoredPositionToPercent(120)).toBe(100);
    expect(normalizeStoredPositionToPercent(-10)).toBe(0);
  });

  test("normalizePercentToStoredPosition converts percent to 0..1 and clamps", () => {
    expect(normalizePercentToStoredPosition(50)).toBe(0.5);
    expect(normalizePercentToStoredPosition(120)).toBe(1);
    expect(normalizePercentToStoredPosition(-10)).toBe(0);
  });
});
