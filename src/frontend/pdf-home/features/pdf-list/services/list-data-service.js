/**
 * @file PDF列表数据服务
 * @module ListDataService
 * @description 处理PDF列表数据的CRUD操作，与StateManager和EventBus集成
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { TableUtils } from './table-utils.js';
import { PDF_LIST_EVENTS, EventDataFactory } from '../events.js';
import { ListStateHelpers } from '../state/list-state.js';

const logger = getLogger('PDFList.DataService');

/**
 * PDF列表数据服务类
 * @class ListDataService
 */
export class ListDataService {
  #tabulator;
  #tableWrapper;
  #fallbackMode;
  #state;
  #eventBus;

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Tabulator|null} options.tabulator - Tabulator实例
   * @param {HTMLElement} options.tableWrapper - 表格包装元素
   * @param {boolean} options.fallbackMode - 是否启用回退模式
   * @param {Object} options.state - StateManager状态
   * @param {Object} options.eventBus - ScopedEventBus实例
   */
  constructor({ tabulator = null, tableWrapper, fallbackMode = false, state, eventBus }) {
    this.#tabulator = tabulator;
    this.#tableWrapper = tableWrapper;
    this.#fallbackMode = fallbackMode;
    this.#state = state;
    this.#eventBus = eventBus;
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 要渲染的行对象数组
   * @returns {Promise<void>} Promise对象
   */
  async setData(data) {
    const rows = TableUtils.prepareData(data);

    // 设置加载状态
    if (this.#state) {
      ListStateHelpers.setLoading(this.#state, true);
    }

    // 发出数据加载开始事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_STARTED);

    if (this.#fallbackMode) {
      logger.info('Setting data in fallback mode:', rows.length, 'rows');

      // 更新状态
      if (this.#state) {
        this.#state.set({ items: rows, isLoading: false });
      }

      // 发出数据加载完成事件
      this.#eventBus?.emit(
        PDF_LIST_EVENTS.DATA_LOAD_COMPLETED,
        EventDataFactory.createDataLoadedData(rows, rows.length)
      );

      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for setData');

      if (this.#state) {
        ListStateHelpers.setLoading(this.#state, false);
        ListStateHelpers.setError(this.#state, new Error('Tabulator instance not available'));
      }

      this.#eventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_FAILED, {
        error: 'Tabulator instance not available',
        timestamp: Date.now()
      });

      return Promise.reject(new Error('Tabulator instance not available'));
    }

    logger.info('Setting data in Tabulator:', rows.length, 'rows');

    try {
      // 确保渲染器已准备就绪
      await this._ensureRendererReady();

      // 设置数据
      await this.#tabulator.setData(rows);

      // 处理数据加载完成
      await this._handleDataLoaded(rows);

    } catch (error) {
      logger.warn('Failed to set data, handling error:', error);
      this._handleSetDataError(error, rows);
    }

    return Promise.resolve();
  }

  /**
   * 兼容性API：loadData
   * @param {Array<Object>} data - 数据
   * @returns {Promise<void>} Promise对象
   */
  async loadData(data) {
    return await this.setData(data);
  }

  /**
   * 添加单行数据到表格
   * @param {Object} rowData - 行数据对象
   * @param {boolean} addToTop - 是否添加到顶部，默认true
   * @returns {Promise<void>} Promise对象
   */
  async addRow(rowData, addToTop = true) {
    const row = TableUtils.prepareData([rowData])[0];

    // 发出添加请求事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_ADD_REQUESTED, row);

    if (this.#fallbackMode) {
      logger.info('Adding row in fallback mode');

      if (this.#state) {
        ListStateHelpers.addItem(this.#state, row);
      }

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_ADD_COMPLETED, row);

      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for addRow');

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_ADD_FAILED, {
        error: 'Tabulator instance not available',
        rowData: row,
        timestamp: Date.now()
      });

      return Promise.reject(new Error('Tabulator instance not available'));
    }

    logger.info('Adding row to Tabulator:', row.id || row.filename);

    try {
      this.#tabulator.addRow(row, addToTop);

      // 更新状态
      if (this.#state) {
        ListStateHelpers.addItem(this.#state, row);
      }

      // 发出添加完成事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_ADD_COMPLETED, row);

      logger.debug('Row added successfully');
      return Promise.resolve();

    } catch (error) {
      logger.error('Error adding row to tabulator:', error);

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_ADD_FAILED, {
        error: error.message,
        rowData: row,
        timestamp: Date.now()
      });

      return Promise.reject(error);
    }
  }

  /**
   * 删除指定行
   * @param {string} rowId - 行ID或文件名
   * @returns {Promise<void>} Promise对象
   */
  async deleteRow(rowId) {
    // 发出删除请求事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_REQUESTED, { rowId });

    if (this.#fallbackMode) {
      logger.info('Deleting row in fallback mode:', rowId);

      if (this.#state) {
        ListStateHelpers.removeItem(this.#state, rowId);
      }

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_COMPLETED, { rowId });

      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for deleteRow');

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_FAILED, {
        error: 'Tabulator instance not available',
        rowId,
        timestamp: Date.now()
      });

      return Promise.reject(new Error('Tabulator instance not available'));
    }

    logger.info('Deleting row from Tabulator:', rowId);

    try {
      // Tabulator 的删除方法
      const row = this.#tabulator.getRow(rowId);

      if (row) {
        row.delete();

        // 更新状态
        if (this.#state) {
          ListStateHelpers.removeItem(this.#state, rowId);
        }

        // 发出删除完成事件
        this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_COMPLETED, { rowId });

        logger.debug('Row deleted successfully');
        return Promise.resolve();
      } else {
        logger.warn('Row not found for deletion:', rowId);

        this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_FAILED, {
          error: 'Row not found',
          rowId,
          timestamp: Date.now()
        });

        return Promise.reject(new Error('Row not found'));
      }
    } catch (error) {
      logger.error('Error deleting row from tabulator:', error);

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_REMOVE_FAILED, {
        error: error.message,
        rowId,
        timestamp: Date.now()
      });

      return Promise.reject(error);
    }
  }

  /**
   * 更新指定行数据
   * @param {string} rowId - 行ID或文件名
   * @param {Object} updates - 更新数据
   * @returns {Promise<void>} Promise对象
   */
  async updateRow(rowId, updates) {
    // 发出更新请求事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_REQUESTED, { rowId, updates });

    if (this.#fallbackMode) {
      logger.info('Updating row in fallback mode:', rowId);

      if (this.#state) {
        ListStateHelpers.updateItem(this.#state, rowId, updates);
      }

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_COMPLETED, { rowId, updates });

      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for updateRow');

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_FAILED, {
        error: 'Tabulator instance not available',
        rowId,
        updates,
        timestamp: Date.now()
      });

      return Promise.reject(new Error('Tabulator instance not available'));
    }

    logger.info('Updating row in Tabulator:', rowId);

    try {
      const row = this.#tabulator.getRow(rowId);

      if (row) {
        row.update(updates);

        // 更新状态
        if (this.#state) {
          ListStateHelpers.updateItem(this.#state, rowId, updates);
        }

        // 发出更新完成事件
        this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_COMPLETED, { rowId, updates });

        logger.debug('Row updated successfully');
        return Promise.resolve();
      } else {
        logger.warn('Row not found for update:', rowId);

        this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_FAILED, {
          error: 'Row not found',
          rowId,
          updates,
          timestamp: Date.now()
        });

        return Promise.reject(new Error('Row not found'));
      }
    } catch (error) {
      logger.error('Error updating row in tabulator:', error);

      this.#eventBus?.emit(PDF_LIST_EVENTS.PDF_UPDATE_FAILED, {
        error: error.message,
        rowId,
        updates,
        timestamp: Date.now()
      });

      return Promise.reject(error);
    }
  }

  /**
   * 清空表格数据
   * @returns {Promise<void>}
   */
  async clear() {
    if (this.#fallbackMode) {
      if (this.#state) {
        this.#state.set({ items: [] });
      }

      this.#eventBus?.emit(PDF_LIST_EVENTS.DATA_CLEARED);

      logger.info('Cleared data in fallback mode');
      return Promise.resolve();
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for clear');
      return Promise.reject(new Error('Tabulator instance not available'));
    }

    try {
      this.#tabulator.clearData();

      // 更新状态
      if (this.#state) {
        this.#state.set({ items: [] });
      }

      // 发出数据清空事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.DATA_CLEARED);

      logger.info('Cleared tabulator data');
      return Promise.resolve();

    } catch (error) {
      logger.error('Error clearing tabulator data:', error);
      return Promise.reject(error);
    }
  }

  /**
   * 获取当前数据
   * @returns {Array<Object>} 当前数据
   */
  getData() {
    if (this.#fallbackMode || !this.#state) {
      // 从状态获取
      return this.#state ? this.#state.get().items : [];
    }

    if (!this.#tabulator) {
      logger.warn('No tabulator instance available for getData');
      return this.#state ? this.#state.get().items : [];
    }

    try {
      return this.#tabulator.getData();
    } catch (error) {
      logger.error('Error getting tabulator data:', error);
      return this.#state ? this.#state.get().items : [];
    }
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   * @returns {Promise<void>}
   */
  async displayEmptyState(message = '暂无数据') {
    return await this.clear();
  }

  /**
   * 确保渲染器已准备就绪
   * @returns {Promise<void>} 解析后渲染器就绪的Promise
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
  async _handleDataLoaded(rows) {
    logger.debug('Data loaded successfully, count:', rows.length);

    // 更新状态
    if (this.#state) {
      this.#state.set({ items: rows, isLoading: false, error: null });
    }

    // 发出数据加载完成事件
    this.#eventBus?.emit(
      PDF_LIST_EVENTS.DATA_LOAD_COMPLETED,
      EventDataFactory.createDataLoadedData(rows, rows.length)
    );

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
    logger.warn('Tabulator setData failed:', err);

    // 更新状态
    if (this.#state) {
      this.#state.set({
        items: rows,  // 仍然保存数据到状态
        isLoading: false,
        error: err.message
      });
    }

    // 发出数据加载失败事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_FAILED, {
      error: err.message,
      timestamp: Date.now()
    });

    // 在错误情况下，尝试启用回退模式
    this.#fallbackMode = true;
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
      logger.info('Data service switched to fallback mode');
    } else {
      logger.info('Data service updated with new tabulator instance');
    }
  }

  /**
   * 获取数据服务状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      fallbackMode: this.#fallbackMode,
      hasTabulator: this.#tabulator !== null,
      dataCount: this.getData().length,
      hasTableWrapper: this.#tableWrapper !== null,
      hasState: this.#state !== null,
      hasEventBus: this.#eventBus !== null
    };
  }

  // Getters
  get fallbackMode() { return this.#fallbackMode; }
}
