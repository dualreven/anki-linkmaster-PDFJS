/**
 * Annotation - 标注数据模型
 * @module features/annotation/models/annotation
 * @description 标注数据模型，支持三种类型：截图、选字高亮、批注
 */

import { Comment } from './comment.js';

/**
 * 标注类型枚举
 * @enum {string}
 */
export const AnnotationType = {
  /** 截图标注 */
  SCREENSHOT: 'screenshot',
  /** 选字高亮标注 */
  TEXT_HIGHLIGHT: 'text-highlight',
  /** 批注标注 */
  COMMENT: 'comment'
};

/**
 * 高亮颜色预设
 * @enum {string}
 */
export const HighlightColor = {
  YELLOW: '#ffff00',
  GREEN: '#90ee90',
  BLUE: '#87ceeb',
  PINK: '#ffb6c1'
};

/**
 * 生成唯一ID
 * @returns {string} 格式: ann_timestamp_random
 * @private
 */
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `ann_${timestamp}_${random}`;
}

/**
 * 标注类
 * @class Annotation
 * @description 表示PDF上的一个标注，可以是截图、选字高亮或批注
 */
export class Annotation {
  /**
   * 创建标注实例
   * @param {Object} data - 标注数据
   * @param {string} [data.id] - 标注ID，不提供则自动生成
   * @param {string} data.type - 标注类型 ('screenshot' | 'text-highlight' | 'comment')
   * @param {number} data.pageNumber - 页码（从1开始）
   * @param {Object} data.data - 类型特定的数据
   * @param {Array<Comment>} [data.comments=[]] - 评论列表
   * @param {string} [data.createdAt] - 创建时间，ISO 8601格式
   * @param {string} [data.updatedAt] - 更新时间，ISO 8601格式
   */
  constructor(data) {
    if (!data.type || !Object.values(AnnotationType).includes(data.type)) {
      throw new Error('Annotation: type must be one of: screenshot, text-highlight, comment');
    }
    if (!data.pageNumber || typeof data.pageNumber !== 'number' || data.pageNumber < 1) {
      throw new Error('Annotation: pageNumber must be a positive number');
    }
    if (!data.data || typeof data.data !== 'object') {
      throw new Error('Annotation: data object is required');
    }

    // 验证类型特定数据
    this.#validateTypeSpecificData(data.type, data.data);

    /**
     * @type {string}
     * @description 标注唯一ID
     */
    this.id = data.id || generateId();

    /**
     * @type {string}
     * @description 标注类型
     */
    this.type = data.type;

    /**
     * @type {number}
     * @description 页码（从1开始）
     */
    this.pageNumber = data.pageNumber;

    /**
     * @type {Object}
     * @description 类型特定的数据
     */
    this.data = { ...data.data };

    /**
     * @type {Array<Comment>}
     * @description 评论列表
     */
    this.comments = (data.comments || []).map(c =>
      c instanceof Comment ? c : new Comment(c)
    );

    /**
     * @type {string}
     * @description 创建时间，ISO 8601格式
     */
    this.createdAt = data.createdAt || new Date().toISOString();

    /**
     * @type {string}
     * @description 更新时间，ISO 8601格式
     */
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * 验证类型特定数据
   * @param {string} type - 标注类型
   * @param {Object} data - 数据对象
   * @throws {Error} 如果数据无效
   * @private
   */
  #validateTypeSpecificData(type, data) {
    switch (type) {
      case AnnotationType.SCREENSHOT:
        // 使用typeof检查，支持0值（页面左上角坐标可能是0）
        if (!data.rect ||
            typeof data.rect.x !== 'number' ||
            typeof data.rect.y !== 'number' ||
            typeof data.rect.width !== 'number' ||
            typeof data.rect.height !== 'number') {
          throw new Error('Screenshot annotation requires rect with x, y, width, height');
        }
        // v003规范: 支持imagePath（文件路径）而非imageData（base64）
        // 兼容两种格式: imagePath优先，imageData作为回退
        if (!data.imagePath && !data.imageData) {
          throw new Error('Screenshot annotation requires imagePath or imageData');
        }
        if (data.imageData && !data.imageData.startsWith('data:image/')) {
          throw new Error('Screenshot annotation imageData must be valid base64');
        }
        break;

      case AnnotationType.TEXT_HIGHLIGHT:
        if (!data.selectedText || typeof data.selectedText !== 'string') {
          throw new Error('Text highlight annotation requires selectedText');
        }
        if (!Array.isArray(data.textRanges) || data.textRanges.length === 0) {
          throw new Error('Text highlight annotation requires textRanges array');
        }
        if (!data.highlightColor) {
          throw new Error('Text highlight annotation requires highlightColor');
        }
        break;

      case AnnotationType.COMMENT:
        if (!data.position || typeof data.position.x !== 'number' || typeof data.position.y !== 'number') {
          throw new Error('Comment annotation requires position with x, y');
        }
        if (!data.content || typeof data.content !== 'string') {
          throw new Error('Comment annotation requires content');
        }
        break;

      default:
        throw new Error(`Unknown annotation type: ${type}`);
    }
  }

