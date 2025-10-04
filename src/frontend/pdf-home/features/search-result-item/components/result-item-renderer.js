/**
 * 搜索结果条目渲染器
 * 负责渲染单个PDF结果条目的HTML
 */

export class ResultItemRenderer {
  #logger = null;
  #config = null;

  constructor(logger, config = {}) {
    this.#logger = logger;
    this.#config = config;
  }

  /**
   * 渲染条目
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   */
  render(data) {
    // TODO: 实现渲染逻辑
    this.#logger.debug('[ResultItemRenderer] Rendering item:', data.filename);

    return `
      <div class="search-result-item" data-id="${data.id}">
        <div class="search-result-item-content">
          <div class="search-result-item-title">${this.#escapeHtml(data.filename)}</div>
          ${this.#renderMetadata(data)}
          ${this.#renderTags(data)}
        </div>
      </div>
    `;
  }

  /**
   * 渲染元数据
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderMetadata(data) {
    if (!this.#config.showMetadata) return '';

    // TODO: 实现元数据渲染
    return '<div class="search-result-item-metadata"></div>';
  }

  /**
   * 渲染标签
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderTags(data) {
    if (!this.#config.showTags) return '';

    // TODO: 实现标签渲染
    return '<div class="search-result-item-tags"></div>';
  }

  /**
   * HTML转义
   * @param {string} text - 待转义文本
   * @returns {string} 转义后的文本
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
