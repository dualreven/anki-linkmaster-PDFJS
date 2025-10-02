/**
 * @file PageCacheManager单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageCacheManager } from '../components/page-cache-manager.js';

describe('PageCacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new PageCacheManager({ maxCacheSize: 5 });
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(cacheManager).toBeDefined();
    });

    it('应该使用自定义maxCacheSize', () => {
      const custom = new PageCacheManager({ maxCacheSize: 20 });
      const stats = custom.getStats();
      expect(stats.maxCacheSize).toBe(20);
    });

    it('应该使用默认maxCacheSize', () => {
      const defaultManager = new PageCacheManager();
      const stats = defaultManager.getStats();
      expect(stats.maxCacheSize).toBe(10);
    });
  });

  describe('addPage', () => {
    it('应该添加页面到缓存', () => {
      const page = { number: 1 };
      cacheManager.addPage(1, page);

      expect(cacheManager.hasPage(1)).toBe(true);
    });

    it('应该在缓存满时移除LRU页面', () => {
      // 添加5个页面填满缓存
      for (let i = 1; i <= 5; i++) {
        cacheManager.addPage(i, { number: i });
      }

      // 访问第2-5页，使第1页成为LRU
      cacheManager.getPage(2);
      cacheManager.getPage(3);
      cacheManager.getPage(4);
      cacheManager.getPage(5);

      // 添加第6页应该移除第1页
      cacheManager.addPage(6, { number: 6 });

      expect(cacheManager.hasPage(1)).toBe(false);
      expect(cacheManager.hasPage(6)).toBe(true);
    });
  });

  describe('getPage', () => {
    it('应该返回缓存中的页面', () => {
      const page = { number: 1 };
      cacheManager.addPage(1, page);

      const result = cacheManager.getPage(1);
      expect(result).toBe(page);
    });

    it('不存在时应该返回null', () => {
      const result = cacheManager.getPage(999);
      expect(result).toBeNull();
    });

    it('应该更新访问时间', () => {
      cacheManager.addPage(1, { number: 1 });
      cacheManager.addPage(2, { number: 2 });

      // 先访问page 1
      cacheManager.getPage(1);

      // 填满缓存
      for (let i = 3; i <= 6; i++) {
        cacheManager.addPage(i, { number: i });
      }

      // page 1应该还在（因为最近访问过），page 2应该被移除
      expect(cacheManager.hasPage(1)).toBe(true);
      expect(cacheManager.hasPage(2)).toBe(false);
    });
  });

  describe('hasPage', () => {
    it('存在时应该返回true', () => {
      cacheManager.addPage(1, { number: 1 });
      expect(cacheManager.hasPage(1)).toBe(true);
    });

    it('不存在时应该返回false', () => {
      expect(cacheManager.hasPage(999)).toBe(false);
    });
  });

  describe('cleanupCache', () => {
    beforeEach(() => {
      // 添加页面1-10
      cacheManager = new PageCacheManager({ maxCacheSize: 15 });
      for (let i = 1; i <= 10; i++) {
        cacheManager.addPage(i, { number: i });
      }
    });

    it('应该保留指定范围内的页面', () => {
      cacheManager.cleanupCache(5, 2); // 保留3-7页

      expect(cacheManager.hasPage(3)).toBe(true);
      expect(cacheManager.hasPage(5)).toBe(true);
      expect(cacheManager.hasPage(7)).toBe(true);
    });

    it('应该移除范围外的页面', () => {
      cacheManager.cleanupCache(5, 2); // 保留3-7页

      expect(cacheManager.hasPage(1)).toBe(false);
      expect(cacheManager.hasPage(2)).toBe(false);
      expect(cacheManager.hasPage(8)).toBe(false);
      expect(cacheManager.hasPage(10)).toBe(false);
    });

    it('应该处理边界情况', () => {
      cacheManager.cleanupCache(1, 3); // 保留1-4页（但最小是1）

      expect(cacheManager.hasPage(1)).toBe(true);
      expect(cacheManager.hasPage(4)).toBe(true);
      expect(cacheManager.hasPage(5)).toBe(false);
    });
  });

  describe('getPagesToPreload', () => {
    it('应该返回未缓存的页面集合', () => {
      cacheManager.addPage(2, { number: 2 });
      cacheManager.addPage(4, { number: 4 });

      const toLoad = cacheManager.getPagesToPreload(1, 5);

      expect(toLoad.has(1)).toBe(true);
      expect(toLoad.has(2)).toBe(false); // 已缓存
      expect(toLoad.has(3)).toBe(true);
      expect(toLoad.has(4)).toBe(false); // 已缓存
      expect(toLoad.has(5)).toBe(true);
    });

    it('全部已缓存时应该返回空集合', () => {
      for (let i = 1; i <= 5; i++) {
        cacheManager.addPage(i, { number: i });
      }

      const toLoad = cacheManager.getPagesToPreload(1, 5);
      expect(toLoad.size).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('应该清空所有缓存', () => {
      for (let i = 1; i <= 5; i++) {
        cacheManager.addPage(i, { number: i });
      }

      cacheManager.clearAll();

      const stats = cacheManager.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.cachedPages).toEqual([]);
    });

    it('应该调用页面的cleanup方法', () => {
      const page = {
        number: 1,
        cleanup: jest.fn()
      };

      cacheManager.addPage(1, page);
      cacheManager.clearAll();

      expect(page.cleanup).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      cacheManager.addPage(3, { number: 3 });
      cacheManager.addPage(1, { number: 1 });
      cacheManager.addPage(2, { number: 2 });

      const stats = cacheManager.getStats();

      expect(stats.cacheSize).toBe(3);
      expect(stats.maxCacheSize).toBe(5);
      expect(stats.cachedPages).toEqual([1, 2, 3]); // 应该排序
    });
  });

  describe('destroy', () => {
    it('应该清空所有缓存并清理资源', () => {
      for (let i = 1; i <= 3; i++) {
        cacheManager.addPage(i, { number: i });
      }

      cacheManager.destroy();

      const stats = cacheManager.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });
});
