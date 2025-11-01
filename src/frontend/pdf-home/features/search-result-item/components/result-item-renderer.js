/**
 * 搜索结果条目渲染器
 * 负责渲染单个PDF结果条目的HTML
 */

export class ResultItemRenderer {
  #logger = null;
  #config = null;

  constructor(logger, config = {}) {
    this.#logger = logger;
    this.#config = {
      showMetadata: true,
      showTags: true,
      showNotes: true,
      ...config
    };
  }

  /**
   * 渲染条目
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   */
  render(data) {
    this.#logger.debug("[ResultItemRenderer] Rendering item:", data.title);

    return `
      <div class="search-result-item" data-id="${data.id}">
        <!-- 顶部：多选框 + 图标 + 内容 -->
        <div class="search-result-item-header">
          <!-- 多选框 -->
          <div class="search-result-item-checkbox">
            <input type="checkbox" class="search-result-checkbox" data-id="${data.id}">
          </div>

          <!-- PDF图标 -->
          <div class="search-result-item-icon">
            📄
          </div>

          <!-- 主要内容 -->
          <div class="search-result-item-content">
            <h3 class="search-result-item-title">${this.#escapeHtml(data.title || "无标题")}</h3>
            ${this.#renderBasicInfo(data)}
            ${this.#renderMetadata(data)}
            ${this.#renderTags(data)}
            ${this.#renderLearningInfo(data)}
            ${this.#renderTimeInfo(data)}
            ${this.#renderNotes(data)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染所有信息（合并显示）
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderBasicInfo(data) {
    const allFields = [];

    // 作者
    if (data.author) {
      allFields.push(`作者: ${this.#escapeHtml(data.author)}`);
    }

    // 主题
    if (data.subject) {
      allFields.push(`主题: ${this.#escapeHtml(data.subject)}`);
    }

    // 关键词
    if (data.keywords) {
      allFields.push(`关键词: ${this.#escapeHtml(data.keywords)}`);
    }

    if (allFields.length === 0) {return "";}

    return `
      <div class="search-result-item-section">
        ${allFields.map(field => `<span class="search-result-item-field-value">${field}</span>`).join(" | ")}
      </div>
    `;
  }

  /**
   * 渲染文件信息（合并显示）
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderMetadata(data) {
    const fields = [];

    // 文件名
    if (data.filename) {
      fields.push(`文件: ${this.#escapeHtml(data.filename)}`);
    }

    // 页数
    if (data.page_count) {
      fields.push(`${data.page_count}页`);
    }

    // 文件大小
    if (data.file_size) {
      const sizeMB = (data.file_size / (1024 * 1024)).toFixed(2);
      fields.push(`${sizeMB}MB`);
    }

    // ID
    if (data.id) {
      fields.push(`ID: ${this.#escapeHtml(data.id)}`);
    }

    if (fields.length === 0) {return "";}

    return `
      <div class="search-result-item-section">
        ${fields.map(field => `<span class="search-result-item-field-value">${field}</span>`).join(" | ")}
      </div>
    `;
  }

  /**
   * 渲染学习和时间信息（合并显示）
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderLearningInfo(data) {
    const fields = [];

    // 评分
    if (data.rating !== undefined && data.rating !== null) {
      const stars = "⭐".repeat(data.rating);
      fields.push(`评分: ${stars}`);
    }

    // 复习次数
    if (data.review_count !== undefined && data.review_count !== null) {
      fields.push(`复习${data.review_count}次`);
    }

    // 总阅读时长
    if (data.total_reading_time !== undefined && data.total_reading_time !== null && data.total_reading_time > 0) {
      const hours = (data.total_reading_time / 3600).toFixed(1);
      fields.push(`阅读${hours}h`);
    }

    // 到期日期
    if (data.due_date) {
      const dueDate = new Date(data.due_date * 1000);
      const dueDateStr = dueDate.toLocaleDateString("zh-CN");
      fields.push(`到期: ${dueDateStr}`);
    }

    if (fields.length === 0) {return "";}

    return `
      <div class="search-result-item-section">
        ${fields.map(field => `<span class="search-result-item-field-value">${field}</span>`).join(" | ")}
      </div>
    `;
  }

  /**
   * 渲染时间信息（合并显示）
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderTimeInfo(data) {
    const fields = [];

    // 最后访问时间（优先显示）
    if (data.last_accessed_at) {
      const date = new Date(data.last_accessed_at * 1000);
      const dateStr = date.toLocaleDateString("zh-CN");
      const timeStr = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      fields.push(`访问: ${dateStr} ${timeStr}`);
    }

    // 创建时间
    if (data.created_time) {
      fields.push(`创建: ${this.#escapeHtml(data.created_time)}`);
    }

    // 修改时间
    if (data.modified_time) {
      fields.push(`修改: ${this.#escapeHtml(data.modified_time)}`);
    }

    // 上传时间
    if (data.upload_time) {
      const uploadDate = new Date(data.upload_time);
      const uploadStr = uploadDate.toLocaleDateString("zh-CN");
      fields.push(`上传: ${uploadStr}`);
    }

    if (fields.length === 0) {return "";}

    return `
      <div class="search-result-item-section">
        ${fields.map(field => `<span class="search-result-item-field-value">${field}</span>`).join(" | ")}
      </div>
    `;
  }

  /**
   * 渲染标签
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderTags(data) {
    if (!this.#config.showTags) {return "";}
    if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
      return "";
    }

    const tagElements = data.tags.map(tag => `
      <span class="search-result-item-tag">${this.#escapeHtml(tag)}</span>
    `).join("");

    return `
      <div class="search-result-item-tags">
        ${tagElements}
      </div>
    `;
  }

  /**
   * 渲染备注摘要
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   * @private
   */
  #renderNotes(data) {
    if (!this.#config.showNotes) {return "";}
    if (!data.notes || data.notes.trim() === "") {return "";}

    return `
      <div class="search-result-item-section">
        <span class="search-result-item-field-value">💬 ${this.#escapeHtml(data.notes)}</span>
      </div>
    `;
  }

  /**
   * HTML转义
   * @param {string} text - 待转义文本
   * @returns {string} 转义后的文本
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
