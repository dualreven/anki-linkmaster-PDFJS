/**
 * @file BookmarkToolbar 书签工具栏组件
 * @module features/pdf-bookmark/components/bookmark-toolbar
 * @description 提供书签管理操作按钮（添加、删除、修改、拖动提示）
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

/**
 * BookmarkToolbar 工具栏组件类
 * @class BookmarkToolbar
 */
export class BookmarkToolbar {
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
   * 工具栏容器元素
   * @type {HTMLElement}
   * @private
   */
  #container;

  /**
   * 按钮元素引用
   * @type {Object}
   * @private
   */
  #buttons = {};

  /**
   * 当前选中的书签ID
   * @type {string|null}
   * @private
   */
  #selectedBookmarkId = null;

  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.eventBus - 事件总线
   */
  constructor({ eventBus }) {
    this.#logger = getLogger('BookmarkToolbar');
    this.#eventBus = eventBus;
  }

  /**
   * 初始化工具栏
   * @returns {void}
   */
  initialize() {
    this.#container = this.#createToolbarElement();
    this.#setupEventListeners();
    this.#updateButtonStates();
    this.#logger.info('BookmarkToolbar initialized');
  }

  /**
   * 创建工具栏元素
   * @returns {HTMLElement} 工具栏容器
   * @private
   */
  #createToolbarElement() {
    const toolbar = document.createElement('div');
    toolbar.className = 'bookmark-toolbar';
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #ddd;
      background-color: #f5f5f5;
    `;

    // 添加按钮
    this.#buttons.add = this.#createButton({
      id: 'add',
      icon: '➕',
      title: '添加书签',
      tooltip: '将当前页添加为书签'
    });

    // 删除按钮
    this.#buttons.delete = this.#createButton({
      id: 'delete',
      icon: '🗑️',
      title: '删除',
      tooltip: '删除选中的书签'
    });

    // 修改按钮
    this.#buttons.edit = this.#createButton({
      id: 'edit',
      icon: '✏️',
      title: '编辑',
      tooltip: '编辑选中的书签'
    });

    // 分隔符
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 20px; background-color: #ccc; margin: 0 4px;';

    // 拖动提示图标
    const dragHint = document.createElement('div');
    dragHint.innerHTML = '⇅';
    dragHint.title = '提示：可以拖动书签进行排序';
    dragHint.style.cssText = `
      font-size: 16px;
      color: #666;
      cursor: help;
      padding: 4px 8px;
    `;

    // 组装工具栏
    toolbar.appendChild(this.#buttons.add);
    toolbar.appendChild(this.#buttons.delete);
    toolbar.appendChild(this.#buttons.edit);
    toolbar.appendChild(separator);
    toolbar.appendChild(dragHint);

    return toolbar;
  }

  /**
   * 创建按钮元素
   * @param {Object} config - 按钮配置
   * @param {string} config.id - 按钮ID
   * @param {string} config.icon - 按钮图标
   * @param {string} config.title - 按钮文本
   * @param {string} config.tooltip - 提示文本
   * @returns {HTMLElement} 按钮元素
   * @private
   */
  #createButton({ id, icon, title, tooltip }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = id;
    button.title = tooltip;
    button.innerHTML = `<span style="font-size:16px;margin-right:4px;">${icon}</span><span>${title}</span>`;
    button.style.cssText = `
      display: flex;
      align-items: center;
      padding: 6px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    `;

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.backgroundColor = '#e8e8e8';
        button.style.borderColor = '#aaa';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.backgroundColor = 'white';
        button.style.borderColor = '#ccc';
      }
    });

    return button;
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 按钮点击事件
    this.#buttons.add.addEventListener('click', () => this.#handleAddClick());
    this.#buttons.delete.addEventListener('click', () => this.#handleDeleteClick());
    this.#buttons.edit.addEventListener('click', () => this.#handleEditClick());

    // 监听书签选择变化
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
      (data) => this.#handleSelectionChanged(data),
      { subscriberId: 'BookmarkToolbar' }
    );
  }

  /**
   * 处理添加按钮点击
   * @private
   */
  #handleAddClick() {
    this.#logger.info('Add bookmark button clicked');
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.CREATE.REQUESTED,
      { source: 'toolbar' },
      { actorId: 'BookmarkToolbar' }
    );
  }

  /**
   * 处理删除按钮点击
   * @private
   */
  #handleDeleteClick() {
    if (!this.#selectedBookmarkId) return;

    this.#logger.info(`Delete bookmark button clicked: ${this.#selectedBookmarkId}`);
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.DELETE.REQUESTED,
      { bookmarkId: this.#selectedBookmarkId },
      { actorId: 'BookmarkToolbar' }
    );
  }

  /**
   * 处理编辑按钮点击
   * @private
   */
  #handleEditClick() {
    if (!this.#selectedBookmarkId) return;

    this.#logger.info(`Edit bookmark button clicked: ${this.#selectedBookmarkId}`);
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.REQUESTED,
      { bookmarkId: this.#selectedBookmarkId },
      { actorId: 'BookmarkToolbar' }
    );
  }

  /**
   * 处理书签选择变化
   * @param {Object} data - 选择数据
   * @param {string|null} data.bookmarkId - 书签ID
   * @private
   */
  #handleSelectionChanged(data) {
    this.#selectedBookmarkId = data?.bookmarkId || null;
    this.#updateButtonStates();
    this.#logger.debug(`Selection changed: ${this.#selectedBookmarkId}`);
  }

  /**
   * 更新按钮启用/禁用状态
   * @private
   */
  #updateButtonStates() {
    const hasSelection = !!this.#selectedBookmarkId;

    // 添加按钮始终启用
    this.#setButtonEnabled(this.#buttons.add, true);

    // 删除和编辑按钮仅在有选中时启用
    this.#setButtonEnabled(this.#buttons.delete, hasSelection);
    this.#setButtonEnabled(this.#buttons.edit, hasSelection);
  }

  /**
   * 设置按钮启用/禁用状态
   * @param {HTMLElement} button - 按钮元素
   * @param {boolean} enabled - 是否启用
   * @private
   */
  #setButtonEnabled(button, enabled) {
    button.disabled = !enabled;
    if (enabled) {
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    } else {
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
    }
  }

  /**
   * 获取工具栏元素
   * @returns {HTMLElement} 工具栏容器
   */
  getElement() {
    return this.#container;
  }

  /**
   * 销毁工具栏
   * @returns {void}
   */
  destroy() {
    if (this.#container && this.#container.parentNode) {
      this.#container.parentNode.removeChild(this.#container);
    }
    this.#container = null;
    this.#buttons = {};
    this.#logger.info('BookmarkToolbar destroyed');
  }
}

export default BookmarkToolbar;
