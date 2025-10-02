/**
 * @file PDF列表生命周期服务
 * @module ListLifecycleService
 * @description 管理PDF列表的生命周期，包括初始化、销毁、清理和状态管理
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_LIST_EVENTS } from '../events.js';

const logger = getLogger('PDFList.LifecycleService');

/**
 * PDF列表生命周期服务类
 * @class ListLifecycleService
 */
export class ListLifecycleService {
  #tabulator;
  #tableWrapper;
  #container;
  #state;
  #eventBus;
  #isDestroyed = false;
  #isInitialized = false;
  #cleanupCallbacks = [];

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Tabulator|null} options.tabulator - Tabulator实例
   * @param {HTMLElement} options.tableWrapper - 表格包装元素
   * @param {HTMLElement} options.container - 容器元素
   * @param {Object} options.state - StateManager状态
   * @param {Object} options.eventBus - ScopedEventBus实例
   */
  constructor({ tabulator = null, tableWrapper, container, state, eventBus }) {
    this.#tabulator = tabulator;
    this.#tableWrapper = tableWrapper;
    this.#container = container;
    this.#state = state;
    this.#eventBus = eventBus;
  }

  /**
   * 初始化列表
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#isInitialized) {
      logger.warn('List already initialized, skipping');
      return;
    }

    if (this.#isDestroyed) {
      logger.error('Cannot initialize destroyed list');
      throw new Error('Cannot initialize destroyed list');
    }

    try {
      logger.info('Initializing PDF list');

      // 发出初始化事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_INITIALIZED);

      this.#isInitialized = true;

      // 发出就绪事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_READY);

      logger.info('PDF list initialized successfully');

    } catch (error) {
      logger.error('Error initializing PDF list:', error);

      // 发出错误事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.ERROR_OCCURRED, {
        message: error.message,
        context: 'initialize',
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * 刷新列表
   * @returns {Promise<void>}
   */
  async refresh() {
    if (this.#isDestroyed) {
      logger.warn('Cannot refresh destroyed list');
      return;
    }

    if (!this.#isInitialized) {
      logger.warn('Cannot refresh uninitialized list, initializing first');
      await this.initialize();
    }

    try {
      logger.info('Refreshing PDF list');

      // 发出刷新请求事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_REFRESH_REQUESTED);

      // 实际的刷新逻辑将由 DataService 处理
      // 这里只是协调生命周期

      // 发出刷新完成事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_REFRESHED);

      logger.info('PDF list refreshed successfully');

    } catch (error) {
      logger.error('Error refreshing PDF list:', error);

      this.#eventBus?.emit(PDF_LIST_EVENTS.ERROR_OCCURRED, {
        message: error.message,
        context: 'refresh',
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * 销毁列表实例
   * @returns {Promise<void>} 销毁完成的Promise
   */
  async destroy() {
    if (this.#isDestroyed) {
      logger.warn('List already destroyed, skipping');
      return;
    }

    logger.info('Starting list destruction process');

    try {
      // 1. 执行自定义清理回调
      await this._executeCleanupCallbacks();

      // 2. 销毁 Tabulator 实例
      await this._destroyTabulatorInstance();

      // 3. 清理DOM元素
      this._cleanupDOMElements();

      // 4. 清理状态
      this._cleanupState();

      // 5. 重置内部状态
      this._resetState();

      this.#isDestroyed = true;
      this.#isInitialized = false;

      // 发出销毁事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_DESTROYED);

      logger.info('List destruction completed successfully');

    } catch (error) {
      logger.error('Error during list destruction:', error);
      // 即使有错误，也标记为已销毁，避免重复尝试
      this.#isDestroyed = true;
      this.#isInitialized = false;

      this.#eventBus?.emit(PDF_LIST_EVENTS.ERROR_OCCURRED, {
        message: error.message,
        context: 'destroy',
        timestamp: Date.now()
      });

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
   * 清理状态
   * @private
   */
  _cleanupState() {
    try {
      if (this.#state) {
        logger.debug('Cleaning up state');

        // 重置状态为初始值
        this.#state.set({
          items: [],
          selectedIndices: [],
          isLoading: false,
          error: null,
          sortColumn: null,
          sortDirection: 'asc',
          filters: {
            searchText: '',
            tags: [],
            dateRange: null
          }
        });

        logger.debug('State cleaned up');
      }
    } catch (error) {
      logger.warn('Error cleaning up state:', error);
    }
  }

  /**
   * 重置内部状态
   * @private
   */
  _resetState() {
    this.#tabulator = null;
    // 注意：不重置 tableWrapper、container、state 和 eventBus，因为它们可能需要保留
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
   * 检查是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * 获取生命周期状态
   * @returns {Object} 状态信息
   */
  getLifecycleStatus() {
    return {
      isInitialized: this.#isInitialized,
      isDestroyed: this.#isDestroyed,
      hasTabulator: this.#tabulator !== null,
      hasTableWrapper: this.#tableWrapper !== null,
      hasContainer: this.#container !== null,
      hasState: this.#state !== null,
      hasEventBus: this.#eventBus !== null,
      cleanupCallbackCount: this.#cleanupCallbacks.length
    };
  }

  /**
   * 更新Tabulator实例引用
   * @param {Tabulator|null} tabulator - 新的Tabulator实例
   */
  updateTabulatorReference(tabulator) {
    if (this.#isDestroyed) {
      logger.warn('Cannot update tabulator reference on destroyed lifecycle service');
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
      logger.warn('Cannot perform soft reset on destroyed lifecycle service');
      return;
    }

    try {
      logger.info('Performing soft reset');

      // 清理Tabulator数据但不销毁实例
      if (this.#tabulator && typeof this.#tabulator.clearData === 'function') {
        this.#tabulator.clearData();
      }

      // 清理状态数据
      if (this.#state) {
        this.#state.set({
          items: [],
          selectedIndices: []
        });
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

      this.#eventBus?.emit(PDF_LIST_EVENTS.ERROR_OCCURRED, {
        message: error.message,
        context: 'softReset',
        timestamp: Date.now()
      });

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
      this.#cleanupCallbacks = [];
      this.#isDestroyed = true;
      this.#isInitialized = false;

      // 强制清理DOM
      if (this.#tableWrapper && this.#tableWrapper.parentNode) {
        this.#tableWrapper.parentNode.removeChild(this.#tableWrapper);
      }

      // 强制清理状态
      if (this.#state) {
        this.#state.set({ items: [], selectedIndices: [] });
      }

      // 发出销毁事件
      this.#eventBus?.emit(PDF_LIST_EVENTS.TABLE_DESTROYED);

      logger.warn('Force cleanup completed');

    } catch (error) {
      logger.error('Error during force cleanup:', error);
    }
  }
}
