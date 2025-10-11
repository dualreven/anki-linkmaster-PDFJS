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

      // 防御性同步：如父节点存在，则确保父.children 中的引用同步到最新对象
      if (bookmark.parentId) {
        const parent = this.#bookmarks.get(bookmark.parentId);
        if (parent && Array.isArray(parent.children)) {
          const idx = parent.children.findIndex(c => c && c.id === bookmark.id);
          if (idx !== -1) {
            parent.children[idx] = bookmark;
          }
        }
      }

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

      // 预校验：父节点存在性与环路检查
      if (newParentId) {
        const newParent = this.#bookmarks.get(newParentId);
        if (!newParent) {
          return { success: false, error: `New parent not found: ${newParentId}` };
        }
        // 环路检查：沿父链向上查找，不能把节点移到其子孙下面
        let p = newParentId;
        while (p) {
          if (p === bookmarkId) {
            return { success: false, error: 'Cannot move a node under its own descendant' };
          }
          const up = this.#bookmarks.get(p);
          p = up ? (up.parentId || null) : null;
        }
      }

      // 计算目标 siblings 与索引边界
      const targetSiblings = newParentId
        ? (this.#bookmarks.get(newParentId)?.children || [])
        : this.#rootBookmarkIds.map(id => this.#bookmarks.get(id)).filter(Boolean);
      let targetIndex = Math.max(0, Math.min(Number(newIndex ?? 0), targetSiblings.length));

      // 同父移动时需要考虑移除后索引变化
      const fromParentId = bookmark.parentId || null;
      const movingWithinSameParent = fromParentId === (newParentId || null);

      // 先从原位置安全移除（但在计算后一并执行）
      const removeFromOriginal = () => {
        if (bookmark.parentId) {
          const oldParent = this.#bookmarks.get(bookmark.parentId);
          if (oldParent) {
            this.#logger.info(`  Removing from parent: ${oldParent.name} (children count before: ${oldParent.children.length})`);
            const oldIdx = oldParent.children.findIndex(c => c && c.id === bookmarkId);
            if (oldIdx !== -1) oldParent.children.splice(oldIdx, 1);
            oldParent.children.forEach((child, i) => { child.order = i; });
            this.#logger.info(`  Removed (children count after: ${oldParent.children.length})`);
            // 同父移动且原位置在目标位置之前，移除后目标索引左移
            if (movingWithinSameParent && oldIdx !== -1 && oldIdx < targetIndex) {
              targetIndex = Math.max(0, targetIndex - 1);
            }
          }
        } else {
          const idx = this.#rootBookmarkIds.indexOf(bookmarkId);
          this.#logger.info(`  Removing from root: index=${idx}, root count before: ${this.#rootBookmarkIds.length}`);
          if (idx !== -1) this.#rootBookmarkIds.splice(idx, 1);
          this.#logger.info(`  Removed from root, count after: ${this.#rootBookmarkIds.length}`);
          if (movingWithinSameParent && idx !== -1 && idx < targetIndex) {
            targetIndex = Math.max(0, targetIndex - 1);
          }
        }
      };

      // 执行移除
      removeFromOriginal();

      // 写入新位置
      bookmark.parentId = newParentId || null;
      if (newParentId) {
        const np = this.#bookmarks.get(newParentId);
        this.#logger.info(`  Adding to parent: ${np.name} (children count before: ${np.children.length})`);
        np.children.splice(targetIndex, 0, bookmark);
        np.children.forEach((child, i) => { child.order = i; });
        bookmark.order = targetIndex;
        this.#logger.info(`  Added to parent (children count after: ${np.children.length})`);
      } else {
        this.#logger.info(`  Adding to root at index ${targetIndex}, root count before: ${this.#rootBookmarkIds.length}`);
        this.#rootBookmarkIds.splice(targetIndex, 0, bookmarkId);
        // 同步根级 order，保持内存一致
        this.#rootBookmarkIds.forEach((id, i) => {
          const node = this.#bookmarks.get(id);
          if (node) node.order = i;
        });
        bookmark.order = targetIndex;
        this.#logger.info(`  Added to root, count after: ${this.#rootBookmarkIds.length}`);
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
      const total = Array.isArray(bookmarks) ? bookmarks.length : 0;
      this.#logger.info(`✅ Found stored data: ${total} bookmarks, ${(rootIds || []).length} root IDs`);

      // 重建 Map
      this.#bookmarks.clear();

      // 情况A：标准结构（bookmarks 为根节点树，rootIds 提供根顺序）
      const isStandard = Array.isArray(rootIds) && rootIds.length > 0;

      if (isStandard) {
        const addRecursive = (bm) => {
          if (!bm || !bm.id) return;
          this.#bookmarks.set(bm.id, bm);
          if (Array.isArray(bm.children) && bm.children.length > 0) {
            bm.children.forEach(child => addRecursive(child));
          }
        };
        (bookmarks || []).forEach(bm => addRecursive(Bookmark.fromJSON(bm)));
        this.#rootBookmarkIds = rootIds || [];
        this.#logger.info(`📦 Loaded standard tree: roots=${this.#rootBookmarkIds.length}, mapSize=${this.#bookmarks.size}`);
      } else {
        // 情况B：兼容旧格式（可能将所有节点平铺在顶层或混合）
        this.#logger.warn('⚠️ Detected legacy bookmark format (no rootIds). Rebuilding tree from flat list...');
        const map = new Map();
        const shallow = (b) => {
          // 使用 fromJSON 但清空 children，避免重复挂载
          const inst = Bookmark.fromJSON(b);
          inst.children = [];
          return inst;
        };
        const list = Array.isArray(bookmarks) ? bookmarks : [];
        list.forEach(b => {
          try {
            const inst = shallow(b);
            map.set(inst.id, inst);
          } catch (_) {
            // ignore malformed entries
          }
        });

        // 重新挂载父子关系
        const roots = [];
        Array.from(map.values()).forEach(node => {
          const pid = node.parentId || null;
          if (pid && map.has(pid)) {
            const parent = map.get(pid);
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        });

        // 根按 order 排序，降级容错
        roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // 写入内部 Map 与根顺序
        roots.forEach(root => {
          const addRecursive = (bm) => {
            if (!bm || !bm.id) return;
            this.#bookmarks.set(bm.id, bm);
            (bm.children || []).forEach(child => addRecursive(child));
          };
          addRecursive(root);
        });

        this.#rootBookmarkIds = roots.map(r => r.id);
        this.#logger.info(`📦 Rebuilt legacy tree: roots=${this.#rootBookmarkIds.length}, mapSize=${this.#bookmarks.size}`);
      }

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
      // 仅序列化根节点树，符合后端 save_bookmarks 期望
      // 增加基于 id 的去重与防循环，避免同一 bookmark_id 在同一次保存载荷中出现两次
      const visited = new Set();
      const cloneAndDedup = (node) => {
        if (!node || !node.id) return null;
        if (visited.has(node.id)) {
          this.#logger.warn(`⚠️ Duplicate node detected during serialization: ${node.id} (${node.name})`);
          return null;
        }
        visited.add(node.id);

        // 手动构建 JSON 对象，避免 toJSON() 递归序列化导致的冲突
        // 只序列化当前节点的属性（不包括 children）
        const json = {
          id: node.id,
          name: node.name,
          type: node.type,
          pageNumber: node.pageNumber,
          region: node.region,
          parentId: node.parentId,
          order: node.order,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          children: [] // 稍后递归填充
        };

        // 递归处理 children，应用 visited 检查
        const children = Array.isArray(node.children) ? node.children : [];
        const deduped = [];
        for (const child of children) {
          if (!child) continue;
          const childId = child.id || child.bookmark_id;
          if (!childId) {
            this.#logger.warn(`⚠️ Child node without ID found in ${node.name}, skipping`);
            continue;
          }

          // 如果 child 已经被访问过，说明存在引用残留或循环引用
          if (visited.has(childId)) {
            this.#logger.warn(`⚠️ Child ${childId} already visited, skipping to prevent duplication`);
            continue;
          }

          // 获取 child 节点实例（优先使用 Map 中的实例，确保状态最新）
          const childNode = this.#bookmarks.get(childId) || child;
          const cloned = cloneAndDedup(childNode);
          if (cloned) {
            deduped.push(cloned);
          }
        }

        json.children = deduped;
        return json;
      };

      const roots = this.#rootBookmarkIds
        .map(id => this.#bookmarks.get(id))
        .filter(Boolean)
        .map(b => cloneAndDedup(b))
        .filter(Boolean);

      // rootIds 仅包含当前无 parentId 的节点，且顺序与内部 root 列表一致
      const rootIds = Array.from(this.#rootBookmarkIds).filter(id => {
        const n = this.#bookmarks.get(id);
        return n && (!n.parentId);
      });

      await this.#storage.save(this.#pdfId, roots, rootIds);
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
