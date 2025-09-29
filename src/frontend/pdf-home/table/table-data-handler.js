/**
 * @file 表格数据处理器
 * @module TableDataHandler
 * @description 处理表格数据的设置、加载、渲染和相关业务逻辑
 */

import { getLogger } from '../../common/utils/logger.js';
import { TableUtils } from '../table-utils.js';

const logger = getLogger('TableDataHandler');

/**
 * 表格数据处理器类
 * @class TableDataHandler
 */
export class TableDataHandler {
  #tabulator;
  #tableWrapper;
  #fallbackMode;
  #localListeners;
  #fallbackData = [];

  /**
   * 构造函数
   * @param {Tabulator|null} tabulator - Tabulator实例
   * @param {HTMLElement} tableWrapper - 表格包装元素
   * @param {boolean} fallbackMode - 是否启用回退模式
   * @param {Object} localListeners - 本地监听器对象
   */
  constructor(tabulator, tableWrapper, fallbackMode, localListeners) {
    this.#tabulator = tabulator;
    this.#tableWrapper = tableWrapper;
    this.#fallbackMode = fallbackMode;
    this.#localListeners = localListeners;
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 要渲染的行对象数组
   * @returns {Promise|void} Promise对象或void
   */
  setData(data) {
    const rows = TableUtils.prepareData(data);

    if (this.#fallbackMode) {
      logger.info('Setting data in fallback mode:', rows.length, 'rows');
      this.#fallbackData = rows;
      this._callLocalListeners('data-loaded', rows);
      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for setData');
      return Promise.reject(new Error('Tabulator instance not available'));
    }

    logger.info('Setting data in Tabulator:', rows.length, 'rows');

    // 确保渲染器已准备就绪
    return this._ensureRendererReady()
      .then(() => {
        const result = this.#tabulator.setData(rows);

        return Promise.resolve(result)
          .then(() => this._handleDataLoaded(rows))
          .catch(err => this._handleSetDataError(err, rows));
      })
      .catch(err => {
        logger.warn('Failed to ensure renderer ready, using fallback:', err);
        this._handleSetDataError(err, rows);
        return Promise.resolve();
      });
  }

  /**
   * 兼容性API：loadData
   * @param {Array<Object>} data - 数据
   * @returns {Promise} Promise对象
   */
  loadData(data) {
    return Promise.resolve(this.setData(data));
  }

  /**
   * 清空表格数据
   * @returns {void}
   */
  clear() {
    if (this.#fallbackMode) {
      this.#fallbackData = [];
      logger.info('Cleared data in fallback mode');
      return;
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for clear');
      return;
    }

    try {
      this.#tabulator.clearData();
      logger.info('Cleared tabulator data');
    } catch (error) {
      logger.error('Error clearing tabulator data:', error);
    }
  }

  /**
   * 获取当前数据
   * @returns {Array<Object>} 当前数据
   */
  getData() {
    if (this.#fallbackMode) {
      return this.#fallbackData;
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for getData');
      return [];
    }

    try {
      return this.#tabulator.getData();
    } catch (error) {
      logger.error('Error getting tabulator data:', error);
      return [];
    }
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   */
  displayEmptyState(message = '暂无数据') {
    if (this.#fallbackMode) {
      this.#fallbackData = [];
      logger.info('Displayed empty state in fallback mode:', message);
      return;
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for displayEmptyState');
      return;
    }

    try {
      this.#tabulator.clearData();
      logger.info('Displayed empty state:', message);
    } catch (e) {
      logger.warn('Failed to clear data for empty state:', e);
    }
  }

  /**
   * 确保渲染器已准备就绪
   * @returns {Promise} 解析后渲染器就绪的Promise
   * @private
   */
  _ensureRendererReady() {
    return new Promise((resolve, reject) => {
      // 检查 Tabulator 实例是否存在
      if (!this.#tabulator) {
        reject(new Error('Tabulator instance not available'));
        return;
      }

      // 检查渲染器是否已经就绪
      const checkRenderer = () => {
        try {
          // 尝试访问渲染器的关键属性
          const renderer = this.#tabulator.renderer;
          if (renderer && renderer.verticalFillMode !== undefined) {
            logger.debug('Renderer is ready');
            return true;
          }
        } catch (e) {
          // 渲染器还没有准备好
          logger.debug('Renderer not ready yet:', e.message);
        }
        return false;
      };

      // 立即检查一次
      if (checkRenderer()) {
        resolve();
        return;
      }

      // 如果渲染器还没准备好，等待一小段时间再检查
      let attempts = 0;
      const maxAttempts = 10;
      const checkInterval = 50; // ms

      const intervalId = setInterval(() => {
        attempts++;

        if (checkRenderer()) {
          clearInterval(intervalId);
          resolve();
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          logger.warn(`Renderer not ready after ${maxAttempts} attempts, proceeding anyway`);
          resolve(); // 仍然继续，但有警告
        }
      }, checkInterval);
    });
  }

  /**
   * 处理数据加载完成后的逻辑
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  _handleDataLoaded(rows) {
    logger.debug('Data loaded successfully, count:', rows.length);
    this._callLocalListeners('data-loaded', rows);

    try {
      // 执行表格诊断和优化
      this._performTableOptimizations();
    } catch (e) {
      logger.warn('Error performing table optimizations:', e);
    }
  }

  /**
   * 执行表格优化操作
   * @private
   */
  _performTableOptimizations() {
    if (!this.#tabulator || !this.#tableWrapper) {
      return;
    }

    try {
      TableUtils.ensureTabulatorRedraw(this.#tabulator);
      TableUtils.logDOMDiagnostics(this.#tableWrapper, this.#tabulator);
      TableUtils.handleMissingDOMElements(this.#tableWrapper, this.#tabulator);
      TableUtils.logComputedStyles(this.#tableWrapper.parentElement, this.#tableWrapper);
      TableUtils.logTabulatorInstanceInfo(this.#tabulator);

      logger.debug('Table optimizations completed');
    } catch (error) {
      logger.warn('Error during table optimizations:', error);
    }
  }

  /**
   * 处理设置数据错误
   * @param {Error} err - 错误对象
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  _handleSetDataError(err, rows) {
    logger.warn('Tabulator setData failed, notifying listeners:', err);
    this._callLocalListeners('data-loaded', rows);

    // 在错误情况下，尝试启用回退模式
    this.#fallbackMode = true;
    this.#fallbackData = rows;
  }

  /**
   * 调用本地监听器
   * @param {string} event - 事件名称
   * @param {any} payload - 事件数据
   * @private
   */
  _callLocalListeners(event, payload) {
    const list = this.#localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          logger.warn(`Listener for ${event} threw:`, e);
        }
      });
    }
  }

  /**
   * 更新 Tabulator 实例引用
   * @param {Tabulator|null} tabulator - 新的Tabulator实例
   * @param {boolean} fallbackMode - 是否启用回退模式
   */
  updateTabulatorReference(tabulator, fallbackMode) {
    this.#tabulator = tabulator;
    this.#fallbackMode = fallbackMode;

    if (fallbackMode) {
      logger.info('Data handler switched to fallback mode');
    } else {
      logger.info('Data handler updated with new tabulator instance');
    }
  }

  /**
   * 获取数据处理状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      fallbackMode: this.#fallbackMode,
      hasTabulator: this.#tabulator !== null,
      dataCount: this.#fallbackMode ? this.#fallbackData.length : (this.getData().length || 0),
      hasTableWrapper: this.#tableWrapper !== null
    };
  }

  /**
   * 添加数据加载监听器
   * @param {Function} callback - 回调函数
   */
  onDataLoaded(callback) {
    if (!this.#localListeners['data-loaded']) {
      this.#localListeners['data-loaded'] = [];
    }
    this.#localListeners['data-loaded'].push(callback);
  }

  /**
   * 移除数据加载监听器
   * @param {Function} callback - 要移除的回调函数
   */
  offDataLoaded(callback) {
    const list = this.#localListeners['data-loaded'];
    if (Array.isArray(list)) {
      const index = list.indexOf(callback);
      if (index > -1) {
        list.splice(index, 1);
      }
    }
  }

  // Getters
  get fallbackData() { return this.#fallbackData; }
  get fallbackMode() { return this.#fallbackMode; }
}