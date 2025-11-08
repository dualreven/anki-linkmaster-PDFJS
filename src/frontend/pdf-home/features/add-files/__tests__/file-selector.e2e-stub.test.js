/**
 * @file 单测：E2EStubFileSelector 选择与结果
 * 仅验证 getFileSelector 的模式选择与返回数组，无需 PyQt/QWebChannel
 */
import { getFileSelector } from "../file-selector.js";

describe("FileSelector - E2E stub", () => {
  beforeEach(() => {
    // 清理全局并开启 E2E 测试模式
    delete global.window.__E2E_FILE_SELECTOR__;
    delete global.window.__E2E_TEST_FILES__;
    global.window.__E2E_FILE_SELECTOR__ = true;
  });

  test("returns files from __E2E_TEST_FILES__", async () => {
    global.window.__E2E_TEST_FILES__ = ["C:\\\\tmp\\\\a.pdf", "C:\\\\tmp\\\\b.pdf"];
    const selector = getFileSelector();
    const files = await selector.selectFiles();
    expect(Array.isArray(files)).toBe(true);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/a\.pdf$/i);
  });

  test("throws when __E2E_TEST_FILES__ missing or invalid", async () => {
    delete global.window.__E2E_TEST_FILES__;
    const selector = getFileSelector();
    await expect(selector.selectFiles()).rejects.toThrow(/E2EStubFileSelector/);
  });
});
