/**
 * URLParamsParser单元测试
 * @file url-params-parser.test.js
 */

import { URLParamsParser } from '../components/url-params-parser.js';

describe('URLParamsParser', () => {
  describe('parse()', () => {
    test('解析完整的URL参数', () => {
      const url = 'http://localhost:3000/?pdf-id=sample&page-at=5&position=50';
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: 'sample',
        pageAt: 5,
        position: 50,
        hasParams: true,
      });
    });

    test('解析只有pdf-id的URL', () => {
      const url = 'http://localhost:3000/?pdf-id=document';
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: 'document',
        pageAt: null,
        position: null,
        hasParams: true,
      });
    });

    test('解析包含page-at但无position的URL', () => {
      const url = 'http://localhost:3000/?pdf-id=test&page-at=10';
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: 'test',
        pageAt: 10,
        position: null,
        hasParams: true,
      });
    });

    test('解析无导航参数的URL', () => {
      const url = 'http://localhost:3000/';
      const result = URLParamsParser.parse(url);

      expect(result).toEqual({
        pdfId: null,
        pageAt: null,
        position: null,
        hasParams: false,
      });
    });

    test('解析包含小数position的URL', () => {
      const url = 'http://localhost:3000/?pdf-id=test&position=75.5';
      const result = URLParamsParser.parse(url);

      expect(result.position).toBe(75.5);
    });

    test('解析无效的page-at参数（非数字）', () => {
      const url = 'http://localhost:3000/?pdf-id=test&page-at=abc';
      const result = URLParamsParser.parse(url);

      expect(result.pageAt).toBeNaN();
    });

    test('解析包含特殊字符的pdf-id', () => {
      const url = 'http://localhost:3000/?pdf-id=my-document_2024';
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBe('my-document_2024');
    });

    test('处理无效URL时返回错误', () => {
      const url = 'not-a-valid-url';
      const result = URLParamsParser.parse(url);

      expect(result.pdfId).toBeNull();
      expect(result.hasParams).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validate()', () => {
    test('验证有效的完整参数', () => {
      const params = { pdfId: 'sample', pageAt: 5, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result).toEqual({
        isValid: true,
        errors: [],
        warnings: [],
      });
    });

    test('验证缺少pdf-id的参数', () => {
      const params = { pdfId: null, pageAt: 5, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('缺少必填参数: pdf-id');
    });

    test('验证空字符串pdf-id', () => {
      const params = { pdfId: '   ', pageAt: 5, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('pdf-id 必须是非空字符串');
    });

    test('验证包含路径分隔符的pdf-id', () => {
      const params = { pdfId: '../folder/file', pageAt: 5, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('pdf-id 不能包含路径分隔符');
    });

    test('验证非整数的page-at', () => {
      const params = { pdfId: 'test', pageAt: 5.5, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('page-at 必须是整数');
    });

    test('验证小于1的page-at', () => {
      const params = { pdfId: 'test', pageAt: 0, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('page-at 必须大于等于1');
    });

    test('验证过大的page-at（警告）', () => {
      const params = { pdfId: 'test', pageAt: 15000, position: 50 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('page-at 超过10000，可能超出PDF总页数');
    });

    test('验证position超出范围', () => {
      const params = { pdfId: 'test', pageAt: 5, position: 150 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('position 必须在0-100之间');
    });

    test('验证负数position', () => {
      const params = { pdfId: 'test', pageAt: 5, position: -10 };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('position 必须在0-100之间');
    });

    test('验证只有pdf-id的参数（可选参数为null）', () => {
      const params = { pdfId: 'test', pageAt: null, position: null };
      const result = URLParamsParser.validate(params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('normalize()', () => {
    test('标准化正常参数（无需修改）', () => {
      const params = { pdfId: 'test', pageAt: 5, position: 50 };
      const result = URLParamsParser.normalize(params);

      expect(result).toEqual(params);
    });

    test('标准化小于1的pageAt', () => {
      const params = { pdfId: 'test', pageAt: 0, position: 50 };
      const result = URLParamsParser.normalize(params);

      expect(result.pageAt).toBe(1);
    });

    test('标准化超出最大页数的pageAt', () => {
      const params = { pdfId: 'test', pageAt: 100, position: 50 };
      const result = URLParamsParser.normalize(params, { maxPages: 10 });

      expect(result.pageAt).toBe(10);
    });

    test('标准化负数position', () => {
      const params = { pdfId: 'test', pageAt: 5, position: -10 };
      const result = URLParamsParser.normalize(params);

      expect(result.position).toBe(0);
    });

    test('标准化超过100的position', () => {
      const params = { pdfId: 'test', pageAt: 5, position: 150 };
      const result = URLParamsParser.normalize(params);

      expect(result.position).toBe(100);
    });

    test('标准化null值参数（不修改）', () => {
      const params = { pdfId: 'test', pageAt: null, position: null };
      const result = URLParamsParser.normalize(params);

      expect(result.pageAt).toBeNull();
      expect(result.position).toBeNull();
    });
  });

  describe('buildQueryString()', () => {
    test('构建完整参数的查询字符串', () => {
      const params = { pdfId: 'sample', pageAt: 5, position: 50 };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe('pdf-id=sample&page-at=5&position=50');
    });

    test('构建只有pdf-id的查询字符串', () => {
      const params = { pdfId: 'document' };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe('pdf-id=document');
    });

    test('构建包含page-at但无position的查询字符串', () => {
      const params = { pdfId: 'test', pageAt: 10 };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe('pdf-id=test&page-at=10');
    });

    test('忽略null值参数', () => {
      const params = { pdfId: 'test', pageAt: null, position: null };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toBe('pdf-id=test');
    });

    test('处理特殊字符的URL编码', () => {
      const params = { pdfId: 'my document with spaces' };
      const result = URLParamsParser.buildQueryString(params);

      expect(result).toContain('my+document+with+spaces');
    });
  });
});
