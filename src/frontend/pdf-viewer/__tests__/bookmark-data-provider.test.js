/**
 * @file BookmarkDataProvider 测试
 */

import { BookmarkDataProvider } from '../bookmark/bookmark-data-provider.js';

describe('BookmarkDataProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new BookmarkDataProvider();
  });

  test('getBookmarks 将 outline 转换为标准结构', async () => {
    const mockPdf = {
      getOutline: jest.fn().mockResolvedValue([
        { title: 'A', dest: ['refA', { name: 'XYZ' }, 0, 0, null], items: [
          { title: 'A.1', dest: ['refA1', { name: 'XYZ' }, 10, 20, 1.2], items: [] }
        ]},
        { title: 'B', dest: ['refB', { name: 'XYZ' }, 0, 0, null], items: [] }
      ])
    };

    const result = await provider.getBookmarks(mockPdf);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('A');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].title).toBe('A.1');
    expect(result[0].level).toBe(0);
    expect(result[0].items[0].level).toBe(1);
    expect(result[1].title).toBe('B');
  });

  test('getBookmarks 在无书签时返回空数组', async () => {
    const mockPdf = { getOutline: jest.fn().mockResolvedValue(null) };
    const result = await provider.getBookmarks(mockPdf);
    expect(result).toEqual([]);
  });

  test('parseDestination 解析命名目的地与页码', async () => {
    const pageRefObj = { ref: 'p5' };
    const mockPdf = {
      getOutline: jest.fn(),
      getDestination: jest.fn().mockResolvedValue([pageRefObj, { name: 'XYZ' }, 15, 30, 2.0]),
      getPageIndex: jest.fn().mockResolvedValue(4) // 0-based → page 5
    };

    // 先获取书签使 provider 记录 pdfDocument
    await provider.getBookmarks({ getOutline: jest.fn().mockResolvedValue([]) });
    // 手动设定内部 pdfDocument（通过再次调用 getBookmarks）
    await provider.getBookmarks(mockPdf);

    const dest = await provider.parseDestination('Section5');
    expect(dest.pageNumber).toBe(5);
    expect(dest.x).toBe(15);
    expect(dest.y).toBe(30);
    expect(dest.zoom).toBe(2.0);
  });

  test('parseDestination 直接数组目的地', async () => {
    const mockPdf = {
      getOutline: jest.fn(),
      getPageIndex: jest.fn()
    };
    await provider.getBookmarks(mockPdf);

    const result = await provider.parseDestination([7, { name: 'XYZ' }, 0, 100, null]);
    expect(result.pageNumber).toBe(7);
    expect(result.y).toBe(100);
  });

  test('parseDestination 缺少参数抛错', async () => {
    await expect(provider.parseDestination()).rejects.toThrow('Destination is required');
  });
});

