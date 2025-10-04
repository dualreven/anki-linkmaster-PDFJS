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
   * 是否处于排序模式
   * @type {boolean}
   * @private
   */
  #sortMode = false;

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
      tooltip: '将当前页添加为书签'
    });

    // 删除按钮
    this.#buttons.delete = this.#createButton({
      id: 'delete',
      icon: '🗑️',
      tooltip: '删除选中的书签'
    });

    // 修改按钮
    this.#buttons.edit = this.#createButton({
      id: 'edit',
      icon: '✏️',
      tooltip: '编辑选中的书签'
    });

    // 分隔符
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 20px; background-color: #ccc; margin: 0 4px;';

    // 排序按钮
    this.#buttons.sort = this.#createButton({
      id: 'sort',
      icon: '⇅',
      tooltip: '进入排序模式'
    });

    // 组装工具栏
    toolbar.appendChild(this.#buttons.add);
    toolbar.appendChild(this.#buttons.delete);
    toolbar.appendChild(this.#buttons.edit);
    toolbar.appendChild(separator);
    toolbar.appendChild(this.#buttons.sort);

    return toolbar;
  }

  /**
   * 创建按钮元素
   * @param {Object} config - 按钮配置
   * @param {string} config.id - 按钮ID
   * @param {string} config.icon - 按钮图标
   * @param {string} config.tooltip - 提示文本
   * @returns {HTMLElement} 按钮元素
   * @private
   */
  #createButton({ id, icon, tooltip }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = id;
    button.title = tooltip;
    button.innerHTML = `<span style="font-size:20px;">${icon}</span>`;
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
      transition: all 0.2s;
    `;

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      if (!button.disabled && !button.dataset.active) {
        button.style.backgroundColor = '#e8e8e8';
        button.style.borderColor = '#aaa';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.disabled && !button.dataset.active) {
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
    this.#buttons.sort.addEventListener('click', () => this.#handleSortClick());

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
   * 处理排序按钮点击
   * @private
   */
  #handleSortClick() {
    this.#sortMode = !this.#sortMode;
    this.#logger.info(`Sort mode ${this.#sortMode ? 'enabled' : 'disabled'}`);

    // 更新按钮样式
    const sortBtn = this.#buttons.sort;
    if (this.#sortMode) {
      sortBtn.dataset.active = 'true';  // 标记为激活状态
      sortBtn.style.backgroundColor = '#4CAF50';
      sortBtn.style.borderColor = '#4CAF50';
      // 显示toast提醒
      this.#showToast('拖动书签进行排序');
    } else {
      sortBtn.dataset.active = '';  // 移除激活状态
      sortBtn.style.backgroundColor = 'white';
      sortBtn.style.borderColor = '#ccc';
      // 显示toast提醒
      this.#showToast('排序模式已关闭');
    }

    // 发出排序模式切换事件
    this.#eventBus.emit(
      'pdf-viewer:bookmark-sort:mode-changed',
      { sortMode: this.#sortMode },
      { actorId: 'BookmarkToolbar' }
    );
  }

  /**
   * 显示Toast提醒
   * @param {string} message - 提示消息
   * @private
   */
  #showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    if (!document.querySelector('#toast-animation-style')) {
      style.id = 'toast-animation-style';
      document.head.appendChild(style);
    }

    // 添加到页面
    document.body.appendChild(toast);

    // 2秒后自动移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2000);
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
