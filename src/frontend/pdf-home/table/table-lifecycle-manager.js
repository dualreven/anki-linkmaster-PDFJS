/**
 * @file 表格生命周期管理器
 * @module TableLifecycleManager
 * @description 管理表格的生命周期，包括销毁、清理和状态管理
 */

import { getLogger } from '../../common/utils/logger.js';

const logger = getLogger('TableLifecycleManager');

/**
 * 表格生命周期管理器类
 * @class TableLifecycleManager
 */
export class TableLifecycleManager {
  #tabulator;
  #tableWrapper;
  #container;
  #localListeners;
  #isDestroyed = false;
  #cleanupCallbacks = [];

  /**
   * 构造函数
   * @param {Tabulator|null} tabulator - Tabulator实例
   * @param {HTMLElement} tableWrapper - 表格包装元素
   * @param {HTMLElement} container - 容器元素
   * @param {Object} localListeners - 本地监听器对象
   */
  constructor(tabulator, tableWrapper, container, localListeners) {
    this.#tabulator = tabulator;
    this.#tableWrapper = tableWrapper;
    this.#container = container;
    this.#localListeners = localListeners;
  }

  /**
   * 销毁表格实例
   * @returns {Promise<void>} 销毁完成的Promise
   */
  async destroy() {
    if (this.#isDestroyed) {
      logger.warn('Table already destroyed, skipping');
      return;
    }

    logger.info('Starting table destruction process');

    try {
      // 1. 执行自定义清理回调
      await this._executeCleanupCallbacks();

      // 2. 销毁 Tabulator 实例
      await this._destroyTabulatorInstance();

      // 3. 清理DOM元素
      this._cleanupDOMElements();

      // 4. 清理监听器
      this._cleanupListeners();

      // 5. 重置状态
      this._resetState();

      this.#isDestroyed = true;
      logger.info('Table destruction completed successfully');

    } catch (error) {
      logger.error('Error during table destruction:', error);
      // 即使有错误，也标记为已销毁，避免重复尝试
      this.#isDestroyed = true;
      throw error;
    }
  }

  /**
   * 执行清理回调函数
   * @returns {Promise<void>}
   * @private
   */
  async _executeCleanupCallbacks() {
    if (this.#cleanupCallbacks.length === 0) {
      return;
    }

    logger.debug('Executing cleanup callbacks:', this.#cleanupCallbacks.length);

    const promises = this.#cleanupCallbacks.map(async (callback, index) => {
      try {
        await callback();
        logger.debug(`Cleanup callback ${index} completed`);
      } catch (error) {
        logger.warn(`Cleanup callback ${index} failed:`, error);
      }
    });

