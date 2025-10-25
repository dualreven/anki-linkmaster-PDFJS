/**
 * @file PDF列表数据服务（已废弃）
 * @module ListDataService
 * @description 此文件已被PDFList组件替代，保留仅为向后兼容
 * @deprecated 请使用 PDFList 组件替代
 */

import { getLogger } from '../../../../common/utils/logger.js';

const logger = getLogger('PDFList.DataService');

/**
 * PDF列表数据服务类（兼容性桩实现）
 * @class ListDataService
 * @deprecated 此类已被PDFList组件替代
 */
export class ListDataService {
  #state;
  #eventBus;

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Object} options.state - StateManager状态
   * @param {Object} options.eventBus - ScopedEventBus实例
   */
  constructor({ state, eventBus }) {
    this.#state = state;
    this.#eventBus = eventBus;
    logger.warn('ListDataService is deprecated. Use PDFList component instead.');
  }

  /**
   * 设置数据（兼容性方法）
   * @param {Array<Object>} data - 数据数组
   * @returns {Promise<void>}
   */
  async setData(data) {
    logger.warn('setData called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 加载数据（兼容性方法）
   * @param {Array<Object>} data - 数据数组
   * @returns {Promise<void>}
   */
  async loadData(data) {
    logger.warn('loadData called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 添加行（兼容性方法）
   * @param {Object} rowData - 行数据
   * @param {boolean} addToTop - 是否添加到顶部
   * @returns {Promise<void>}
   */
  async addRow(rowData, addToTop = true) {
    logger.warn('addRow called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 删除行（兼容性方法）
   * @param {string} rowId - 行ID
   * @returns {Promise<void>}
   */
  async deleteRow(rowId) {
    logger.warn('deleteRow called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 更新行（兼容性方法）
   * @param {string} rowId - 行ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<void>}
   */
  async updateRow(rowId, updates) {
    logger.warn('updateRow called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 清空数据（兼容性方法）
   * @returns {Promise<void>}
   */
  async clear() {
    logger.warn('clear called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 获取数据（兼容性方法）
   * @returns {Array<Object>} 空数组
   */
  getData() {
    logger.warn('getData called on deprecated ListDataService');
    return [];
  }

  /**
   * 显示空状态（兼容性方法）
   * @param {string} message - 空状态消息
   * @returns {Promise<void>}
   */
  async displayEmptyState(message = "暂无数据") {
    logger.warn('displayEmptyState called on deprecated ListDataService');
    return Promise.resolve();
  }

  /**
   * 更新Tabulator引用（兼容性方法）
   * @param {*} tabulator - Tabulator实例（已废弃）
   * @param {boolean} fallbackMode - 回退模式
   */
  updateTabulatorReference(tabulator, fallbackMode = true) {
    logger.warn('updateTabulatorReference called on deprecated ListDataService - Tabulator has been removed');
  }

  /**
   * 获取状态（兼容性方法）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      deprecated: true,
      message: 'ListDataService is deprecated. Use PDFList component instead.',
      dataService: 'disabled'
    };
  }
}

export default ListDataService;