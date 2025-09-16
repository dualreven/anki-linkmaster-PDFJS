/**
 * @file 表格封装主模块
 * @module TableWrapper
 * @description 表格封装主文件，整合所有子模块功能
 */

import Logger from '../common/utils/logger.js';
import { TableWrapperCore } from './table-wrapper-core.js';
import { TableFallbackMode } from './table-fallback-mode.js';
import { TableEventHandlers } from './table-event-handlers.js';
import { TableUtils } from './table-utils.js';

const logger = new Logger('TableWrapper');

/**
 * @class TableWrapper
 * @description 表格封装主类，整合所有子模块功能
 */
export class TableWrapper extends TableWrapperCore {
  #fallbackModeHandler;
  #eventHandlers;

  /**
   * 创建 TableWrapper 实例
   * @param {HTMLElement|string} container - 容器元素或选择器字符串
   * @param {Object} [options] - Tabulator配置选项
   */
  constructor(container, options = {}) {
    super(container, options);
    
    // 初始化回退模式处理器
    this.#fallbackModeHandler = new TableFallbackMode(
      this.tableWrapper,
      this.options,
      this.localListeners
    );
    
    // 初始化事件处理器
    this.#eventHandlers = new TableEventHandlers(
      this.tabulator,
      this.tableWrapper,
      this.localListeners,
      this.fallbackMode,
      this.#fallbackModeHandler,
      this.fallbackData
    );
    
    // 如果处于回退模式，创建回退表格
    if (this.fallbackMode) {
      this.#fallbackModeHandler.createFallbackTable();
    }
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 要渲染的行对象数组
   * @returns {Promise|void}
   */
  setData(data) {
    const rows = TableUtils.prepareData(data);
    
    if (this.fallbackMode) {
      this.#fallbackModeHandler.updateFallbackTable(data);
      this._callLocalListeners('data-loaded', rows);
      return Promise.resolve();
    }

    const result = super.setData(rows);
    
    Promise.resolve(result)
      .then(() => this.#handleDataLoaded(rows))
      .catch(err => this.#handleSetDataError(err, rows));
      
    return result;
  }

  /**
   * 处理数据加载完成后的逻辑
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  #handleDataLoaded(rows) {
    logger.debug('setData count=', rows.length);
    this._callLocalListeners('data-loaded', rows);
    
    try {
      TableUtils.ensureTabulatorRedraw(this.tabulator);
      TableUtils.logDOMDiagnostics(this.tableWrapper, this.tabulator);
      TableUtils.handleMissingDOMElements(this.tableWrapper, this.tabulator);
      TableUtils.logComputedStyles(this.container, this.tableWrapper);
      TableUtils.logTabulatorInstanceInfo(this.tabulator);
    } catch (e) {
      logger.warn('Error inspecting tableWrapper DOM', e);
    }
  }

  /**
   * 处理设置数据错误
   * @param {Error} err - 错误对象
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  #handleSetDataError(err, rows) {
    logger.warn('Tabulator setData failed', err);
    this._callLocalListeners('data-loaded', rows);
  }

  /**
   * 获取当前被选中的行数据
   * @returns {Array<Object>} 被选中的行对象数组
   */
  getSelectedRows() {
    return this.#eventHandlers.getSelectedRows();
  }

  /**
   * 清空表格数据
   * @returns {void}
   */
  clear() {
    if (this.fallbackMode) {
      this.#fallbackModeHandler.clearFallbackTable();
      return;
    }

    super.clear();
  }

  /**
   * 销毁表格实例
   * @returns {void}
   */
  destroy() {
    super.destroy();
    
    // 销毁回退表格
    this.#fallbackModeHandler.destroyFallbackTable();
  }

  /**
   * 绑定事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  on(event, handler) {
    this.#eventHandlers.on(event, handler);
  }

  /**
   * 解除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  off(event, handler) {
    this.#eventHandlers.off(event, handler);
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   */
  displayEmptyState(message) {
    if (this.fallbackMode) {
      this.#fallbackModeHandler.updateFallbackTable([]);
      return;
    }

    super.displayEmptyState(message);
  }
}

// 导出工具函数
export { TableUtils };

// 保持向后兼容性
export function runTabulatorSmokeTest() {
  TableUtils.runTabulatorSmokeTest();
}