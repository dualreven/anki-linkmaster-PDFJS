/**
 * @file pdf-dest-utils 单元测试
 */

import { resolvePdfDest } from "../pdf-dest-utils.js";

describe("resolvePdfDest", () => {
  const makePdfDoc = (opts = {}) => ({
    getDestination: jest.fn(async (name) => {
      if (opts.namedError) { throw new Error("named error"); }
      if (name === "ch1") { return [{ num: 5, gen: 0 }, "XYZ", 0, 100, null]; }
      if (name === "ch2") { return [2, "FitH", null, null, null]; } // 0-based index=2 → page 3
      return null;
    }),
    getPageIndex: jest.fn(async (ref) => {
      if (opts.refError) { throw new Error("ref error"); }
      if (ref && typeof ref === "object" && ref.num === 5) { return 4; } // 0-based index=4 → page 5
      return 0;
    }),
  });

  test("dest: number (0-based index) → pageNumber = n + 1", async () => {
    const pdf = makePdfDoc();
    const { pageNumber, x, y, zoom } = await resolvePdfDest(pdf, 0);
    expect(pageNumber).toBe(1);
    expect(x).toBeNull();
    expect(y).toBeNull();
    expect(zoom).toBeNull();
  });

  test("dest: array with number pageRef → pageNumber = n + 1", async () => {
    const pdf = makePdfDoc();
    const { pageNumber } = await resolvePdfDest(pdf, [3, "XYZ", 10, 20, 1.5]);
    expect(pageNumber).toBe(4);
  });

  test("dest: array with object pageRef → pageNumber = getPageIndex(ref)+1", async () => {
    const pdf = makePdfDoc();
    const { pageNumber } = await resolvePdfDest(pdf, [{ num: 5, gen: 0 }, "XYZ", 10, 20, 1.5]);
    expect(pageNumber).toBe(5);
  });

  test("dest: named string → resolved then parse", async () => {
    const pdf = makePdfDoc();
    const r1 = await resolvePdfDest(pdf, "ch1");
    expect(r1.pageNumber).toBe(5);
    const r2 = await resolvePdfDest(pdf, "ch2");
    expect(r2.pageNumber).toBe(3);
  });

  test("throws on invalid dest", async () => {
    const pdf = makePdfDoc();
    await expect(resolvePdfDest(pdf, null)).rejects.toThrow();
    await expect(resolvePdfDest(null, 0)).rejects.toThrow();
    await expect(resolvePdfDest(pdf, {})).rejects.toThrow();
  });
});

