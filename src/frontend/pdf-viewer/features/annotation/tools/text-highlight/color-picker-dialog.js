/**
 * ColorPickerDialog - 颜色选择对话框
 * @module features/annotation/tools/text-highlight/color-picker-dialog
 * @description 提供颜色选择UI，支持预设颜色和自定义颜色
 */

/**
 * 颜色选择对话框
 * @class ColorPickerDialog
 */
export class ColorPickerDialog {
  /** @type {HTMLElement} */
  #dialogEl = null;

  /** @type {HTMLElement} */
  #overlayEl = null;

  /** @type {Function} */
  #onSelectCallback = null;

  /** @type {Function} */
  #onCancelCallback = null;

  /** @type {Array<string>} */
  #presetColors;

  /** @type {boolean} */
  #allowCustomColor;

  /**
   * 构造函数
   * @param {Object} options - 选项
   * @param {Array<string>} [options.colors] - 预设颜色数组（hex格式）
   * @param {boolean} [options.allowCustomColor] - 是否允许自定义颜色
   * @param {Function} [options.onSelect] - 选择颜色的回调
   * @param {Function} [options.onCancel] - 取消的回调
   */
  constructor(options = {}) {
    this.#presetColors = options.colors || [
      '#ffff00', // 黄色
      '#00ff00', // 绿色
      '#00ffff', // 青色
      '#ff00ff', // 粉色
      '#ff6b6b', // 红色
      '#4ecdc4'  // 蓝绿色
    ];

