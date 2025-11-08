/**
 * @file 排序模式选择器组件
 * @module features/pdf-sorter/components/mode-selector
 * @description
 * 提供4种排序模式的选择：默认排序、手动拖拽、多级排序、加权排序
 */

// 统一入口：告警使用 logger.warn + { toast }, 不直接导入第三方 toast

/**
 * 排序模式枚举
 * @enum {number}
 */
export const SortMode = {
  DEFAULT: 0,    // 默认排序（Tabulator自带列头排序）
  MANUAL: 1,     // 手动拖拽
  MULTI: 2,      // 多级排序
  WEIGHTED: 3    // 加权排序
};

/**
 * 排序模式选择器组件
 * @class ModeSelector
 */
import { SORTER_EVENTS } from "../../../../common/event/event-constants.js";

export class ModeSelector {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 作用域事件总线
   * @type {ScopedEventBus}
   * @private
   */
  #eventBus = null;

  /**
   * 容器DOM元素
   * @type {HTMLElement|null}
   * @private
   */
  #container = null;

  /**
   * 当前选中的模式
   * @type {number}
   * @private
   */
  #currentMode = SortMode.MULTI;

  /**
   * 单选按钮元素列表
   * @type {NodeListOf<HTMLInputElement>|null}
   * @private
   */
  #radioButtons = null;

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {ScopedEventBus} eventBus - 作用域事件总线
   * @param {Object} options - 配置选项
   * @param {number} options.defaultMode - 默认选中的模式
   */
  constructor(logger, eventBus, options = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#currentMode = options.defaultMode ?? SortMode.MULTI;
  }

