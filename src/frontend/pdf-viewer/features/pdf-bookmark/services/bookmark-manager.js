/**
 * @file BookmarkManager 书签管理器
 * @module features/pdf-bookmark/services/bookmark-manager
 * @description 负责书签的 CRUD 操作和 LocalStorage 持久化
 */

import { Bookmark } from '../models/bookmark.js';
import { getLogger } from '../../../../common/utils/logger.js';

/**
 * BookmarkManager 书签管理类
 * @class BookmarkManager
 */
export class BookmarkManager {
  /**
   * 日志记录器
   * @type {import('../../../../common/utils/logger.js').Logger}
   * @private
   */
  #logger;

  /**
   * 事件总线
   * @type {Object}
   * @private
   */
  #eventBus;

  /**
   * 当前PDF的ID
   * @type {string}
   * @private
   */
  #pdfId;

  /**
   * 书签集合（Map<id, Bookmark>）
   * @type {Map<string, Bookmark>}
   * @private
   */
  #bookmarks = new Map();

  /**
   * 根级书签ID列表
   * @type {string[]}
   * @private
   */
  #rootBookmarkIds = [];

  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.eventBus - 事件总线
   * @param {string} options.pdfId - PDF文档ID
   */
  constructor({ eventBus, pdfId }) {
    this.#logger = getLogger('BookmarkManager');
    this.#eventBus = eventBus;
    this.#pdfId = pdfId;
  }