  /**
   * 序列化为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      pageNumber: this.pageNumber,
      data: this.data,
      comments: this.comments.map(c => c.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从JSON对象创建Annotation实例
   * @param {Object} json - JSON对象
   * @returns {Annotation} Annotation实例
   * @static
   */
  static fromJSON(json) {
    return new Annotation(json);
  }

  /**
   * 更新标注数据
   * @param {Object} changes - 要更新的字段
   */
  update(changes) {
    if (changes.data) {
      this.#validateTypeSpecificData(this.type, changes.data);
      this.data = { ...this.data, ...changes.data };
    }

    this.updatedAt = new Date().toISOString();
  }

  /**
   * 添加评论
   * @param {Comment|Object} comment - 评论对象或评论数据
   * @returns {Comment} 添加的评论
   */
  addComment(comment) {
    const commentObj = comment instanceof Comment
      ? comment
      : new Comment({ ...comment, annotationId: this.id });

    this.comments.push(commentObj);
    this.updatedAt = new Date().toISOString();

    return commentObj;
  }

  /**
   * 删除评论
   * @param {string} commentId - 评论ID
   * @returns {boolean} 是否删除成功
   */
  removeComment(commentId) {
    const index = this.comments.findIndex(c => c.id === commentId);
    if (index === -1) {
      return false;
    }

    this.comments.splice(index, 1);
    this.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * 获取评论数量
   * @returns {number} 评论数量
   */
  getCommentCount() {
    return this.comments.length;
  }

  /**
   * 获取标注的简短描述
   * @returns {string} 描述文本
   */
  getDescription() {
    switch (this.type) {
      case AnnotationType.SCREENSHOT:
        return this.data.description || '截图标注';

      case AnnotationType.TEXT_HIGHLIGHT:
        const text = this.data.selectedText;
        return text.length > 50 ? text.substring(0, 50) + '...' : text;

      case AnnotationType.COMMENT:
        const content = this.data.content;
        return content.length > 50 ? content.substring(0, 50) + '...' : content;

      default:
        return '标注';
    }
  }

  /**
   * 获取标注类型图标
   * @returns {string} 图标字符
   */
  getTypeIcon() {
    switch (this.type) {
      case AnnotationType.SCREENSHOT:
        return '📷';
      case AnnotationType.TEXT_HIGHLIGHT:
        return '✏️';
      case AnnotationType.COMMENT:
        return '📝';
      default:
        return '📌';
    }
  }

  /**
   * 获取格式化的创建时间
   * @param {string} [locale='zh-CN'] - 地区设置
   * @returns {string} 格式化的时间字符串
   */
  getFormattedDate(locale = 'zh-CN') {
    const date = new Date(this.createdAt);
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 创建截图标注
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 {x, y, width, height}
   * @param {string} imagePath - 图片文件路径（如'/data/screenshots/abc123.png'）
   * @param {string} imageHash - 图片MD5哈希值
   * @param {string} [description=''] - 描述
   * @returns {Annotation} 标注实例
   * @static
   */
  static createScreenshot(pageNumber, rect, imagePath, imageHash, description = '') {
    return new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber,
      data: {
        rect,
        imagePath,      // v003规范: 使用文件路径
        imageHash,      // v003规范: MD5哈希值
        description
      }
    });
  }

  /**
   * 创建截图标注（旧版兼容，使用base64）
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 {x, y, width, height}
   * @param {string} imageData - base64图片数据
   * @param {string} [description=''] - 描述
   * @returns {Annotation} 标注实例
   * @static
   * @deprecated 使用createScreenshot(pageNumber, rect, imagePath, imageHash, description)代替
   */
  static createScreenshotLegacy(pageNumber, rect, imageData, description = '') {
    return new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber,
      data: {
        rect,
        imageData,
        description
      }
    });
  }

  /**
   * 创建选字标注
   * @param {number} pageNumber - 页码
   * @param {string} selectedText - 选中的文本
   * @param {Array} textRanges - 文本范围数组
   * @param {string} highlightColor - 高亮颜色
   * @param {string} [note=''] - 笔记
   * @returns {Annotation} 标注实例
   * @static
   */
  static createTextHighlight(pageNumber, selectedText, textRanges, highlightColor, note = '') {
    return new Annotation({
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber,
      data: {
        selectedText,
        textRanges,
        highlightColor,
        note
      }
    });
  }

  /**
   * 创建批注标注
   * @param {number} pageNumber - 页码
   * @param {Object} position - 位置 {x, y}
   * @param {string} content - 批注内容
   * @returns {Annotation} 标注实例
   * @static
   */
  static createComment(pageNumber, position, content) {
    return new Annotation({
      type: AnnotationType.COMMENT,
      pageNumber,
      data: {
        position,
        content
      }
    });
  }
}

export default Annotation;
