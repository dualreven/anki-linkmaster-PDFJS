/**
 * @file Tabulator适配器
 * @module features/pdf-sorter/services/tabulator-adapter
 * @description
 * 负责与Tabulator表格组件的集成，控制不同排序模式下的表格行为
 */

/**
 * Tabulator适配器
 * @class TabulatorAdapter
 */
export class TabulatorAdapter {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * Tabulator表格实例
   * @type {Object|null}
   * @private
   */
  #table = null;

  /**
   * 当前排序模式
   * @type {number}
   * @private
   */
  #currentMode = 2; // 默认多级排序

  /**
   * 原始表格配置备份
   * @type {Object}
   * @private
   */
  #originalTableConfig = {
    headerSort: true,
    movableRows: false
  };

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   */
  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * 设置表格实例
   * @param {Object} table - Tabulator表格实例
   * @public
   */
  setTable(table) {
    if (!table) {
      this.#logger.error('[TabulatorAdapter] Invalid table instance');
      return;
    }

    this.#table = table;

    // 备份原始配置
    this.#originalTableConfig = {
      headerSort: table.options.headerSort !== false,
      movableRows: table.options.movableRows === true
    };

    this.#logger.info('[TabulatorAdapter] Table instance set', this.#originalTableConfig);
  }

  /**
   * 切换排序模式
   * @param {number} mode - 排序模式 (0=默认, 1=手动拖拽, 2=多级, 3=加权)
   * @public
   */
  switchMode(mode) {
    if (!this.#table) {
      this.#logger.warn('[TabulatorAdapter] No table instance available');
      return;
    }

    this.#logger.info(`[TabulatorAdapter] Switching to mode ${mode}`);
    this.#currentMode = mode;

    switch (mode) {
      case 0: // 默认排序
        this.#enableDefaultSort();
        break;
      case 1: // 手动拖拽
        this.#enableManualDrag();
        break;
      case 2: // 多级排序
        this.#enableMultiSort();
        break;
      case 3: // 加权排序
        this.#enableWeightedSort();
        break;
      default:
        this.#logger.warn(`[TabulatorAdapter] Unknown mode: ${mode}`);
    }
  }

  /**
   * 启用默认排序模式
   * @private
   */
  #enableDefaultSort() {
    this.#logger.info('[TabulatorAdapter] Enabling default sort mode');

    // 启用列头排序
    this.#table.options.headerSort = true;

    // 禁用行拖拽
    this.#table.options.movableRows = false;

    // 清除所有排序
    this.#table.clearSort();

    this.#logger.debug('[TabulatorAdapter] Default sort mode enabled');
  }

  /**
   * 启用手动拖拽模式
   * @private
   */
  #enableManualDrag() {
    this.#logger.info('[TabulatorAdapter] Enabling manual drag mode');

    // 禁用列头排序
    this.#table.options.headerSort = false;

    // 启用行拖拽
    this.#table.options.movableRows = true;

    // 清除所有排序
    this.#table.clearSort();

    // 重新绘制表格以应用拖拽功能
    this.#table.redraw(true);

    this.#logger.debug('[TabulatorAdapter] Manual drag mode enabled');
  }

  /**
   * 启用多级排序模式
   * @private
   */
  #enableMultiSort() {
    this.#logger.info('[TabulatorAdapter] Enabling multi-sort mode');

    // 禁用列头排序（由sorter面板控制）
    this.#table.options.headerSort = false;

    // 禁用行拖拽
    this.#table.options.movableRows = false;

    // 清除所有排序
    this.#table.clearSort();

    this.#logger.debug('[TabulatorAdapter] Multi-sort mode enabled');
  }

  /**
   * 启用加权排序模式
   * @private
   */
  #enableWeightedSort() {
    this.#logger.info('[TabulatorAdapter] Enabling weighted sort mode');

    // 禁用列头排序
    this.#table.options.headerSort = false;

    // 禁用行拖拽
    this.#table.options.movableRows = false;

    // 清除所有排序
    this.#table.clearSort();

    this.#logger.debug('[TabulatorAdapter] Weighted sort mode enabled');
  }

  /**
   * 应用多级排序到表格
   * @param {Array<{field: string, dir: 'asc'|'desc'}>} sorters - 排序配置
   * @public
   */
  applyMultiSort(sorters) {
    if (!this.#table) {
      this.#logger.warn('[TabulatorAdapter] No table instance available');
      return;
    }

    if (!sorters || sorters.length === 0) {
      this.#logger.warn('[TabulatorAdapter] No sorters provided');
      return;
    }

    // 转换为Tabulator格式
    const tabulatorSorters = sorters.map(s => ({
      column: s.field,
      dir: s.direction
    }));

    this.#logger.info('[TabulatorAdapter] Applying multi-sort', tabulatorSorters);

    try {
      this.#table.setSort(tabulatorSorters);
      this.#logger.debug('[TabulatorAdapter] Multi-sort applied successfully');
    } catch (error) {
      this.#logger.error('[TabulatorAdapter] Failed to apply multi-sort', error);
      throw error;
    }
  }

  /**
   * 应用加权排序到表格
   * @param {Array} sortedData - 已排序的数据
   * @public
   */
  applyWeightedSort(sortedData) {
    if (!this.#table) {
      this.#logger.warn('[TabulatorAdapter] No table instance available');
      return;
    }

    this.#logger.info('[TabulatorAdapter] Applying weighted sort', { count: sortedData.length });

    try {
      // 直接替换表格数据
      this.#table.setData(sortedData);
      this.#logger.debug('[TabulatorAdapter] Weighted sort applied successfully');
    } catch (error) {
      this.#logger.error('[TabulatorAdapter] Failed to apply weighted sort', error);
      throw error;
    }
  }

  /**
   * 清除排序
   * @public
   */
  clearSort() {
    if (!this.#table) {
      this.#logger.warn('[TabulatorAdapter] No table instance available');
      return;
    }

    this.#logger.info('[TabulatorAdapter] Clearing sort');

    try {
      this.#table.clearSort();
      this.#logger.debug('[TabulatorAdapter] Sort cleared successfully');
    } catch (error) {
      this.#logger.error('[TabulatorAdapter] Failed to clear sort', error);
    }
  }

  /**
   * 恢复原始表格配置
   * @public
   */
  restore() {
    if (!this.#table) {
      this.#logger.warn('[TabulatorAdapter] No table instance available');
      return;
    }

    this.#logger.info('[TabulatorAdapter] Restoring original table config');

    this.#table.options.headerSort = this.#originalTableConfig.headerSort;
    this.#table.options.movableRows = this.#originalTableConfig.movableRows;
    this.#table.clearSort();
    this.#table.redraw(true);

    this.#logger.debug('[TabulatorAdapter] Original config restored');
  }

  /**
   * 获取表格当前数据
   * @returns {Array}
   * @public
   */
  getTableData() {
    if (!this.#table) {
      return [];
    }
    return this.#table.getData();
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
   * 检查表格是否就绪
   * @returns {boolean}
   * @public
   */
  isTableReady() {
    return this.#table !== null;
  }
}
