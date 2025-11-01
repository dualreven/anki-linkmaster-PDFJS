/* @jest-environment jsdom */
// 防止 logger 导入引发 import.meta 解析
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

import { parseUrlParams, validateUrlParams } from "../public.js";

describe("url-navigation/public API", () => {
  beforeEach(() => {
    // 初始化 window.location
    window.history.pushState({}, "", "/pdf-viewer/");
  });

  test("parseUrlParams(url) 解析完整参数", () => {
    const url = "http://localhost/pdf-viewer/?pdf-id=doc-001&page-at=5&position=33.3&anchor-id=pdfanchor-1234567890ab&annotation-id=ann-xyz&outline-item-id=ol-abc";
    const result = parseUrlParams(url);
    expect(result).toEqual(
      expect.objectContaining({
        pdfId: "doc-001",
        pageAt: 5,
        position: 33.3,
        anchorId: "pdfanchor-1234567890ab",
        annotationId: "ann-xyz",
        outlineItemId: "ol-abc",
        hasParams: true,
      })
    );
  });

  test("parseUrlParams() 默认读取 window.location", () => {
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=abc&page-at=1");
    const result = parseUrlParams();
    expect(result.pdfId).toBe("abc");
    expect(result.pageAt).toBe(1);
  });

  test("validateUrlParams 返回 isValid 布尔值与错误/警告数组", () => {
    const valid = validateUrlParams({ pdfId: "abc", pageAt: 2, position: 50 });
    expect(typeof valid.isValid).toBe("boolean");
    expect(Array.isArray(valid.errors)).toBe(true);
    expect(Array.isArray(valid.warnings)).toBe(true);
  });
});

