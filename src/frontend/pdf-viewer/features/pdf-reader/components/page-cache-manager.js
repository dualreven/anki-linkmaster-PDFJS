/**
 * @file PDF页面缓存管理器
 * @module PageCacheManager
 * @description 管理PDF页面的缓存，优化内存使用和页面访问性能
 */

import { getLogger } from "../../../../common/utils/logger.js";

/**
 * 页面缓存管理器类
 * 负责缓存已加载的PDF页面，提供智能的缓存策略
 */
export class PageCacheManager {
  #logger;
  #pagesCache = new Map();
  #maxCacheSize = 10; // 最大缓存页面数
  #accessHistory = new Map(); // 记录页面访问历史

  constructor(options = {}) {
    this.#logger = getLogger('PDFViewer.Cache');
    this.#maxCacheSize = options.maxCacheSize || 10;
  }

  /**
   * 添加页面到缓存
   * @param {number} pageNumber - 页码
   * @param {Object} page - 页面对象
   */
  addPage(pageNumber, page) {
    // 如果缓存已满，移除最少使用的页面
    if (this.#pagesCache.size >= this.#maxCacheSize && !this.#pagesCache.has(pageNumber)) {
      this.#evictLRUPage();
    }

    this.#pagesCache.set(pageNumber, page);
    this.#accessHistory.set(pageNumber, Date.now());
    this.#logger.debug(`Page ${pageNumber} added to cache`);
  }

  /**
   * 从缓存获取页面
   * @param {number} pageNumber - 页码
   * @returns {Object|null} 页面对象或null
   */
  getPage(pageNumber) {
    if (this.#pagesCache.has(pageNumber)) {
      // 更新访问时间
      this.#accessHistory.set(pageNumber, Date.now());
      this.#logger.debug(`Page ${pageNumber} retrieved from cache`);
      return this.#pagesCache.get(pageNumber);
    }
    return null;
  }

  /**
   * 检查页面是否在缓存中
   * @param {number} pageNumber - 页码
   * @returns {boolean}
   */
  hasPage(pageNumber) {
    return this.#pagesCache.has(pageNumber);
  }

  /**
   * 清理缓存，保留指定页面范围
   * @param {number} currentPage - 当前页码
   * @param {number} keepRange - 保留范围（前后各几页）
   */
  cleanupCache(currentPage, keepRange = 3) {
    if (!currentPage || this.#pagesCache.size === 0) {
      return;
    }

    const pagesToKeep = new Set();
    const minPage = Math.max(1, currentPage - keepRange);
    const maxPage = currentPage + keepRange;

    // 确定要保留的页面
    for (let i = minPage; i <= maxPage; i++) {
      pagesToKeep.add(i);
    }

    // 清理不在范围内的页面
    for (const [pageNumber, page] of this.#pagesCache.entries()) {
      if (!pagesToKeep.has(pageNumber)) {
        this.#removePage(pageNumber, page);
      }
    }

    this.#logger.info(`Cache cleaned, kept pages ${minPage}-${maxPage}`);
  }

  /**
   * 预加载页面范围
   * @param {number} startPage - 起始页码
   * @param {number} endPage - 结束页码
   * @returns {Set<number>} 需要加载的页码集合
   */
  getPagesToPreload(startPage, endPage) {
    const pagesToLoad = new Set();

    for (let i = startPage; i <= endPage; i++) {
      if (!this.#pagesCache.has(i)) {
        pagesToLoad.add(i);
      }
    }

    return pagesToLoad;
  }

  /**
   * 清空所有缓存
   */
  clearAll() {
    for (const [pageNumber, page] of this.#pagesCache.entries()) {
      this.#removePage(pageNumber, page);
    }
    this.#pagesCache.clear();
    this.#accessHistory.clear();
    this.#logger.info("All cache cleared");
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getStats() {
    return {
      cacheSize: this.#pagesCache.size,
      maxCacheSize: this.#maxCacheSize,
      cachedPages: Array.from(this.#pagesCache.keys()).sort((a, b) => a - b)
    };
  }

  /**
   * 移除最少使用的页面（LRU）
   * @private
   */
  #evictLRUPage() {
    let oldestPage = null;
    let oldestTime = Date.now();

    for (const [pageNumber, accessTime] of this.#accessHistory.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestPage = pageNumber;
      }
    }

    if (oldestPage !== null) {
      const page = this.#pagesCache.get(oldestPage);
      this.#removePage(oldestPage, page);
      this.#logger.debug(`Evicted LRU page ${oldestPage}`);
    }
  }

  /**
   * 移除页面并清理资源
   * @param {number} pageNumber - 页码
   * @param {Object} page - 页面对象
   * @private
   */
  #removePage(pageNumber, page) {
    if (page && page.cleanup) {
      try {
        page.cleanup();
      } catch (e) {
        this.#logger.warn(`Error cleaning up page ${pageNumber}:`, e);
      }
    }

    this.#pagesCache.delete(pageNumber);
    this.#accessHistory.delete(pageNumber);
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    this.clearAll();
  }
}
