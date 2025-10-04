/**
 * @file Bookmark 数据模型
 * @module features/pdf-bookmark/models/bookmark
 * @description 定义书签数据结构和工厂方法
 */

/**
 * 生成唯一ID
 * @returns {string} 格式: bookmark-{timestamp}-{random}
 * @private
 */
function generateId() {
  return `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Bookmark 数据模型类
 * @class Bookmark
 */
export class Bookmark {
  /**
   * 创建书签实例
   * @param {Object} data - 书签数据
   * @param {string} [data.id] - 唯一标识（不提供则自动生成）
   * @param {string} data.name - 书签名称
   * @param {'page'|'region'} data.type - 书签类型
   * @param {number} data.pageNumber - 目标页码
   * @param {Object} [data.region] - 区域信息（type=region时必须）
   * @param {number} [data.region.scrollX] - 水平滚动位置
   * @param {number} [data.region.scrollY] - 垂直滚动位置
   * @param {number} [data.region.zoom] - 缩放级别
   * @param {Bookmark[]} [data.children] - 子书签数组
   * @param {string|null} [data.parentId] - 父书签ID
   * @param {number} [data.order] - 排序序号
   * @param {string} [data.createdAt] - 创建时间（ISO 8601）
   * @param {string} [data.updatedAt] - 更新时间（ISO 8601）
   */
  constructor(data) {
    const now = new Date().toISOString();

    this.id = data.id || generateId();
    this.name = data.name || '未命名书签';
    this.type = data.type || 'page';
    this.pageNumber = data.pageNumber || 1;
    this.region = data.region || null;
    this.children = data.children || [];
    this.parentId = data.parentId || null;
    this.order = data.order || 0;
    this.createdAt = data.createdAt || now;
    this.updatedAt = data.updatedAt || now;
  }

  /**
   * 转换为普通对象（用于存储）
   * @returns {Object} 书签数据对象
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      pageNumber: this.pageNumber,
      region: this.region,
      children: this.children.map(child =>
        child instanceof Bookmark ? child.toJSON() : child
      ),
      parentId: this.parentId,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从普通对象创建书签实例
   * @param {Object} data - 书签数据对象
   * @returns {Bookmark} 书签实例
   * @static
   */
  static fromJSON(data) {
    const bookmark = new Bookmark(data);
    // 递归转换子书签
    if (Array.isArray(data.children)) {
      bookmark.children = data.children.map(child => Bookmark.fromJSON(child));
    }
    return bookmark;
  }

  /**
   * 创建页面书签
   * @param {number} pageNumber - 页码
   * @param {string} [name] - 书签名称（默认为"第X页"）
   * @returns {Bookmark} 书签实例
   * @static
   */
  static createPage(pageNumber, name) {
    return new Bookmark({
      name: name || `第 ${pageNumber} 页`,
      type: 'page',
      pageNumber
    });
  }

  /**
   * 创建区域书签
   * @param {number} pageNumber - 页码
   * @param {Object} region - 区域信息
   * @param {number} region.scrollX - 水平滚动位置
   * @param {number} region.scrollY - 垂直滚动位置
   * @param {number} region.zoom - 缩放级别
   * @param {string} [name] - 书签名称
   * @returns {Bookmark} 书签实例
   * @static
   */
  static createRegion(pageNumber, region, name) {
    return new Bookmark({
      name: name || `第 ${pageNumber} 页（精确位置）`,
      type: 'region',
      pageNumber,
      region
    });
  }

  /**
   * 更新书签属性
   * @param {Object} updates - 要更新的属性
   * @returns {Bookmark} 返回自身（支持链式调用）
   */
  update(updates) {
    Object.assign(this, updates);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * 添加子书签
   * @param {Bookmark} childBookmark - 子书签
   * @returns {Bookmark} 返回自身（支持链式调用）
   */
  addChild(childBookmark) {
    childBookmark.parentId = this.id;
    childBookmark.order = this.children.length;
    this.children.push(childBookmark);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * 移除子书签
   * @param {string} childId - 子书签ID
   * @returns {Bookmark|null} 被移除的书签，未找到则返回null
   */
  removeChild(childId) {
    const index = this.children.findIndex(child => child.id === childId);
    if (index === -1) return null;

    const removed = this.children.splice(index, 1)[0];
    // 重新排序剩余子书签
    this.children.forEach((child, i) => {
      child.order = i;
    });
    this.updatedAt = new Date().toISOString();
    return removed;
  }

  /**
   * 验证书签数据完整性
   * @returns {Object} 验证结果 {valid: boolean, errors: string[]}
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('书签名称不能为空');
    }

    if (!['page', 'region'].includes(this.type)) {
      errors.push('书签类型必须是 page 或 region');
    }

    if (!Number.isInteger(this.pageNumber) || this.pageNumber < 1) {
      errors.push('页码必须是大于0的整数');
    }

    if (this.type === 'region' && !this.region) {
      errors.push('region类型书签必须包含区域信息');
    }

    if (this.type === 'region' && this.region) {
      if (typeof this.region.scrollX !== 'number' ||
          typeof this.region.scrollY !== 'number' ||
          typeof this.region.zoom !== 'number') {
        errors.push('区域信息必须包含 scrollX, scrollY, zoom 数值');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default Bookmark;
