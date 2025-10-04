/**
 * @file 书签存储抽象层
 * @module features/pdf-bookmark/services/bookmark-storage
 * @description 提供书签存储接口，方便将来切换存储方式
 */

import { getLogger } from '../../../../common/utils/logger.js';

/**
 * 书签存储接口（抽象基类）
 * @interface IBookmarkStorage
 */
export class IBookmarkStorage {
  /**
   * 加载书签数据
   * @param {string} pdfId - PDF文档ID
   * @returns {Promise<{bookmarks: Array, rootIds: Array}|null>}
   * @abstract
   */
  async load(pdfId) {
    throw new Error('IBookmarkStorage.load() must be implemented');
  }

  /**
   * 保存书签数据
   * @param {string} pdfId - PDF文档ID
   * @param {Array} bookmarks - 书签数组
   * @param {Array} rootIds - 根级书签ID数组
   * @returns {Promise<void>}
   * @abstract
   */
  async save(pdfId, bookmarks, rootIds) {
    throw new Error('IBookmarkStorage.save() must be implemented');
  }

  /**
   * 清空书签数据
   * @param {string} pdfId - PDF文档ID
   * @returns {Promise<void>}
   * @abstract
   */
  async clear(pdfId) {
    throw new Error('IBookmarkStorage.clear() must be implemented');
  }
}

/**
 * LocalStorage 书签存储实现
 * @class LocalStorageBookmarkStorage
 * @implements {IBookmarkStorage}
 */
export class LocalStorageBookmarkStorage extends IBookmarkStorage {
  #logger;
  #storageKeyPrefix = 'pdf-viewer-bookmarks-';

  constructor() {
    super();
    this.#logger = getLogger('LocalStorageBookmarkStorage');
  }

  /**
   * 从LocalStorage加载书签
   * @param {string} pdfId - PDF文档ID
   * @returns {Promise<{bookmarks: Array, rootIds: Array}|null>}
   */
  async load(pdfId) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      this.#logger.info(`📖 Loading bookmarks from localStorage: key=${storageKey}`);

      const data = localStorage.getItem(storageKey);
      if (!data) {
        this.#logger.info(`❌ No bookmarks found in localStorage for key: ${storageKey}`);
        return null;
      }

      const parsed = JSON.parse(data);
      this.#logger.info(`✅ Found stored data: ${parsed.bookmarks.length} bookmarks, ${parsed.rootIds.length} root IDs`);

      return {
        bookmarks: parsed.bookmarks || [],
        rootIds: parsed.rootIds || []
      };
    } catch (error) {
      this.#logger.error('Failed to load bookmarks from localStorage:', error);
      return null;
    }
  }

  /**
   * 保存书签到LocalStorage
   * @param {string} pdfId - PDF文档ID
   * @param {Array} bookmarks - 书签数组
   * @param {Array} rootIds - 根级书签ID数组
   * @returns {Promise<void>}
   */
  async save(pdfId, bookmarks, rootIds) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      const data = {
        bookmarks,
        rootIds,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
      this.#logger.info(`✅ Bookmarks saved to localStorage: key=${storageKey}, count=${bookmarks.length}`);
    } catch (error) {
      this.#logger.error('Failed to save bookmarks to localStorage:', error);
      throw error;
    }
  }

  /**
   * 清空LocalStorage中的书签
   * @param {string} pdfId - PDF文档ID
   * @returns {Promise<void>}
   */
  async clear(pdfId) {
    try {
      const storageKey = `${this.#storageKeyPrefix}${pdfId}`;
      localStorage.removeItem(storageKey);
      this.#logger.info(`✅ Bookmarks cleared from localStorage: key=${storageKey}`);
    } catch (error) {
      this.#logger.error('Failed to clear bookmarks from localStorage:', error);
      throw error;
    }
  }
}

/**
 * 创建默认的书签存储实例
 * @returns {IBookmarkStorage}
 */
export function createDefaultBookmarkStorage() {
  return new LocalStorageBookmarkStorage();
}

export default {
  IBookmarkStorage,
  LocalStorageBookmarkStorage,
  createDefaultBookmarkStorage
};
