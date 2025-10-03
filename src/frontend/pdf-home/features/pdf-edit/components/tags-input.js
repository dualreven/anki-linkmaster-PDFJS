/**
 * @file 标签输入组件
 * @module TagsInput
 * @description
 * 原生JavaScript实现的多标签输入组件
 * 支持添加、删除、键盘导航、预设标签
 */

/**
 * 标签输入组件类
 * @class TagsInput
 * @description
 * 提供交互式多标签输入功能，支持键盘操作和标签管理
 */
export class TagsInput {
  // 私有字段
  #container;
  #tags;
  #input;
  #onChange;
  #placeholder;
  #maxTags;
  #allowDuplicates;
  #validator;

  /**
   * 创建TagsInput实例
   * @param {Object} options - 配置选项
   * @param {HTMLElement} options.container - 容器元素
   * @param {Array<string>} [options.tags=[]] - 初始标签数组
   * @param {string} [options.placeholder='添加标签...'] - 输入框占位符
   * @param {number} [options.maxTags=10] - 最大标签数量
   * @param {boolean} [options.allowDuplicates=false] - 是否允许重复标签
   * @param {Function} [options.onChange] - 标签变化回调
   * @param {Function} [options.validator] - 标签验证函数
   */
  constructor(options = {}) {
    this.#container = options.container;
    this.#tags = options.tags ? [...options.tags] : [];
    this.#placeholder = options.placeholder || '添加标签...';
    this.#maxTags = options.maxTags || 10;
    this.#allowDuplicates = options.allowDuplicates || false;
    this.#onChange = options.onChange;
    this.#validator = options.validator;

    this.#init();
  }

  /**
   * 初始化组件
   * @private
   */
  #init() {
    this.#container.classList.add('tags-input');
    this.#render();
    this.#bindEvents();
  }

  /**
   * 渲染组件
   * @private
   */
  #render() {
    this.#container.innerHTML = `
      <div class="tags-container"></div>
      <input
        type="text"
        class="tag-input"
        placeholder="${this.#placeholder}"
        ${this.#tags.length >= this.#maxTags ? 'disabled' : ''}
      />
    `;

    this.#input = this.#container.querySelector('.tag-input');
    this.#renderTags();
  }

  /**
   * 渲染标签列表
   * @private
   */
  #renderTags() {
    const tagsContainer = this.#container.querySelector('.tags-container');
    tagsContainer.innerHTML = '';

    this.#tags.forEach((tag, index) => {
      const tagElement = document.createElement('span');
      tagElement.classList.add('tag');
      tagElement.dataset.index = index;
      tagElement.innerHTML = `
        <span class="tag-text">${this.#escapeHtml(tag)}</span>
        <button type="button" class="tag-remove" aria-label="移除标签">×</button>
      `;
      tagsContainer.appendChild(tagElement);
    });

    // 更新输入框状态
    if (this.#tags.length >= this.#maxTags) {
      this.#input.disabled = true;
      this.#input.placeholder = `最多${this.#maxTags}个标签`;
    } else {
      this.#input.disabled = false;
      this.#input.placeholder = this.#placeholder;
    }
  }

  /**
   * 绑定事件监听器
   * @private
   */
  #bindEvents() {
    // 输入框键盘事件
    this.#input.addEventListener('keydown', this.#handleKeyDown.bind(this));

    // 删除按钮点击事件
    this.#container.addEventListener('click', (event) => {
      const removeButton = event.target.closest('.tag-remove');
      if (removeButton) {
        const tagElement = removeButton.closest('.tag');
        const index = parseInt(tagElement.dataset.index);
        this.removeTag(index);
      }
    });

    // 容器点击聚焦输入框
    this.#container.addEventListener('click', (event) => {
      if (event.target === this.#container ||
          event.target.classList.contains('tags-container')) {
        this.#input.focus();
      }
    });
  }

  /**
   * 处理键盘事件
   * @private
   * @param {KeyboardEvent} event - 键盘事件
   */
  #handleKeyDown(event) {
    const value = this.#input.value.trim();

    if (event.key === 'Enter' && value) {
      event.preventDefault();
      this.addTag(value);
    } else if (event.key === 'Backspace' && !value && this.#tags.length > 0) {
      // 输入框为空时，退格删除最后一个标签
      event.preventDefault();
      this.removeTag(this.#tags.length - 1);
    }
  }

  /**
   * 添加标签
   * @public
   * @param {string} tag - 要添加的标签
   * @returns {boolean} 是否添加成功
   */
  addTag(tag) {
    const trimmedTag = tag.trim();

    // 验证标签
    if (!trimmedTag) return false;
    if (this.#tags.length >= this.#maxTags) return false;
    if (!this.#allowDuplicates && this.#tags.includes(trimmedTag)) return false;
    if (this.#validator && !this.#validator(trimmedTag)) return false;

    this.#tags.push(trimmedTag);
    this.#input.value = '';
    this.#renderTags();
    this.#notifyChange();

    return true;
  }

  /**
   * 删除标签
   * @public
   * @param {number} index - 标签索引
   * @returns {boolean} 是否删除成功
   */
  removeTag(index) {
    if (index < 0 || index >= this.#tags.length) return false;

    this.#tags.splice(index, 1);
    this.#renderTags();
    this.#notifyChange();
    this.#input.focus();

    return true;
  }

  /**
   * 设置标签数组
   * @public
   * @param {Array<string>} tags - 新的标签数组
   */
  setTags(tags) {
    this.#tags = tags ? [...tags] : [];
    this.#renderTags();
    this.#notifyChange();
  }

  /**
   * 获取标签数组
   * @public
   * @returns {Array<string>} 当前标签数组
   */
  getTags() {
    return [...this.#tags];
  }

  /**
   * 清空所有标签
   * @public
   */
  clear() {
    this.#tags = [];
    this.#renderTags();
    this.#notifyChange();
  }

  /**
   * 通知标签变化
   * @private
   */
  #notifyChange() {
    if (this.#onChange) {
      this.#onChange(this.getTags());
    }
  }

  /**
   * HTML转义
   * @private
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    this.#container.innerHTML = '';
  }
}

/**
 * 创建TagsInput组件的便捷函数
 * @param {Object} options - 配置选项
 * @returns {TagsInput} TagsInput实例
 */
export function createTagsInput(options) {
  return new TagsInput(options);
}
