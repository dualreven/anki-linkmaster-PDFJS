/**
 * @file 表格封装核心模块
 * @module TableWrapperCore
 * @description TableWrapper的核心功能，基于模块化架构重构
 */

import { getLogger } from '../common/utils/logger.js';
import { TableCoreInitializer } from './table/table-core-initializer.js';
import { TableDataHandler } from './table/table-data-handler.js';
import { TableLifecycleManager } from './table/table-lifecycle-manager.js';

const logger = getLogger('TableWrapperCore');

/**
 * @class TableWrapperCore
 * @description 表格封装核心类，采用组合模式整合各个专门模块
 */
export class TableWrapperCore {
  #initializer;
  #dataHandler;
  #lifecycleManager;
  #localListeners = Object.create(null);

  // Expose read-only accessors for integration code
  get tabulator() { return this.#initializer?.tabulator; }
  get tableWrapper() { return this.#initializer?.tableWrapper; }
  get container() { return this.#initializer?.container; }
  get fallbackMode() { return this.#dataHandler?.fallbackMode || false; }
  get options() { return this.#initializer?.options; }
  get localListeners() { return this.#localListeners; }
  get fallbackData() { return this.#dataHandler?.fallbackData || []; }

  /**
   * 创建 TableWrapper 实例
   * @param {HTMLElement|string} container - 容器元素或选择器字符串
   * @param {Object} [options] - Tabulator配置选项
   */
  constructor(container, options = {}) {
    logger.info('Initializing TableWrapperCore with modular architecture');

    // 1. 初始化核心组件
    this.#initializer = new TableCoreInitializer(container, options);

    // 2. 初始化数据处理器
    this.#dataHandler = new TableDataHandler(
      null, // tabulator将在初始化后设置
      this.#initializer.tableWrapper,
      false, // fallbackMode初始为false
      this.#localListeners
    );

    // 3. 初始化生命周期管理器
    this.#lifecycleManager = new TableLifecycleManager(
      null, // tabulator将在初始化后设置
      this.#initializer.tableWrapper,
      this.#initializer.container,
      this.#localListeners
    );

    // 4. 执行同步初始化（不等待异步完成）
    this._initSync();
  }

  /**
   * 同步初始化部分（立即执行）
   * @private
   */
  _initSync() {
    try {
      logger.info('Starting synchronous TableWrapperCore initialization');

      // 使用同步初始化器创建Tabulator实例
      const tabulator = this.#initializer.initializeSync();

      // 更新各模块的Tabulator引用
      this.#dataHandler.updateTabulatorReference(tabulator, !tabulator);
      this.#lifecycleManager.updateTabulatorReference(tabulator);

      if (tabulator) {
        logger.info('TableWrapperCore synchronous initialization completed successfully');
      } else {
        logger.warn('TableWrapperCore synchronous initialization completed in fallback mode');
      }

    } catch (error) {
      logger.error('TableWrapperCore synchronous initialization failed:', error);

      // 确保在失败情况下也能正常工作
      this.#dataHandler.updateTabulatorReference(null, true);
      this.#lifecycleManager.updateTabulatorReference(null);
    }
  }

  /**
   * 异步初始化（可选，用于需要异步操作的情况）
   * @returns {Promise<void>}
   */
  async initializeAsync() {
    try {
      logger.info('Starting asynchronous TableWrapperCore initialization');

      // 如果需要异步初始化，可以在这里处理
      // 目前保持同步初始化以保证兼容性

      logger.info('Asynchronous TableWrapperCore initialization completed');
      return true;

    } catch (error) {
      logger.error('Asynchronous TableWrapperCore initialization failed:', error);
      return false;
    }
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 要渲染的行对象数组
   * @returns {Promise|void}
   */
  setData(data) {
    return this.#dataHandler.setData(data);
  }

  /**
   * 兼容性API：loadData
   * @param {Array<Object>} data - 数据
   * @returns {Promise} Promise对象
   */
  loadData(data) {
    return this.#dataHandler.loadData(data);
  }

  /**
   * 添加单行数据到表格
   * @param {Object} rowData - 行数据对象
   * @param {boolean} addToTop - 是否添加到顶部，默认true
   * @returns {Promise|void} Promise对象或void
   */
  addRow(rowData, addToTop = true) {
    return this.#dataHandler.addRow(rowData, addToTop);
  }

  /**
   * 清空表格数据
   * @returns {void}
   */
  clear() {
    return this.#dataHandler.clear();
  }

  /**
   * 获取当前数据
   * @returns {Array<Object>} 当前数据
   */
  getData() {
    return this.#dataHandler.getData();
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   */
  displayEmptyState(message) {
    return this.#dataHandler.displayEmptyState(message);
  }

  /**
   * 销毁 Tabulator 实例
   * @returns {Promise<void>} 销毁完成的Promise
   */
  async destroy() {
    return await this.#lifecycleManager.destroy();
  }

  /**
   * 调用本地监听器
   * @param {string} event - 事件名称
   * @param {any} payload - 事件数据
   * @protected
   */
  _callLocalListeners(event, payload) {
    const list = this.#localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try { fn(payload); } catch (e) { logger.warn(`Listener for ${event} threw`, e); }
      });
    }
  }

  /**
   * 添加数据加载监听器
   * @param {Function} callback - 回调函数
   */
  onDataLoaded(callback) {
    this.#dataHandler.onDataLoaded(callback);
  }

  /**
   * 移除数据加载监听器
   * @param {Function} callback - 要移除的回调函数
   */
  offDataLoaded(callback) {
    this.#dataHandler.offDataLoaded(callback);
  }

  /**
   * 获取表格状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      initialization: this.#initializer.getInitializationStatus(),
      dataHandler: this.#dataHandler.getStatus(),
      lifecycle: this.#lifecycleManager.getLifecycleStatus()
    };
  }

  /**
   * 重新初始化表格
   * @param {Object} newOptions - 新的配置选项
   * @returns {Promise<void>}
   */
  async reinitialize(newOptions = {}) {
    try {
      logger.info('Reinitializing TableWrapperCore');

      // 1. 销毁现有实例
      await this.#lifecycleManager.destroy();

      // 2. 重新初始化
      const tabulator = await this.#initializer.reinitialize(newOptions);

      // 3. 更新模块引用
      this.#dataHandler.updateTabulatorReference(tabulator, !tabulator);
      this.#lifecycleManager.updateTabulatorReference(tabulator);

      logger.info('TableWrapperCore reinitialization completed');

    } catch (error) {
      logger.error('TableWrapperCore reinitialization failed:', error);
      throw error;
    }
  }

  /**
   * 软重置 - 清理内容但不销毁结构
   * @returns {Promise<void>}
   */
  async softReset() {
    return await this.#lifecycleManager.softReset();
  }
}