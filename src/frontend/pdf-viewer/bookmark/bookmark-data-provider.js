/**
 * 书签数据提供者
 * @file 负责从PDF.js获取书签数据并转换为标准格式
 * @module BookmarkDataProvider
 */

import { getLogger } from '../../common/utils/logger.js';

/**
 * 书签节点数据结构
 * @typedef {Object} BookmarkNode
 * @property {string} id - 唯一标识
 * @property {string} title - 书签标题
 * @property {any} dest - PDF.js destination对象
 * @property {BookmarkNode[]} items - 子书签数组（树状结构）
 * @property {number} level - 层级深度（0-based）
 * @property {string} source - 来源标识 ('pdf' | 'local')
 */

/**
 * 书签数据提供者类
 * 负责从PDF文档中提取书签数据并转换为标准格式
 */
export class BookmarkDataProvider {
  /**
   * 创建书签数据提供者实例
   */
  constructor() {
    this.#logger = getLogger('BookmarkDataProvider');
    this.#pdfDocument = null;
    this.#logger.info('BookmarkDataProvider initialized');
  }

  // 私有字段
  #logger;
  #pdfDocument;

  /**
   * 从PDF文档中获取书签数据
   * @param {PDFDocumentProxy} pdfDocument - PDF.js文档代理对象
   * @returns {Promise<BookmarkNode[]>} 书签树数组（根级节点）
   * @throws {Error} 当PDF文档无效或API调用失败时
   */
  async getBookmarks(pdfDocument) {
    if (!pdfDocument) {
      throw new Error('PDF document is required');
    }

    this.#pdfDocument = pdfDocument;
    this.#logger.info('Getting bookmarks from PDF document');

    try {
      // 从PDF.js获取outline数据
      const outline = await pdfDocument.getOutline();

      if (!outline || outline.length === 0) {
        this.#logger.info('No bookmarks found in PDF');
        return [];
      }

      this.#logger.info(`Found ${outline.length} root bookmarks`);

      // 转换为标准格式
      const bookmarks = this.#convertOutlineToBookmarks(outline, 0);

      // 统计总书签数
      const totalCount = this.#countBookmarks(bookmarks);
      this.#logger.info(`Converted ${totalCount} bookmarks (including children)`);

      return bookmarks;
    } catch (error) {
      this.#logger.error('Failed to get bookmarks:', error);
      throw new Error(`Failed to get bookmarks: ${error.message}`);
    }
  }

  /**
   * 递归转换PDF.js outline结构为标准书签格式
   * @param {Array} outline - PDF.js outline数组
   * @param {number} level - 当前层级深度
   * @param {string} [parentId=''] - 父节点ID（用于生成唯一ID）
   * @returns {BookmarkNode[]} 标准格式的书签数组
   * @private
   */
  #convertOutlineToBookmarks(outline, level, parentId = '') {
    if (!Array.isArray(outline) || outline.length === 0) {
      return [];
    }

    return outline.map((item, index) => {
      // 生成唯一ID
      const id = this.#generateBookmarkId(index, level, parentId);

      // 递归处理子书签
      const childBookmarks = item.items && item.items.length > 0
        ? this.#convertOutlineToBookmarks(item.items, level + 1, id)
        : [];

      return {
        id,
        title: item.title || '(Untitled)',
        dest: item.dest,
        items: childBookmarks,
        level,
        source: 'pdf'
      };
    });
  }

  /**
   * 生成书签唯一ID
   * @param {number} index - 在当前层级中的索引
   * @param {number} level - 层级深度
   * @param {string} parentId - 父节点ID
   * @returns {string} 唯一ID（格式：level-index 或 parentId-level-index）
   * @private
   */
  #generateBookmarkId(index, level, parentId) {
    if (parentId) {
      return `${parentId}-${level}-${index}`;
    }
    return `${level}-${index}`;
  }

  /**
   * 递归统计书签总数（包括所有子书签）
   * @param {BookmarkNode[]} bookmarks - 书签数组
   * @returns {number} 总书签数
   * @private
   */
  #countBookmarks(bookmarks) {
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return 0;
    }

    return bookmarks.reduce((count, bookmark) => {
      return count + 1 + this.#countBookmarks(bookmark.items);
    }, 0);
  }

  /**
   * 解析PDF.js destination对象
   * 将destination转换为页码和位置信息
   * @param {any} dest - PDF.js destination对象
   * @returns {Promise<{pageNumber: number, x: number, y: number, zoom: number|null}>} 解析后的位置信息
   * @throws {Error} 当destination格式无效时
   */
  async parseDestination(dest) {
    if (!dest) {
      throw new Error('Destination is required');
    }

    if (!this.#pdfDocument) {
      throw new Error('PDF document not loaded');
    }

    try {
      const { resolvePdfDest } = await import('../pdf/pdf-dest-utils.js');
      const { pageNumber, x, y, zoom, type } = await resolvePdfDest(this.#pdfDocument, dest);
      // 严格：x/y 未提供时使用 null（不要默认 0，否则会被误判为“顶部/位置0%”）
      const result = {
        pageNumber,
        x: (typeof x === 'number') ? x : null,
        y: (typeof y === 'number') ? y : null,
        zoom: (typeof zoom === 'number') ? zoom : null,
        type: (typeof type === 'string') ? type : null
      };
      this.#logger.debug('Parsed destination:', result);
      return result;
    } catch (error) {
      this.#logger.error('Failed to parse destination:', error);
      throw new Error(`Failed to parse destination: ${error.message}`);
    }
  }

  /**
   * 清理资源
   * 释放对PDF文档的引用
   */
  destroy() {
    this.#logger.info('Destroying BookmarkDataProvider');
    this.#pdfDocument = null;
  }
}

/**
 * 默认导出
 */
export default BookmarkDataProvider;