  /**
   * 初始化管理器（从LocalStorage加载）
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#logger.info(`Initializing BookmarkManager for PDF: ${this.#pdfId}`);
    await this.loadFromStorage();
    this.#logger.info(`Loaded ${this.#bookmarks.size} bookmarks`);
  }

  /**
   * 添加书签
   * @param {Object} bookmarkData - 书签数据
   * @returns {{success: boolean, bookmarkId?: string, error?: string}}
   */
  addBookmark(bookmarkData) {
    try {
      const bookmark = new Bookmark(bookmarkData);

      // 验证书签数据
      const validation = bookmark.validate();
      if (!validation.valid) {
        this.#logger.warn('Bookmark validation failed:', validation.errors);
        return {
          success: false,
          error: validation.errors.join('; ')
        };
      }

      // 添加到集合
      this.#bookmarks.set(bookmark.id, bookmark);

      // 如果是根级书签，添加到根列表
      if (!bookmark.parentId) {
        this.#rootBookmarkIds.push(bookmark.id);
      } else {
        // 如果有父书签，添加到父书签的children
        const parent = this.#bookmarks.get(bookmark.parentId);
        if (parent) {
          parent.addChild(bookmark);
        }
      }

      // 保存到存储
      this.saveToStorage();

      this.#logger.info(`Bookmark added: ${bookmark.id} (${bookmark.name})`);
      return {
        success: true,
        bookmarkId: bookmark.id
      };
    } catch (error) {
      this.#logger.error('Failed to add bookmark:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除书签
   * @param {string} bookmarkId - 书签ID
   * @param {boolean} [cascadeDelete=true] - 是否级联删除子书签
   * @returns {{success: boolean, deletedIds?: string[], error?: string}}
   */
  deleteBookmark(bookmarkId, cascadeDelete = true) {
    try {
      const bookmark = this.#bookmarks.get(bookmarkId);
      if (!bookmark) {
        return {
          success: false,
          error: `Bookmark not found: ${bookmarkId}`
        };
      }

      const deletedIds = [];

      // 级联删除子书签
      if (cascadeDelete && bookmark.children.length > 0) {
        const deleteChildren = (children) => {
          children.forEach(child => {
            if (child.children && child.children.length > 0) {
              deleteChildren(child.children);
            }
            this.#bookmarks.delete(child.id);
            deletedIds.push(child.id);
          });
        };
        deleteChildren(bookmark.children);
      }

      // 从父书签中移除
      if (bookmark.parentId) {
        const parent = this.#bookmarks.get(bookmark.parentId);
        if (parent) {
          parent.removeChild(bookmarkId);
        }
      } else {
        // 从根列表中移除
        const index = this.#rootBookmarkIds.indexOf(bookmarkId);
        if (index !== -1) {
          this.#rootBookmarkIds.splice(index, 1);
        }
      }

      // 删除书签本身
      this.#bookmarks.delete(bookmarkId);
      deletedIds.push(bookmarkId);

      // 保存到存储
      this.saveToStorage();

      this.#logger.info(`Bookmark deleted: ${bookmarkId}, total deleted: ${deletedIds.length}`);
      return {
        success: true,
        deletedIds
      };
    } catch (error) {
      this.#logger.error('Failed to delete bookmark:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新书签
   * @param {string} bookmarkId - 书签ID
   * @param {Object} updates - 要更新的字段
   * @returns {{success: boolean, updatedBookmark?: Bookmark, error?: string}}
   */
  updateBookmark(bookmarkId, updates) {
    try {
      const bookmark = this.#bookmarks.get(bookmarkId);
      if (!bookmark) {
        return {
          success: false,
          error: `Bookmark not found: ${bookmarkId}`
        };
      }

      // 更新书签
      bookmark.update(updates);

      // 验证更新后的数据
      const validation = bookmark.validate();
      if (!validation.valid) {
        this.#logger.warn('Updated bookmark validation failed:', validation.errors);
        return {
          success: false,
          error: validation.errors.join('; ')
        };
      }

      // 保存到存储
      this.saveToStorage();

      this.#logger.info(`Bookmark updated: ${bookmarkId}`);
      return {
        success: true,
        updatedBookmark: bookmark
      };
    } catch (error) {
      this.#logger.error('Failed to update bookmark:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 重新排序书签
   * @param {string} bookmarkId - 被移动的书签ID
   * @param {string|null} newParentId - 新的父书签ID（null表示移到根级）
   * @param {number} newIndex - 新的排序位置
   * @returns {{success: boolean, error?: string}}
   */
  reorderBookmarks(bookmarkId, newParentId, newIndex) {
    try {
      const bookmark = this.#bookmarks.get(bookmarkId);
      if (!bookmark) {
        return {
          success: false,
          error: `Bookmark not found: ${bookmarkId}`
        };
      }

      // 从原位置移除
      if (bookmark.parentId) {
        const oldParent = this.#bookmarks.get(bookmark.parentId);
        if (oldParent) {
          oldParent.removeChild(bookmarkId);
        }
      } else {
        const index = this.#rootBookmarkIds.indexOf(bookmarkId);
        if (index !== -1) {
          this.#rootBookmarkIds.splice(index, 1);
        }
      }

      // 添加到新位置
      bookmark.parentId = newParentId;
      bookmark.order = newIndex;

      if (newParentId) {
        const newParent = this.#bookmarks.get(newParentId);
        if (!newParent) {
          return {
            success: false,
            error: `New parent not found: ${newParentId}`
          };
        }
        // 插入到指定位置
        newParent.children.splice(newIndex, 0, bookmark);
        // 重新计算order
        newParent.children.forEach((child, i) => {
          child.order = i;
        });
      } else {
        // 插入到根列表
        this.#rootBookmarkIds.splice(newIndex, 0, bookmarkId);
      }

      // 保存到存储
      this.saveToStorage();

      this.#logger.info(`Bookmark reordered: ${bookmarkId} to ${newParentId || 'root'}[${newIndex}]`);
      return { success: true };
    } catch (error) {
      this.#logger.error('Failed to reorder bookmark:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取所有书签（树形结构）
   * @returns {Bookmark[]} 根级书签数组
   */
  getAllBookmarks() {
    return this.#rootBookmarkIds.map(id => this.#bookmarks.get(id)).filter(Boolean);
  }

  /**
   * 获取指定书签
   * @param {string} bookmarkId - 书签ID
   * @returns {Bookmark|null} 书签实例，未找到则返回null
   */
  getBookmark(bookmarkId) {
    return this.#bookmarks.get(bookmarkId) || null;
  }

  /**
   * 从LocalStorage加载书签
   * @returns {Promise<void>}
   */
  async loadFromStorage() {
    try {
      const storageKey = `pdf-viewer-bookmarks-${this.#pdfId}`;
      const data = localStorage.getItem(storageKey);

      if (!data) {
        this.#logger.info('No bookmarks found in storage');
        return;
      }

      const { bookmarks, rootIds } = JSON.parse(data);

      // 重建bookmarks Map
      this.#bookmarks.clear();
      bookmarks.forEach(bookmarkData => {
        const bookmark = Bookmark.fromJSON(bookmarkData);
        this.#bookmarks.set(bookmark.id, bookmark);
      });

      this.#rootBookmarkIds = rootIds || [];

      this.#logger.info(`Loaded ${this.#bookmarks.size} bookmarks from storage`);
    } catch (error) {
      this.#logger.error('Failed to load bookmarks from storage:', error);
    }
  }

  /**
   * 保存书签到LocalStorage
   * @returns {void}
   */
  saveToStorage() {
    try {
      const storageKey = `pdf-viewer-bookmarks-${this.#pdfId}`;
      const data = {
        bookmarks: Array.from(this.#bookmarks.values()).map(b => b.toJSON()),
        rootIds: this.#rootBookmarkIds,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
      this.#logger.debug('Bookmarks saved to storage');
    } catch (error) {
      this.#logger.error('Failed to save bookmarks to storage:', error);
    }
  }

  /**
   * 清空所有书签
   * @returns {void}
   */
  clearAll() {
    this.#bookmarks.clear();
    this.#rootBookmarkIds = [];
    this.saveToStorage();
    this.#logger.info('All bookmarks cleared');
  }

  /**
   * 销毁管理器
   * @returns {void}
   */
  destroy() {
    this.#bookmarks.clear();
    this.#rootBookmarkIds = [];
    this.#logger.info('BookmarkManager destroyed');
  }
}

export default BookmarkManager;
