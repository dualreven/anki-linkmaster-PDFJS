/**
 * FloatingColorToolbar - 浮动颜色工具栏
 * @module features/annotation/tools/text-highlight/floating-color-toolbar
 * @description 在选中文字上方显示浮动的颜色选择工具栏
 */

/**
 * 浮动颜色工具栏
 * @class FloatingColorToolbar
 */
export class FloatingColorToolbar {
  /** @type {HTMLElement} */
  #toolbarEl = null;

  /** @type {Function} */
  #onColorSelectedCallback = null;

  /** @type {Function} */
  #onCancelCallback = null;

  /** @type {Array<string>} */
  #colors;

  /** @type {boolean} */
  #isVisible = false;

  /**
   * 构造函数
   * @param {Object} options - 选项
   * @param {Array<string>} [options.colors] - 预设颜色数组（hex格式）
   * @param {Function} [options.onColorSelected] - 选择颜色的回调
   * @param {Function} [options.onCancel] - 取消的回调
   */
  constructor(options = {}) {
    this.#colors = options.colors || [
      '#ffeb3b', // 黄色
      '#4caf50', // 绿色
      '#2196f3', // 蓝色
      '#ff9800', // 橙色
      '#e91e63', // 粉色
      '#9c27b0'  // 紫色
    ];

    this.#onColorSelectedCallback = options.onColorSelected || null;
    this.#onCancelCallback = options.onCancel || null;

    this.#createToolbar();
  }

  /**
   * 创建工具栏元素
   * @private
   */
  #createToolbar() {
    // 创建工具栏容器
    this.#toolbarEl = document.createElement('div');
    this.#toolbarEl.className = 'floating-color-toolbar';
    this.#toolbarEl.style.cssText = `
      position: absolute;
      z-index: 10000;
      display: none;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      gap: 6px;
      flex-direction: row;
      align-items: center;
    `;

    // 创建颜色按钮
    this.#colors.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'color-option';
      colorBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: 2px solid #ccc;
        border-radius: 50%;
        cursor: pointer;
        background-color: ${color};
        transition: all 0.2s;
        padding: 0;
        outline: none;
      `;
      colorBtn.title = `高亮颜色: ${color}`;

      // 鼠标悬停效果
      colorBtn.addEventListener('mouseenter', () => {
        colorBtn.style.transform = 'scale(1.15)';
        colorBtn.style.borderColor = '#666';
      });

      colorBtn.addEventListener('mouseleave', () => {
        colorBtn.style.transform = 'scale(1)';
        colorBtn.style.borderColor = '#ccc';
      });

      // 点击选择颜色
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#handleColorSelected(color);
      });

      this.#toolbarEl.appendChild(colorBtn);
    });

    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = '✕';
    cancelBtn.title = '取消高亮';
    cancelBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border: 2px solid #ccc;
      border-radius: 50%;
      cursor: pointer;
      background: white;
      color: #666;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s;
      margin-left: 4px;
      padding: 0;
      outline: none;
    `;

    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.transform = 'scale(1.15)';
      cancelBtn.style.borderColor = '#666';
      cancelBtn.style.color = '#333';
    });

    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.transform = 'scale(1)';
      cancelBtn.style.borderColor = '#ccc';
      cancelBtn.style.color = '#666';
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleCancel();
    });

    this.#toolbarEl.appendChild(cancelBtn);

    // 添加到页面
    document.body.appendChild(this.#toolbarEl);

    // 点击外部隐藏工具栏
    document.addEventListener('mousedown', this.#handleOutsideClick.bind(this));
  }

  /**
   * 处理外部点击
   * @param {MouseEvent} e - 鼠标事件
   * @private
   */
  #handleOutsideClick(e) {
    if (this.#isVisible && !this.#toolbarEl.contains(e.target)) {
      this.hide();
      if (this.#onCancelCallback) {
        this.#onCancelCallback();
      }
    }
  }

  /**
   * 处理颜色选择
   * @param {string} color - 选中的颜色
   * @private
   */
  #handleColorSelected(color) {
    this.hide();
    if (this.#onColorSelectedCallback) {
      this.#onColorSelectedCallback(color);
    }
  }

  /**
   * 处理取消
   * @private
   */
  #handleCancel() {
    this.hide();
    if (this.#onCancelCallback) {
      this.#onCancelCallback();
    }
  }

  /**
   * 显示工具栏
   * @param {Object} rect - 选中文字的边界矩形（相对于viewport）
   * @param {number} rect.left - 左边距
   * @param {number} rect.top - 上边距
   * @param {number} rect.width - 宽度
   * @param {number} rect.height - 高度
   */
  show(rect) {
    // 计算工具栏位置（显示在选中文字上方）
    const toolbarHeight = 48; // 工具栏高度（包括padding）
    const toolbarWidth = this.#toolbarEl.offsetWidth || 300; // 工具栏宽度
    const gap = 8; // 与选中文字的间距

    // 工具栏左对齐选中文字，但确保不超出视口
    let left = rect.left + window.scrollX;
    let top = rect.top + window.scrollY - toolbarHeight - gap;

    // 如果上方空间不足，显示在下方
    if (rect.top < toolbarHeight + gap) {
      top = rect.top + window.scrollY + rect.height + gap;
    }

    // 确保工具栏不超出视口右侧
    const viewportWidth = window.innerWidth;
    if (left + toolbarWidth > viewportWidth + window.scrollX) {
      left = viewportWidth + window.scrollX - toolbarWidth - 10;
    }

    // 确保工具栏不超出视口左侧
    if (left < window.scrollX) {
      left = window.scrollX + 10;
    }

    this.#toolbarEl.style.left = `${left}px`;
    this.#toolbarEl.style.top = `${top}px`;
    this.#toolbarEl.style.display = 'flex';
    this.#isVisible = true;
  }

  /**
   * 隐藏工具栏
   */
  hide() {
    this.#toolbarEl.style.display = 'none';
    this.#isVisible = false;
  }

  /**
   * 检查是否可见
   * @returns {boolean}
   */
  isVisible() {
    return this.#isVisible;
  }

  /**
   * 销毁工具栏
   */
  destroy() {
    if (this.#toolbarEl && this.#toolbarEl.parentNode) {
      this.#toolbarEl.remove();
    }
    this.#toolbarEl = null;
    this.#onColorSelectedCallback = null;
    this.#onCancelCallback = null;
  }
}
