/**
 * @file PDF列表生命周期服务（已废弃）
 * @module ListLifecycleService
 * @description 此文件已被PDFList组件替代，保留仅为向后兼容
 * @deprecated 请使用 PDFList 组件替代
 */

import { getLogger } from '../../../../common/utils/logger.js';

const logger = getLogger('PDFList.LifecycleService');

/**
 * PDF列表生命周期服务类（兼容性桩实现）
 * @class ListLifecycleService
 * @deprecated 此类已被PDFList组件替代
 */
export class ListLifecycleService {
  #isDestroyed = false;
  #isInitialized = false;

  /**
   * 构造函数
   * @param {Object} options - 配置选项（已废弃）
   */
  constructor(options = {}) {
    logger.warn('ListLifecycleService is deprecated. Use PDFList component instead.');
  }

  /**
   * 初始化（兼容性方法）
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.warn('initialize called on deprecated ListLifecycleService');
    this.#isInitialized = true;
    return Promise.resolve();
  }

  /**
   * 刷新（兼容性方法）
   * @returns {Promise<void>}
   */
  async refresh() {
    logger.warn('refresh called on deprecated ListLifecycleService');
    return Promise.resolve();
  }

  /**
   * 软重置（兼容性方法）
   * @returns {Promise<void>}
   */
  async softReset() {
    logger.warn('softReset called on deprecated ListLifecycleService');
    return Promise.resolve();
  }

  /**
   * 销毁（兼容性方法）
   * @returns {Promise<void>}
   */
  async destroy() {
    logger.warn('destroy called on deprecated ListLifecycleService');
    this.#isDestroyed = true;
    this.#isInitialized = false;
    return Promise.resolve();
  }

  /**
   * 销毁Tabulator实例（兼容性方法）
   * @returns {Promise<void>}
   * @private
   */
  async _destroyTabulatorInstance() {
    logger.warn('_destroyTabulatorInstance called on deprecated service - Tabulator has been removed');
    return Promise.resolve();
  }

  /**
   * 更新Tabulator引用（兼容性方法）
   * @param {*} tabulator - Tabulator实例（已废弃）
   */
  updateTabulatorReference(tabulator) {
    logger.warn('updateTabulatorReference called on deprecated ListLifecycleService - Tabulator has been removed');
  }

  /**
   * 获取生命周期状态（兼容性方法）
   * @returns {Object} 状态信息
   */
  getLifecycleStatus() {
    return {
      deprecated: true,
      message: 'ListLifecycleService is deprecated. Use PDFList component instead.',
      initialized: this.#isInitialized,
      destroyed: this.#isDestroyed
    };
  }
}

export default ListLifecycleService;