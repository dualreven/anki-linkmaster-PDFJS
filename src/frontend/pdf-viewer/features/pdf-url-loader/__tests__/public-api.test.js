/* @jest-environment jsdom */
// 防止 logger 导入引发 import.meta 解析
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

import { URLParamsParser } from "../components/url-params-parser.js";

describe("url-navigation/public API", () => {
  beforeEach(() => {
    // 初始化 window.location
    window.history.pushState({}, "", "/pdf-viewer/");
  });

  test("URLParamsParser.parse(url) 解析完整参数", () => {
    const url = "http://localhost/pdf-viewer/?pdf-id=doc-001&title=sample";
    const result = URLParamsParser.parse(url);
    expect(result).toEqual(
      expect.objectContaining({
        pdfId: "doc-001",
        title: "sample",
        hasParams: true,
      })
    );
  });

  test("URLParamsParser.parse() 默认读取 window.location", () => {
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=abc&title=test");
    const result = URLParamsParser.parse();
    expect(result.pdfId).toBe("abc");
    expect(result.title).toBe("test");
  });

  test("URLParamsParser.validate 返回 isValid 布尔值与错误/警告数组", () => {
    const valid = URLParamsParser.validate({ pdfId: "abc" });
    expect(typeof valid.isValid).toBe("boolean");
    expect(Array.isArray(valid.errors)).toBe(true);
    expect(Array.isArray(valid.warnings)).toBe(true);
  });
});

