/**
 * @file 预设下拉菜单组件
 * @module features/filter/components/preset-dropdown
 * @description
 * 提供预设筛选条件的下拉菜单UI组件
 */

/**
 * 预设下拉菜单类
 * @class PresetDropdown
 */
export class PresetDropdown {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 事件总线
   * @type {ScopedEventBus}
   * @private
   */
  #eventBus = null;

  /**
   * 触发按钮
   * @type {HTMLElement|null}
   * @private
   */
  #triggerButton = null;

  /**
   * 下拉菜单DOM元素
   * @type {HTMLElement|null}
   * @private
   */
  #menuElement = null;

  /**
   * 点击外部关闭处理器
   * @type {Function|null}
   * @private
   */
  #outsideClickHandler = null;

  /**
   * 预设数据列表
   * @type {Array<{id: string, name: string, desc: string}>}
   * @private
   */
  #presets = [
    { id: 'recent', name: '📅 最近添加', desc: '最近7天添加的文件' },
    { id: 'important', name: '⭐ 重要文件', desc: '重要性为高的文件' },
    { id: 'large', name: '📦 大文件', desc: '文件大小 > 10MB' },
    { id: 'untagged', name: '🏷️ 未标记', desc: '未添加标签的文件' }
  ];

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {ScopedEventBus} eventBus - 作用域事件总线
   */
  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染组件
   * @param {string} triggerButtonId - 触发按钮的ID
   * @public
   */
  render(triggerButtonId) {
    this.#triggerButton = document.getElementById(triggerButtonId);
    if (!this.#triggerButton) {
      this.#logger.warn(`[PresetDropdown] Trigger button not found: ${triggerButtonId}`);
      return;
    }

    // 创建下拉菜单DOM
    this.#createMenuDOM();

    // 绑定事件
    this.#attachEventListeners();

    this.#logger.info('[PresetDropdown] Rendered');
  }

  /**
   * 创建下拉菜单DOM结构
   * @private
   */
  #createMenuDOM() {
    this.#menuElement = document.createElement('div');
    this.#menuElement.className = 'preset-dropdown-menu';
    this.#menuElement.hidden = true;

    // 生成菜单项
    this.#presets.forEach(preset => {
      const item = this.#createMenuItem(preset);
      this.#menuElement.appendChild(item);
    });

    // 添加到body
    document.body.appendChild(this.#menuElement);

    this.#logger.debug('[PresetDropdown] Menu DOM created');
  }

  /**
   * 创建菜单项
   * @param {{id: string, name: string, desc: string}} preset - 预设数据
   * @returns {HTMLElement}
   * @private
   */
  #createMenuItem(preset) {
    const item = document.createElement('div');
    item.className = 'preset-menu-item';
    item.dataset.presetId = preset.id;

    item.innerHTML = `
      <div class="preset-menu-item-name">${preset.name}</div>
      <div class="preset-menu-item-desc">${preset.desc}</div>
    `;

    // 点击菜单项
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handlePresetClick(preset);
      this.hide();
    });

    return item;
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 触发按钮点击
    this.#triggerButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // 点击外部关闭
    this.#outsideClickHandler = () => {
      this.hide();
    };

    this.#logger.debug('[PresetDropdown] Event listeners attached');
  }

  /**
   * 处理预设点击
   * @param {{id: string, name: string, desc: string}} preset - 预设数据
   * @private
   */
  #handlePresetClick(preset) {
    this.#logger.info(`[PresetDropdown] Preset clicked: ${preset.id}`);

    // 触发事件
    this.#eventBus.emit('filter:preset:selected', {
      presetId: preset.id,
      presetName: preset.name
    });

    // TODO: 临时提示，后续实现实际筛选逻辑
    alert(`预设"${preset.name}"功能开发中...`);
  }

  /**
   * 显示下拉菜单
   * @public
   */
  show() {
    if (!this.#menuElement || !this.#triggerButton) return;

    // 定位菜单
    const rect = this.#triggerButton.getBoundingClientRect();
    this.#menuElement.style.top = `${rect.bottom + 5}px`;
    this.#menuElement.style.left = `${rect.left}px`;

    // 显示菜单
    this.#menuElement.hidden = false;

    // 添加外部点击监听
    setTimeout(() => {
      document.addEventListener('click', this.#outsideClickHandler);
    }, 0);

    this.#logger.debug('[PresetDropdown] Menu shown');
  }

  /**
   * 隐藏下拉菜单
   * @public
   */
  hide() {
    if (!this.#menuElement) return;

    this.#menuElement.hidden = true;

    // 移除外部点击监听
    document.removeEventListener('click', this.#outsideClickHandler);

    this.#logger.debug('[PresetDropdown] Menu hidden');
  }

  /**
   * 切换显示/隐藏
   * @public
   */
  toggle() {
    if (this.#menuElement && this.#menuElement.hidden) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    // 移除事件监听
    if (this.#outsideClickHandler) {
      document.removeEventListener('click', this.#outsideClickHandler);
      this.#outsideClickHandler = null;
    }

    // 移除DOM
    if (this.#menuElement) {
      this.#menuElement.remove();
      this.#menuElement = null;
    }

    this.#triggerButton = null;

    this.#logger.info('[PresetDropdown] Destroyed');
  }
}
