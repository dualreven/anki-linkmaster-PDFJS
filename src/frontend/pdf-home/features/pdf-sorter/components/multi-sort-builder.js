/**
 * @file 多级排序构建器组件
 * @module features/pdf-sorter/components/multi-sort-builder
 * @description
 * 提供多字段排序功能，用户可以添加多个排序字段，每个字段可选择升序或降序
 */

/**
 * 多级排序构建器组件
 * @class MultiSortBuilder
 */
import { SORTER_EVENTS } from "../../../../common/event/event-constants.js";

export class MultiSortBuilder {
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
   * 排序字段列表容器
   * @type {HTMLElement|null}
   * @private
   */
  #sortFieldsContainer = null;

  /**
   * 当前排序配置列表
   * @type {Array<{field: string, direction: 'asc'|'desc'}>}
   * @private
   */
  #sortConfigs = [];

  /**
   * 可排序字段配置
   * @type {Array<{field: string, label: string, type: string}>}
   * @private
   */
  #availableFields = [];

  /**
   * 最大排序字段数量
   * @type {number}
   * @private
   */
  #maxFields = 3;

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {ScopedEventBus} eventBus - 作用域事件总线
   * @param {Object} options - 配置选项
   * @param {Array} options.availableFields - 可排序字段
   * @param {number} options.maxFields - 最大字段数
   */
  constructor(logger, eventBus, options = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#availableFields = options.availableFields || [];
    this.#maxFields = options.maxFields || 3;

    // 初始化默认排序字段
    if (this.#availableFields.length > 0) {
      this.#sortConfigs = [{
        field: this.#availableFields[0].field,
        direction: "desc"
      }];
    }
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
    this.#renderSortFields();

    this.#logger.info("[MultiSortBuilder] Rendered");
  }

  /**
   * 获取HTML模板
   * @returns {string}
   * @private
   */
  #getTemplate() {
    return `
      <div class="multi-sort-builder">
        <div class="multi-sort-header">
          <h4>多级排序配置</h4>
          <small>最多支持 ${this.#maxFields} 个排序字段</small>
        </div>

        <div class="sort-fields-list"></div>

        <div class="multi-sort-actions">
          <button class="btn-add-field" title="添加排序字段">
            ➕ 添加字段
          </button>
          <button class="btn-apply-sort" title="应用排序">
            ✅ 应用排序
          </button>
          <button class="btn-clear-sort" title="清除排序">
            🗑️ 清除排序
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定DOM元素
   * @private
   */
  #bindElements() {
    this.#sortFieldsContainer = this.#container.querySelector(".sort-fields-list");
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 添加字段按钮
    const btnAdd = this.#container.querySelector(".btn-add-field");
    btnAdd.addEventListener("click", () => this.#handleAddField());

    // 应用排序按钮
    const btnApply = this.#container.querySelector(".btn-apply-sort");
    btnApply.addEventListener("click", () => this.#handleApplySort());

    // 清除排序按钮
    const btnClear = this.#container.querySelector(".btn-clear-sort");
    btnClear.addEventListener("click", () => this.#handleClearSort());

    this.#logger.debug("[MultiSortBuilder] Event listeners attached");
  }

  /**
   * 渲染排序字段列表
   * @private
   */
  #renderSortFields() {
    this.#sortFieldsContainer.innerHTML = "";

    if (this.#sortConfigs.length === 0) {
      this.#sortFieldsContainer.innerHTML = `
        <div class="no-sort-fields">
          <p>暂无排序字段，点击"添加字段"开始配置</p>
        </div>
      `;
      return;
    }

    this.#sortConfigs.forEach((config, index) => {
      const fieldRow = this.#createSortFieldRow(config, index);
      this.#sortFieldsContainer.appendChild(fieldRow);
    });

    // 更新添加按钮状态
    this.#updateAddButtonState();
  }

  /**
   * 创建排序字段行
   * @param {Object} config - 排序配置
   * @param {number} index - 索引
   * @returns {HTMLElement}
   * @private
   */
  #createSortFieldRow(config, index) {
    const row = document.createElement("div");
    row.className = "sort-field-row";
    row.dataset.index = index;

    row.innerHTML = `
      <span class="sort-field-index">${index + 1}</span>

      <select class="sort-field-select" data-index="${index}">
        ${this.#availableFields.map(f => `
          <option value="${f.field}" ${config.field === f.field ? "selected" : ""}>
            ${f.label}
          </option>
        `).join("")}
      </select>

      <select class="sort-direction-select" data-index="${index}">
        <option value="asc" ${config.direction === "asc" ? "selected" : ""}>升序 ↑</option>
        <option value="desc" ${config.direction === "desc" ? "selected" : ""}>降序 ↓</option>
      </select>

      <button class="btn-remove-field" data-index="${index}" title="删除">
        ❌
      </button>
    `;

    // 绑定字段变更事件
    const fieldSelect = row.querySelector(".sort-field-select");
    fieldSelect.addEventListener("change", (e) => {
      this.#handleFieldChange(index, e.target.value);
    });

    // 绑定方向变更事件
    const directionSelect = row.querySelector(".sort-direction-select");
    directionSelect.addEventListener("change", (e) => {
      this.#handleDirectionChange(index, e.target.value);
    });

    // 绑定删除按钮事件
    const btnRemove = row.querySelector(".btn-remove-field");
    btnRemove.addEventListener("click", () => {
      this.#handleRemoveField(index);
    });

    return row;
  }

  /**
   * 处理添加字段
   * @private
   */
  #handleAddField() {
    if (this.#sortConfigs.length >= this.#maxFields) {
      this.#logger.warn(`[MultiSortBuilder] Maximum ${this.#maxFields} fields reached`);
      return;
    }

    // 选择一个未使用的字段
    const usedFields = this.#sortConfigs.map(c => c.field);
    const availableField = this.#availableFields.find(f => !usedFields.includes(f.field));

    if (!availableField) {
      this.#logger.warn("[MultiSortBuilder] No more available fields");
      return;
    }

    this.#sortConfigs.push({
      field: availableField.field,
      direction: "asc"
    });

    this.#renderSortFields();
    this.#logger.info(`[MultiSortBuilder] Field added: ${availableField.field}`);

    // 触发配置变更事件
    this.#emitConfigChanged();
  }

  /**
   * 处理删除字段
   * @param {number} index - 字段索引
   * @private
   */
  #handleRemoveField(index) {
    const removed = this.#sortConfigs.splice(index, 1);
    this.#renderSortFields();
    this.#logger.info(`[MultiSortBuilder] Field removed: ${removed[0].field}`);

    // 触发配置变更事件
    this.#emitConfigChanged();
  }

  /**
   * 处理字段变更
   * @param {number} index - 字段索引
   * @param {string} field - 新字段名
   * @private
   */
  #handleFieldChange(index, field) {
    this.#sortConfigs[index].field = field;
    this.#logger.debug(`[MultiSortBuilder] Field changed at ${index}: ${field}`);

    // 触发配置变更事件
    this.#emitConfigChanged();
  }

  /**
   * 处理方向变更
   * @param {number} index - 字段索引
   * @param {string} direction - 新方向 (asc/desc)
   * @private
   */
  #handleDirectionChange(index, direction) {
    this.#sortConfigs[index].direction = direction;
    this.#logger.debug(`[MultiSortBuilder] Direction changed at ${index}: ${direction}`);

    // 触发配置变更事件
    this.#emitConfigChanged();
  }

  /**
   * 处理应用排序
   * @private
   */
  #handleApplySort() {
    if (this.#sortConfigs.length === 0) {
      this.#logger.warn("[MultiSortBuilder] No sort fields configured");
      return;
    }

    this.#logger.info("[MultiSortBuilder] Applying multi-sort:", this.#sortConfigs);

    // 触发应用排序事件
    this.#eventBus.emit(SORTER_EVENTS.SORT.REQUESTED, {
      type: "multi",
      configs: [...this.#sortConfigs]
    });
  }

  /**
   * 处理清除排序
   * @private
   */
  #handleClearSort() {
    this.#sortConfigs = [];
    this.#renderSortFields();
    this.#logger.info("[MultiSortBuilder] Sort cleared");

    // 触发清除排序事件
    this.#eventBus.emit(SORTER_EVENTS.SORT.CLEARED, {});
  }

  /**
   * 触发配置变更事件
   * @private
   */
  #emitConfigChanged() {
    this.#eventBus.emit(SORTER_EVENTS.CONFIG.CHANGED, {
      type: "multi",
      configs: [...this.#sortConfigs]
    });
  }

  /**
   * 更新添加按钮状态
   * @private
   */
  #updateAddButtonState() {
    const btnAdd = this.#container.querySelector(".btn-add-field");
    if (this.#sortConfigs.length >= this.#maxFields) {
      btnAdd.disabled = true;
      btnAdd.title = `最多支持 ${this.#maxFields} 个字段`;
    } else {
      btnAdd.disabled = false;
      btnAdd.title = "添加排序字段";
    }
  }

  /**
   * 获取当前排序配置
   * @returns {Array<{field: string, direction: 'asc'|'desc'}>}
   * @public
   */
  getSortConfigs() {
    return [...this.#sortConfigs];
  }

  /**
   * 设置排序配置（编程方式）
   * @param {Array<{field: string, direction: 'asc'|'desc'}>} configs - 排序配置
   * @public
   */
  setSortConfigs(configs) {
    this.#sortConfigs = configs.slice(0, this.#maxFields);
    this.#renderSortFields();
    this.#logger.info("[MultiSortBuilder] Sort configs set:", this.#sortConfigs);
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = "";
    }
    this.#logger.info("[MultiSortBuilder] Destroyed");
  }
}