    await Promise.allSettled(promises);
    this.#cleanupCallbacks = [];
  }

  /**
   * 销毁 Tabulator 实例
   * @returns {Promise<void>}
   * @private
   */
  async _destroyTabulatorInstance() {
    if (!this.#tabulator) {
      logger.debug('No Tabulator instance to destroy');
      return;
    }

    try {
      logger.debug('Destroying Tabulator instance');

      // 尝试优雅地销毁
      if (typeof this.#tabulator.destroy === 'function') {
        await this.#tabulator.destroy();
      }

      this.#tabulator = null;
      logger.debug('Tabulator instance destroyed');

    } catch (error) {
      logger.warn('Error destroying Tabulator instance:', error);
      // 强制清空引用
      this.#tabulator = null;
    }
  }

  /**
   * 清理DOM元素
   * @private
   */
  _cleanupDOMElements() {
    try {
      if (this.#tableWrapper) {
        logger.debug('Cleaning up table wrapper DOM elements');

        // 移除所有子元素，但保留wrapper本身以避免detaching container
        while (this.#tableWrapper.firstChild) {
          this.#tableWrapper.removeChild(this.#tableWrapper.firstChild);
        }

        // 清理可能残留的事件监听器
        this._removeEventListenersFromElement(this.#tableWrapper);
      }

      // 清理container上可能的事件监听器
      if (this.#container) {
        this._removeEventListenersFromElement(this.#container);
      }

    } catch (error) {
      logger.warn('Error cleaning up DOM elements:', error);
    }
  }

  /**
   * 从元素上移除事件监听器
   * @param {HTMLElement} element - 要清理的元素
   * @private
   */
  _removeEventListenersFromElement(element) {
    try {
      // 克隆元素来移除所有事件监听器
      const cleanElement = element.cloneNode(true);
      if (element.parentNode) {
        element.parentNode.replaceChild(cleanElement, element);

        // 更新引用
        if (element === this.#tableWrapper) {
          this.#tableWrapper = cleanElement;
        } else if (element === this.#container) {
          this.#container = cleanElement;
        }
      }
    } catch (error) {
      logger.warn('Error removing event listeners from element:', error);
    }
  }

  /**
   * 清理监听器
   * @private
   */
  _cleanupListeners() {
    try {
      if (this.#localListeners && typeof this.#localListeners === 'object') {
        logger.debug('Cleaning up local listeners');

        // 清空所有监听器数组
        Object.keys(this.#localListeners).forEach(eventName => {
          if (Array.isArray(this.#localListeners[eventName])) {
            this.#localListeners[eventName].length = 0;
          }
        });

        logger.debug('Local listeners cleaned up');
      }
    } catch (error) {
      logger.warn('Error cleaning up listeners:', error);
    }
  }

  /**
   * 重置内部状态
   * @private
   */
  _resetState() {
    this.#tabulator = null;
    // 注意：不重置 tableWrapper 和 container，因为它们可能需要保留
    logger.debug('Internal state reset');
  }

  /**
   * 添加清理回调函数
   * @param {Function} callback - 清理回调函数
   */
  addCleanupCallback(callback) {
    if (typeof callback === 'function') {
      this.#cleanupCallbacks.push(callback);
      logger.debug('Cleanup callback added, total:', this.#cleanupCallbacks.length);
    } else {
      logger.warn('Invalid cleanup callback provided, must be a function');
    }
  }

  /**
   * 移除清理回调函数
   * @param {Function} callback - 要移除的清理回调函数
   */
  removeCleanupCallback(callback) {
    const index = this.#cleanupCallbacks.indexOf(callback);
    if (index > -1) {
      this.#cleanupCallbacks.splice(index, 1);
      logger.debug('Cleanup callback removed, remaining:', this.#cleanupCallbacks.length);
    }
  }

  /**
   * 检查是否已销毁
   * @returns {boolean} 是否已销毁
   */
  isDestroyed() {
    return this.#isDestroyed;
  }

  /**
   * 获取生命周期状态
   * @returns {Object} 状态信息
   */
  getLifecycleStatus() {
    return {
      isDestroyed: this.#isDestroyed,
      hasTabulator: this.#tabulator !== null,
      hasTableWrapper: this.#tableWrapper !== null,
      hasContainer: this.#container !== null,
      cleanupCallbackCount: this.#cleanupCallbacks.length,
      listenerEventCount: this.#localListeners ? Object.keys(this.#localListeners).length : 0
    };
  }

  /**
   * 更新Tabulator实例引用
   * @param {Tabulator|null} tabulator - 新的Tabulator实例
   */
  updateTabulatorReference(tabulator) {
    if (this.#isDestroyed) {
      logger.warn('Cannot update tabulator reference on destroyed lifecycle manager');
      return;
    }

    this.#tabulator = tabulator;
    logger.debug('Tabulator reference updated');
  }

  /**
   * 软重置 - 清理内容但不销毁结构
   * @returns {Promise<void>}
   */
  async softReset() {
    if (this.#isDestroyed) {
      logger.warn('Cannot perform soft reset on destroyed lifecycle manager');
      return;
    }

    try {
      logger.info('Performing soft reset');

      // 清理Tabulator数据但不销毁实例
      if (this.#tabulator && typeof this.#tabulator.clearData === 'function') {
        this.#tabulator.clearData();
      }

      // 清理DOM内容但保留结构
      if (this.#tableWrapper) {
        // 只清理内容，保留wrapper本身
        const children = Array.from(this.#tableWrapper.children);
        children.forEach(child => {
          if (child.classList.contains('tabulator')) {
            // 保留Tabulator生成的元素
            return;
          }
          this.#tableWrapper.removeChild(child);
        });
      }

      logger.info('Soft reset completed');

    } catch (error) {
      logger.error('Error during soft reset:', error);
      throw error;
    }
  }

  /**
   * 强制清理 - 用于紧急情况
   */
  forceCleanup() {
    logger.warn('Performing force cleanup - this may cause memory leaks');

    try {
      // 强制重置所有引用
      this.#tabulator = null;
      this.#localListeners = {};
      this.#cleanupCallbacks = [];
      this.#isDestroyed = true;

      // 强制清理DOM
      if (this.#tableWrapper && this.#tableWrapper.parentNode) {
        this.#tableWrapper.parentNode.removeChild(this.#tableWrapper);
      }

      logger.warn('Force cleanup completed');

    } catch (error) {
      logger.error('Error during force cleanup:', error);
    }
  }
}