    this.#allowCustomColor = options.allowCustomColor !== false;
    this.#onSelectCallback = options.onSelect || null;
    this.#onCancelCallback = options.onCancel || null;
  }

  /**
   * 显示对话框
   * @returns {Promise<string|null>} 选择的颜色（null表示取消）
   */
  show() {
    return new Promise((resolve) => {
      // 创建遮罩层
      this.#overlayEl = this.#createOverlay();

      // 创建对话框
      this.#dialogEl = this.#createDialog();

      // 设置回调
      this.#onSelectCallback = (color) => {
        this.hide();
        resolve(color);
      };

      this.#onCancelCallback = () => {
        this.hide();
        resolve(null);
      };

      // 添加到DOM
      document.body.appendChild(this.#overlayEl);
      document.body.appendChild(this.#dialogEl);

      // 触发动画
      requestAnimationFrame(() => {
        this.#overlayEl.style.opacity = '1';
        this.#dialogEl.style.opacity = '1';
        this.#dialogEl.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    });
  }

  /**
   * 隐藏对话框
   * @returns {void}
   */
  hide() {
    if (!this.#dialogEl || !this.#overlayEl) return;

    // 淡出动画
    this.#overlayEl.style.opacity = '0';
    this.#dialogEl.style.opacity = '0';
    this.#dialogEl.style.transform = 'translate(-50%, -50%) scale(0.9)';

    // 等待动画完成后移除
    setTimeout(() => {
      if (this.#overlayEl && this.#overlayEl.parentElement) {
        this.#overlayEl.remove();
      }
      if (this.#dialogEl && this.#dialogEl.parentElement) {
        this.#dialogEl.remove();
      }

      this.#dialogEl = null;
      this.#overlayEl = null;
    }, 200);
  }

  /**
   * 创建遮罩层
   * @returns {HTMLElement}
   * @private
   */
  #createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'color-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    overlay.addEventListener('click', () => {
      if (this.#onCancelCallback) {
        this.#onCancelCallback();
      }
    });

    return overlay;
  }

  /**
   * 创建对话框
   * @returns {HTMLElement}
   * @private
   */
  #createDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'color-picker-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 20px;
      z-index: 9999;
      min-width: 300px;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    // 标题
    const title = document.createElement('h3');
    title.textContent = '选择高亮颜色';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    `;
    dialog.appendChild(title);

    // 颜色网格
    const colorGrid = this.#createColorGrid();
    dialog.appendChild(colorGrid);

    // 自定义颜色（如果允许）
    if (this.#allowCustomColor) {
      const customColorSection = this.#createCustomColorSection();
      dialog.appendChild(customColorSection);
    }

    // 按钮组
    const buttonGroup = this.#createButtonGroup();
    dialog.appendChild(buttonGroup);

    // 阻止点击事件冒泡
    dialog.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    return dialog;
  }

  /**
   * 创建颜色网格
   * @returns {HTMLElement}
   * @private
   */
  #createColorGrid() {
    const grid = document.createElement('div');
    grid.className = 'color-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    `;

    this.#presetColors.forEach((color) => {
      const colorButton = this.#createColorButton(color);
      grid.appendChild(colorButton);
    });

    return grid;
  }

  /**
   * 创建颜色按钮
   * @param {string} color - 颜色值
   * @returns {HTMLElement}
   * @private
   */
  #createColorButton(color) {
    const button = document.createElement('button');
    button.className = 'color-button';
    button.style.cssText = `
      width: 100%;
      height: 48px;
      border: 2px solid #ddd;
      border-radius: 6px;
      background-color: ${color};
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.borderColor = '#999';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.borderColor = '#ddd';
    });

    button.addEventListener('click', () => {
      if (this.#onSelectCallback) {
        this.#onSelectCallback(color);
      }
    });

    // 添加颜色值文本
    const colorLabel = document.createElement('span');
    colorLabel.textContent = this.#getColorName(color);
    colorLabel.style.cssText = `
      position: absolute;
      bottom: 4px;
      right: 4px;
      font-size: 10px;
      color: rgba(0, 0, 0, 0.6);
      background: rgba(255, 255, 255, 0.8);
      padding: 2px 4px;
      border-radius: 3px;
    `;
    button.appendChild(colorLabel);

    return button;
  }

  /**
   * 创建自定义颜色区域
   * @returns {HTMLElement}
   * @private
   */
  #createCustomColorSection() {
    const section = document.createElement('div');
    section.className = 'custom-color-section';
    section.style.cssText = `
      margin-bottom: 16px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    `;

    const label = document.createElement('label');
    label.textContent = '自定义颜色：';
    label.style.cssText = `
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    `;
    section.appendChild(label);

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#ffff00';
    colorInput.style.cssText = `
      width: 50px;
      height: 40px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    `;

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = '#ffff00';
    textInput.placeholder = '#rrggbb';
    textInput.style.cssText = `
      flex: 1;
      height: 40px;
      padding: 0 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
    `;

    // 同步颜色选择器和文本输入
    colorInput.addEventListener('input', (e) => {
      textInput.value = e.target.value;
    });

    textInput.addEventListener('input', (e) => {
      const value = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        colorInput.value = value;
      }
    });

    const applyButton = document.createElement('button');
    applyButton.textContent = '应用';
    applyButton.style.cssText = `
      height: 40px;
      padding: 0 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s ease;
    `;

    applyButton.addEventListener('mouseenter', () => {
      applyButton.style.backgroundColor = '#45a049';
    });

    applyButton.addEventListener('mouseleave', () => {
      applyButton.style.backgroundColor = '#4CAF50';
    });

    applyButton.addEventListener('click', () => {
      const color = textInput.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        if (this.#onSelectCallback) {
          this.#onSelectCallback(color);
        }
      } else {
        alert('请输入有效的颜色格式（例如：#ffff00）');
      }
    });

    inputWrapper.appendChild(colorInput);
    inputWrapper.appendChild(textInput);
    inputWrapper.appendChild(applyButton);
    section.appendChild(inputWrapper);

    return section;
  }

  /**
   * 创建按钮组
   * @returns {HTMLElement}
   * @private
   */
  #createButtonGroup() {
    const group = document.createElement('div');
    group.className = 'button-group';
    group.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      background-color: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s ease;
    `;

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.backgroundColor = '#e0e0e0';
    });

    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.backgroundColor = '#f5f5f5';
    });

    cancelButton.addEventListener('click', () => {
      if (this.#onCancelCallback) {
        this.#onCancelCallback();
      }
    });

    group.appendChild(cancelButton);

    return group;
  }

  /**
   * 获取颜色名称
   * @param {string} hex - 十六进制颜色值
   * @returns {string} 颜色名称
   * @private
   */
  #getColorName(hex) {
    const colorNames = {
      '#ffff00': '黄色',
      '#00ff00': '绿色',
      '#00ffff': '青色',
      '#ff00ff': '粉色',
      '#ff6b6b': '红色',
      '#4ecdc4': '蓝绿'
    };

    return colorNames[hex.toLowerCase()] || hex;
  }

  /**
   * 销毁对话框
   * @returns {void}
   */
  destroy() {
    this.hide();
    this.#onSelectCallback = null;
    this.#onCancelCallback = null;
  }
}
