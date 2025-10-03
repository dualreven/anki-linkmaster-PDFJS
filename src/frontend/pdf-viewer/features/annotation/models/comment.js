/**
 * Comment - 评论数据模型
 * @module features/annotation/models/comment
 * @description 评论数据模型，用于标注的评论功能
 */

/**
 * 生成唯一ID
 * @returns {string} 格式: comment_timestamp_random
 * @private
 */
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `comment_${timestamp}_${random}`;
}

/**
 * 评论类
 * @class Comment
 * @description 表示标注的一个评论
 */
export class Comment {
  /**
   * 创建评论实例
   * @param {Object} data - 评论数据
   * @param {string} [data.id] - 评论ID，不提供则自动生成
   * @param {string} data.annotationId - 所属标注ID
   * @param {string} data.content - 评论内容
   * @param {string} [data.createdAt] - 创建时间，ISO 8601格式
   */
  constructor(data) {
    if (!data.annotationId) {
      throw new Error('Comment: annotationId is required');
    }
    if (!data.content || typeof data.content !== 'string') {
      throw new Error('Comment: content must be a non-empty string');
    }

    /**
     * @type {string}
     * @description 评论唯一ID
     */
    this.id = data.id || generateId();

    /**
     * @type {string}
     * @description 所属标注的ID
     */
    this.annotationId = data.annotationId;

    /**
     * @type {string}
     * @description 评论内容
     */
    this.content = data.content;

    /**
     * @type {string}
     * @description 创建时间，ISO 8601格式
     */
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * 序列化为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      annotationId: this.annotationId,
      content: this.content,
      createdAt: this.createdAt
    };
  }

  /**
   * 从JSON对象创建Comment实例
   * @param {Object} json - JSON对象
   * @returns {Comment} Comment实例
   * @static
   */
  static fromJSON(json) {
    return new Comment(json);
  }

  /**
   * 更新评论内容
   * @param {string} newContent - 新的评论内容
   * @throws {Error} 如果内容为空
   */
  updateContent(newContent) {
    if (!newContent || typeof newContent !== 'string') {
      throw new Error('Comment: content must be a non-empty string');
    }
    this.content = newContent;
  }

  /**
   * 获取评论的简短预览
   * @param {number} [maxLength=50] - 最大长度
   * @returns {string} 预览文本
   */
  getPreview(maxLength = 50) {
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength) + '...';
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
}

export default Comment;
