/**
 * URLParamsParser单元测试
 * @file url-params-parser.test.js
 *
 * 注意：URL 参数跳转功能已移除，现在只解析 pdf-id 和 title 参数
 */

import { URLParamsParser } from "../components/url-params-parser.js";

describe("URLParamsParser", () => {
  describe("parse()", () => {
    test("解析包含 pdf-id 的URL", () => {
      const url = "http://localhost:3000/?pdf-id=sample";
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: "sample",
        title: null,
        hasParams: true,
      });
    });

    test("解析包含 pdf-id 和 title 的URL", () => {
      const url = "http://localhost:3000/?pdf-id=document&title=My%20Document";
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBe("document");
      expect(result.title).toBe("My Document");
      expect(result.hasParams).toBe(true);
    });

    test("解析不含任何参数的URL", () => {
      const url = "http://localhost:3000/";
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: null,
        title: null,
        hasParams: false,
      });
    });

    test("解析包含特殊字符的 pdf-id", () => {
      const url = "http://localhost:3000/?pdf-id=my-document_2024";
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBe("my-document_2024");
    });

    test("解析包含中文的 title", () => {
      const url = "http://localhost:3000/?pdf-id=doc&title=%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98";
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBe("doc");
      expect(result.title).toBe("中文标题");
    });

    test("处理无效URL时返回错误", () => {
      const url = "not-a-valid-url";
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBeNull();
      expect(result.title).toBeNull();
      expect(result.hasParams).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("忽略已废弃的导航参数（page-at, position等）", () => {
      const url = "http://localhost:3000/?pdf-id=test&page-at=5&position=50&anchor-id=abc";
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBe("test");
      expect(result.title).toBeNull();
      expect(result.hasParams).toBe(true);
      // 不应包含已废弃的参数
      expect(result.pageAt).toBeUndefined();
      expect(result.position).toBeUndefined();
      expect(result.anchorId).toBeUndefined();
    });
  });

  describe("validate()", () => {
    test("验证包含有效 pdf-id 的参数", () => {
      const params = { pdfId: "sample" };
      const result = URLParamsParser.validate(params);

      expect(result).toEqual({
        isValid: true,
        errors: [],
        warnings: [],
      });
    });

    test("验证空的 pdf-id（可选）", () => {
      const params = { pdfId: null };
      const result = URLParamsParser.validate(params);

      // pdfId 是可选的，所以 null 也是有效的
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("验证空字符串 pdf-id", () => {
      const params = { pdfId: "   " };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("pdf-id 必须是非空字符串");
    });

    test("验证包含路径分隔符的 pdf-id", () => {
      const params = { pdfId: "../folder/file" };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("pdf-id 不能包含路径分隔符");
    });

    test("验证包含反斜杠的 pdf-id", () => {
      const params = { pdfId: "..\\folder\\file" };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("pdf-id 不能包含路径分隔符");
    });

    test("验证合法的特殊字符 pdf-id", () => {
      const params = { pdfId: "my-document_2024" };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("normalize()", () => {
    test("标准化正常参数（无需修改）", () => {
      const params = { pdfId: "test", title: "Test Document" };
      const result = URLParamsParser.normalize(params);

      expect(result).toEqual(params);
    });

    test("标准化 null 值参数（不修改）", () => {
      const params = { pdfId: "test", title: null };
      const result = URLParamsParser.normalize(params);

      expect(result.pdfId).toBe("test");
      expect(result.title).toBeNull();
    });
  });

  describe("buildQueryString()", () => {
    test("构建包含 pdf-id 的查询字符串", () => {
      const params = { pdfId: "sample" };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe("pdf-id=sample");
    });

    test("构建包含 pdf-id 和 title 的查询字符串", () => {
      const params = { pdfId: "document", title: "My Document" };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe("pdf-id=document&title=My+Document");
    });

    test("忽略 null 值参数", () => {
      const params = { pdfId: "test", title: null };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe("pdf-id=test");
    });

    test("处理特殊字符的URL编码", () => {
      const params = { pdfId: "my document", title: "文档标题" };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toContain("my+document");
      expect(result).toContain("%E6%96%87%E6%A1%A3%E6%A0%87%E9%A2%98");
    });

    test("构建空参数对象时返回空字符串", () => {
      const params = { pdfId: null, title: null };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe("");
    });
  });
});
