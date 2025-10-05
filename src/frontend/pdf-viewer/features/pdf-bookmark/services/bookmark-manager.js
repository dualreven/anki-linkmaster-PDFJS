/**
 * @file BookmarkManager 书签管理器
 * @module features/pdf-bookmark/services/bookmark-manager
 * @description 负责书签的 CRUD 操作和 LocalStorage 持久化
 */

import { Bookmark } from '../models/bookmark.js';
import { getLogger } from '../../../../common/utils/logger.js';
import { createDefaultBookmarkStorage } from './bookmark-storage.js';

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
   * 书签存储实例
   * @type {import('./bookmark-storage.js').IBookmarkStorage}
   * @private
   */
  #storage;

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
  constructor({ eventBus, pdfId, storage, storageFactory, storageOptions } = {}) {
    this.#logger = getLogger('BookmarkManager');
    this.#eventBus = eventBus;
    this.#pdfId = pdfId;

    if (storage) {
      this.#storage = storage;
    } else if (typeof storageFactory === 'function') {
      this.#storage = storageFactory();
    } else {
      this.#storage = createDefaultBookmarkStorage(storageOptions);
    }
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
   * @returns {Promise<{success: boolean, bookmarkId?: string, error?: string}>}
   */
  async addBookmark(bookmarkData) {
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
        // 如果指定了order，插入到指定位置；否则添加到末尾
        const insertIndex = typeof bookmark.order === 'number' && bookmark.order >= 0
          ? bookmark.order
          : this.#rootBookmarkIds.length;

        this.#rootBookmarkIds.splice(insertIndex, 0, bookmark.id);
        this.#logger.info(`Added bookmark to root at index ${insertIndex}`);
      } else {
        // 如果有父书签，添加到父书签的children
        const parent = this.#bookmarks.get(bookmark.parentId);
        if (parent) {
          // 如果指定了order，插入到指定位置；否则添加到末尾
          const insertIndex = typeof bookmark.order === 'number' && bookmark.order >= 0
            ? bookmark.order
            : parent.children.length;

          bookmark.order = insertIndex;
          parent.children.splice(insertIndex, 0, bookmark);

          // 重新计算后续书签的order
          parent.children.forEach((child, i) => {
            child.order = i;
          });

          this.#logger.info(`Added bookmark to parent ${parent.name} at index ${insertIndex}`);
        }
      }

      // 保存到存储
      await this.saveToStorage();

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
   * @returns {Promise<{success: boolean, deletedIds?: string[], error?: string}>}
   */
  async deleteBookmark(bookmarkId, cascadeDelete = true) {
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
      await this.saveToStorage();

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
   * @returns {Promise<{success: boolean, updatedBookmark?: Bookmark, error?: string}>}
   */
  async updateBookmark(bookmarkId, updates) {
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
      await this.saveToStorage();

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
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async reorderBookmarks(bookmarkId, newParentId, newIndex) {
    try {
      const bookmark = this.#bookmarks.get(bookmarkId);
      if (!bookmark) {
        return {
          success: false,
          error: `Bookmark not found: ${bookmarkId}`
        };
      }

      this.#logger.info(`📋 Reorder start: ${bookmark.name} (${bookmarkId})`);
      this.#logger.info(`  From: parent=${bookmark.parentId || 'root'}, order=${bookmark.order}`);
      this.#logger.info(`  To: parent=${newParentId || 'root'}, index=${newIndex}`);

      // 从原位置移除
      if (bookmark.parentId) {
        const oldParent = this.#bookmarks.get(bookmark.parentId);
        if (oldParent) {
          this.#logger.info(`  Removing from parent: ${oldParent.name} (children count before: ${oldParent.children.length})`);
          oldParent.removeChild(bookmarkId);
          this.#logger.info(`  Removed (children count after: ${oldParent.children.length})`);
        }
      } else {
        const index = this.#rootBookmarkIds.indexOf(bookmarkId);
        this.#logger.info(`  Removing from root: index=${index}, root count before: ${this.#rootBookmarkIds.length}`);
        if (index !== -1) {
          this.#rootBookmarkIds.splice(index, 1);
          this.#logger.info(`  Removed from root, count after: ${this.#rootBookmarkIds.length}`);
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
        this.#logger.info(`  Adding to parent: ${newParent.name} (children count before: ${newParent.children.length})`);
        // 插入到指定位置
        newParent.children.splice(newIndex, 0, bookmark);
        // 重新计算order
        newParent.children.forEach((child, i) => {
          child.order = i;
        });
        this.#logger.info(`  Added to parent (children count after: ${newParent.children.length})`);
      } else {
        this.#logger.info(`  Adding to root at index ${newIndex}, root count before: ${this.#rootBookmarkIds.length}`);
        // 插入到根列表
        this.#rootBookmarkIds.splice(newIndex, 0, bookmarkId);
        this.#logger.info(`  Added to root, count after: ${this.#rootBookmarkIds.length}`);
        this.#logger.info(`  Root IDs: ${this.#rootBookmarkIds.join(', ')}`);
      }

      // 保存到存储
      await this.saveToStorage();

      this.#logger.info(`✅ Bookmark reordered successfully: ${bookmarkId} to ${newParentId || 'root'}[${newIndex}]`);
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
   * 从存储加载书签
   * @returns {Promise<void>}
   */
  async loadFromStorage() {
    try {
      const data = await this.#storage.load(this.#pdfId);

      if (!data) {
        this.#logger.info(`❌ No bookmarks found in storage for PDF: ${this.#pdfId}`);
        return;
      }

      const { bookmarks, rootIds } = data;
      this.#logger.info(`✅ Found stored data: ${bookmarks.length} bookmarks, ${rootIds.length} root IDs`);

      // 重建bookmarks Map
      this.#bookmarks.clear();
      bookmarks.forEach(bookmarkData => {
        const bookmark = Bookmark.fromJSON(bookmarkData);
        this.#bookmarks.set(bookmark.id, bookmark);
      });

      this.#rootBookmarkIds = rootIds || [];

      this.#logger.info(`✅ Loaded ${this.#bookmarks.size} bookmarks from storage`);
    } catch (error) {
      this.#logger.error('Failed to load bookmarks from storage:', error);
    }
  }

  /**
   * 保存书签到存储
   * @returns {Promise<void>}
   */
  async saveToStorage() {
    try {
      const bookmarks = Array.from(this.#bookmarks.values()).map(b => b.toJSON());
      await this.#storage.save(this.#pdfId, bookmarks, this.#rootBookmarkIds);
      this.#logger.info(`✅ Bookmarks saved to storage: PDF=${this.#pdfId}, count=${this.#bookmarks.size}`);
    } catch (error) {
      this.#logger.error('Failed to save bookmarks to storage:', error);
    }
  }

  /**
   * 清空所有书签
   * @returns {Promise<void>}
   */
  async clearAll() {
    this.#bookmarks.clear();
    this.#rootBookmarkIds = [];
    await this.#storage.clear(this.#pdfId);
    this.#logger.info('All bookmarks cleared');
  }

  /**
   * 批量导入PDF原生书签
   * @param {Array} nativeBookmarks - PDF原生书签数组（格式：{ title, dest, items: [] }）
   * @param {Function} parseDestFunc - dest解析函数，返回Promise<number|null>
   * @returns {Promise<{success: boolean, count: number, error?: string}>}
   */
  async importNativeBookmarks(nativeBookmarks, parseDestFunc) {
    try {
      this.#logger.info(`Importing ${nativeBookmarks.length} native bookmarks...`);

      // 递归转换并导入书签
      const importedCount = await this.#importBookmarksRecursive(
        nativeBookmarks,
        parseDestFunc,
        null, // 根级书签没有parentId
        0     // 初始order
      );

      // 保存到存储
      await this.saveToStorage();

      this.#logger.info(`Successfully imported ${importedCount} native bookmarks`);
      return {
        success: true,
        count: importedCount
      };
    } catch (error) {
      this.#logger.error('Failed to import native bookmarks:', error);
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * 递归导入书签（私有辅助方法）
   * @param {Array} nativeBookmarks - 原生书签数组
   * @param {Function} parseDestFunc - dest解析函数
   * @param {string|null} parentId - 父书签ID
   * @param {number} startOrder - 起始排序号
   * @returns {Promise<number>} 导入的书签总数
   * @private
   */
  async #importBookmarksRecursive(nativeBookmarks, parseDestFunc, parentId, startOrder) {
    let count = 0;
    let currentOrder = startOrder;

    for (const nativeBookmark of nativeBookmarks) {
      try {
        // 解析dest获取页码
        const pageNumber = await parseDestFunc(nativeBookmark);
        if (!pageNumber) {
          this.#logger.warn(`Skipping bookmark with invalid dest: ${nativeBookmark.title}`);
          continue;
        }

        // 创建Bookmark实例
        const bookmark = new Bookmark({
          name: nativeBookmark.title || '(未命名)',
          type: 'page',
          pageNumber: pageNumber,
          parentId: parentId,
          order: currentOrder
        });

        // 添加到集合
        this.#bookmarks.set(bookmark.id, bookmark);

        // 如果是根级书签，添加到根列表
        if (!parentId) {
          this.#rootBookmarkIds.push(bookmark.id);
        } else {
          // 如果有父书签，添加到父书签的children
          const parent = this.#bookmarks.get(parentId);
          if (parent) {
            parent.children.push(bookmark);
          }
        }

        count++;
        currentOrder++;

        // 递归导入子书签
        if (nativeBookmark.items && nativeBookmark.items.length > 0) {
          const childCount = await this.#importBookmarksRecursive(
            nativeBookmark.items,
            parseDestFunc,
            bookmark.id, // 当前书签作为父书签
            0 // 子书签从0开始排序
          );
          count += childCount;
        }
      } catch (error) {
        this.#logger.error(`Failed to import bookmark: ${nativeBookmark.title}`, error);
      }
    }

    return count;
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