  /**
   * 渲染组件
   * @param {HTMLElement} container - 容器元素
   * @public
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#bindElements();
    this.#attachEventListeners();

    // 设置默认选中状态
    this.#updateRadioState();

    // 触发初始模式事件
    this.#eventBus.emit(SORTER_EVENTS.MODE.CHANGED, {
      mode: this.#currentMode,
      modeName: this.#getModeName(this.#currentMode)
    });

    this.#logger.info("[ModeSelector] Rendered");
  }

  /**
   * 获取HTML模板
   * @returns {string}
   * @private
   */
  #getTemplate() {
    return `
      <div class="sorter-mode-selector">
        <div class="mode-selector-header">
          <span class="mode-selector-icon">📊</span>
          <h3 class="mode-selector-title">排序模式</h3>
        </div>

        <div class="mode-selector-options">
          <label class="mode-option" data-mode="${SortMode.DEFAULT}" title="默认排序：按标题字母升序；与筛选互不冲突">
            <input
              type="radio"
              name="sort-mode"
              value="${SortMode.DEFAULT}"
              ${this.#currentMode === SortMode.DEFAULT ? "checked" : ""}
            />
            <span class="mode-option-content">
              <span class="mode-option-icon">🔢</span>
              <span class="mode-option-text">
                <strong>默认排序</strong>
                <small>点击列头进行排序</small>
              </span>
            </span>
          </label>

          <label class="mode-option disabled" data-mode="${SortMode.MANUAL}" data-disabled="true" title="手动拖拽：功能开发中">
            <input
              type="radio"
              name="sort-mode"
              value="${SortMode.MANUAL}"
              disabled
            />
            <span class="mode-option-content">
              <span class="mode-option-icon">✋</span>
              <span class="mode-option-text">
                <strong>手动拖拽</strong>
                <small>拖动行调整顺序（开发中）</small>
              </span>
            </span>
          </label>

          <label class="mode-option" data-mode="${SortMode.MULTI}">
            <input
              type="radio"
              name="sort-mode"
              value="${SortMode.MULTI}"
              ${this.#currentMode === SortMode.MULTI ? "checked" : ""}
            />
            <span class="mode-option-content">
              <span class="mode-option-icon">📋</span>
              <span class="mode-option-text">
                <strong>多级排序</strong>
                <small>按多个字段依次排序</small>
              </span>
            </span>
          </label>

          <label class="mode-option disabled" data-mode="${SortMode.WEIGHTED}" data-disabled="true" title="加权排序：功能开发中">
            <input
              type="radio"
              name="sort-mode"
              value="${SortMode.WEIGHTED}"
              disabled
            />
            <span class="mode-option-content">
              <span class="mode-option-icon">⚖️</span>
              <span class="mode-option-text">
                <strong>加权排序</strong>
                <small>使用公式计算权重（开发中）</small>
              </span>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * 绑定DOM元素
   * @private
   */
  #bindElements() {
    this.#radioButtons = this.#container.querySelectorAll("input[name=\"sort-mode\"]");
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    this.#radioButtons.forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.#handleModeChange(parseInt(e.target.value));
      });
    });

    // 为禁用的选项添加点击提示
    const disabledLabels = this.#container.querySelectorAll(".mode-option[data-disabled=\"true\"]");
    disabledLabels.forEach(label => {
      label.addEventListener("click", (e) => {
        e.preventDefault();
        const mode = parseInt(label.dataset.mode);
        const modeName = this.#getModeName(mode);
        try { this.#logger?.warn?.(`${modeName}功能开发中，敬请期待`, { toast: { type: "warn", ms: 3000 } }); } catch (e) { void e; }
        this.#logger.debug(`[ModeSelector] Disabled mode clicked: ${modeName}`);
      });
    });

    this.#logger.debug("[ModeSelector] Event listeners attached");
  }

  /**
   * 处理模式变更
   * @param {number} mode - 新选中的模式
   * @private
   */
  #handleModeChange(mode) {
    if (this.#currentMode === mode) {
      this.#logger.debug(`[ModeSelector] Mode ${mode} already selected`);
      return;
    }

    this.#logger.info(`[ModeSelector] Mode changed: ${this.#currentMode} -> ${mode}`);
    this.#currentMode = mode;

    // 更新UI状态
    this.#updateRadioState();

    // 触发模式变更事件
    this.#eventBus.emit(SORTER_EVENTS.MODE.CHANGED, {
      mode: this.#currentMode,
      modeName: this.#getModeName(this.#currentMode)
    });
  }

  /**
   * 更新单选按钮状态
   * @private
   */
  #updateRadioState() {
    const labels = this.#container.querySelectorAll(".mode-option");
    labels.forEach(label => {
      const mode = parseInt(label.dataset.mode);
      if (mode === this.#currentMode) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    });
  }

  /**
   * 获取模式名称
   * @param {number} mode - 模式值
   * @returns {string}
   * @private
   */
  #getModeName(mode) {
    const names = {
      [SortMode.DEFAULT]: "默认排序",
      [SortMode.MANUAL]: "手动拖拽",
      [SortMode.MULTI]: "多级排序",
      [SortMode.WEIGHTED]: "加权排序"
    };
    return names[mode] || "未知模式";
  }

  /**
   * 获取当前模式
   * @returns {number}
   * @public
   */
  getCurrentMode() {
    return this.#currentMode;
  }

  /**
   * 设置模式（编程方式）
   * @param {number} mode - 模式值
   * @public
   */
  setMode(mode) {
    if (!Object.values(SortMode).includes(mode)) {
      this.#logger.error(`[ModeSelector] Invalid mode: ${mode}`);
      return;
    }

    this.#currentMode = mode;
    this.#updateRadioState();

    // 更新radio按钮选中状态
    this.#radioButtons.forEach(radio => {
      radio.checked = parseInt(radio.value) === mode;
    });

    this.#eventBus.emit(SORTER_EVENTS.MODE.CHANGED, {
      mode: this.#currentMode,
      modeName: this.#getModeName(this.#currentMode)
    });
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = "";
    }
    this.#logger.info("[ModeSelector] Destroyed");
  }
}

