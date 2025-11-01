/**
 * @file BookmarkDataProvider.parseDestination 测试（验证 numeric 分支 +1 与命名目的地解析）
 */

import { BookmarkDataProvider } from "../bookmark-data-provider.js";

describe("BookmarkDataProvider.parseDestination", () => {
  test("numeric and named destinations are parsed with +1 where needed", async () => {
    const pdfDoc = {
      getOutline: jest.fn(async () => []), // ensure getBookmarks works
      getDestination: jest.fn(async (name) => {
        if (name === "nm") {return [2, "XYZ", 0, 0, null];} // 0-based index 2 -> page 3
        return null;
      }),
      getPageIndex: jest.fn(async (ref) => {
        if (ref && typeof ref === "object") {return 4;} // -> page 5
        return 0;
      }),
    };

    const provider = new BookmarkDataProvider();
    await provider.getBookmarks(pdfDoc); // sets internal pdfDocument reference

    // numeric pageRef (0-based index)
    const r1 = await provider.parseDestination([0, "XYZ", null, null, null]);
    expect(r1.pageNumber).toBe(1);

    // object pageRef -> getPageIndex + 1
    const r2 = await provider.parseDestination([{ num: 5, gen: 0 }, "XYZ", 10, 20, null]);
    expect(r2.pageNumber).toBe(5);

    // named destination -> resolve then +1
    const r3 = await provider.parseDestination("nm");
    expect(r3.pageNumber).toBe(3);
  });
});
