/**
 * CommentInput - 批注输入组件
 * @module features/annotation/tools/comment/comment-input
 * @description 提供批注文本输入界面
 */

import { getLogger } from '../../../../../common/utils/logger.js';

/**
 * 批注输入组件类
 * @class CommentInput
 */
export class CommentInput {
  /** @type {import('../../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('CommentInput');

  /** @type {HTMLElement} 输入框容器 */
  #container = null;

  /** @type {HTMLTextAreaElement} 文本输入框 */
  #textarea = null;

  /** @type {Function} 确认回调 */
  #onConfirm = null;

  /** @type {Function} 取消回调 */
  #onCancel = null;

  /** @type {Object} 位置信息 */
  #position = null;

  /** @type {Function} 键盘事件处理器 */
  #handleKeydown = null;

  /**
   * 构造函数
   */
  constructor() {
    this.#logger.info('CommentInput created');
  }

  /**
   * 显示输入框
   * @param {Object} options - 选项
   * @param {number} options.x - X坐标（相对于视口）
   * @param {number} options.y - Y坐标（相对于视口）
   * @param {number} options.pageNumber - 页码
   * @param {Function} options.onConfirm - 确认回调 (content) => void
   * @param {Function} options.onCancel - 取消回调 () => void
   */
  show(options) {
    const { x, y, pageNumber, onConfirm, onCancel } = options;

    this.#position = { x, y, pageNumber };
    this.#onConfirm = onConfirm;
    this.#onCancel = onCancel;

    // 调整位置避免超出视口
    const adjustedX = Math.min(x, window.innerWidth - 320); // 320px是输入框大致宽度
    const adjustedY = Math.min(y, window.innerHeight - 200); // 200px是输入框大致高度

    // 创建输入框容器
    this.#container = document.createElement('div');
    this.#container.className = 'comment-input-container';
    this.#container.style.cssText = `
      position: fixed;
      left: ${adjustedX}px;
      top: ${adjustedY}px;
      z-index: 10000;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 280px;
      max-width: 400px;
    `;

    // 创建文本输入框
    this.#textarea = document.createElement('textarea');
    this.#textarea.className = 'comment-input-textarea';
    this.#textarea.placeholder = '输入批注内容...';
    this.#textarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 8px;
      box-sizing: border-box;
    `;

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `;

    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 6px 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => this.#handleCancel());

    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认';
    confirmBtn.style.cssText = `
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      background: #4CAF50;
      color: white;
      cursor: pointer;
      font-size: 14px;
    `;
    confirmBtn.addEventListener('click', () => this.#handleConfirm());

    // 组装UI
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    this.#container.appendChild(this.#textarea);
    this.#container.appendChild(buttonContainer);

    // 添加到body（因为使用fixed定位）
    document.body.appendChild(this.#container);

    // 自动聚焦
    this.#textarea.focus();

    // 监听ESC键取消
    this.#handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.#handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.#handleConfirm();
      }
    };
    document.addEventListener('keydown', this.#handleKeydown);

    this.#logger.info(`Comment input shown at (${x}, ${y}) on page ${pageNumber}`);
  }

  /**
   * 处理确认
   * @private
   */
  #handleConfirm() {
    const content = this.#textarea.value.trim();

    if (!content) {
      this.#logger.warn('Comment content is empty');
      this.#textarea.focus();
      return;
    }

    this.#logger.info(`Comment confirmed: "${content}"`);

    if (this.#onConfirm) {
      this.#onConfirm(content);
    }

    this.hide();
  }

  /**
   * 处理取消
   * @private
   */
  #handleCancel() {
    this.#logger.info('Comment input cancelled');

    if (this.#onCancel) {
      this.#onCancel();
    }

    this.hide();
  }

  /**
   * 隐藏输入框
   */
  hide() {
    if (this.#container) {
      this.#container.remove();
      this.#container = null;
    }

    if (this.#handleKeydown) {
      document.removeEventListener('keydown', this.#handleKeydown);
      this.#handleKeydown = null;
    }

    this.#textarea = null;
    this.#onConfirm = null;
    this.#onCancel = null;
    this.#position = null;

    this.#logger.info('Comment input hidden');
  }

  /**
   * 检查是否显示中
   * @returns {boolean}
   */
  isVisible() {
    return this.#container !== null;
  }

  /**
   * 销毁组件
   */
  destroy() {
    this.hide();
    this.#logger.info('CommentInput destroyed');
  }
}

export default CommentInput;
