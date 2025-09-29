/**
 * @file UI状态管理器
 * @module UIStateManager
 * @description 管理PDF查看器的UI状态和状态同步
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * UI状态管理器类
 * 负责维护和同步UI的各种状态
 */
export class UIStateManager {
  #logger;
  #state;
  #stateChangeCallbacks = new Map();

  constructor() {
    this.#logger = getLogger("UIManager.State");
    this.#initializeState();
  }

  /**
   * 初始化默认状态
   * @private
   */
  #initializeState() {
    this.#state = {
      // 视图状态
      currentScale: 1.0,
      scaleMode: 'auto', // auto, page-width, page-height, custom
      rotation: 0, // 0, 90, 180, 270

      // 页面状态
      currentPage: 1,
      totalPages: 0,

      // 渲染状态
      isRendering: false,
      renderQueue: [],
      renderingPage: null,

      // 文档状态
      isLoading: false,
      isLoaded: false,
      hasError: false,
      errorMessage: '',

      // UI显示状态
      showToolbar: true,
      showSidebar: false,
      showThumbnails: false,
      showOutline: false,
      isFullscreen: false,

      // 交互状态
      isSelecting: false,
      isDragging: false,
      isZooming: false,

      // 性能监控
      lastRenderTime: 0,
      averageRenderTime: 0,
      renderCount: 0
    };

    this.#logger.info("UI state initialized");
  }

  /**
   * 获取完整状态
   * @returns {Object} 当前状态的副本
   */
  getState() {
    return { ...this.#state };
  }

  /**
   * 获取特定状态值
   * @param {string} key - 状态键
   * @returns {*} 状态值
   */
  get(key) {
    return this.#state[key];
  }

  /**
   * 设置状态值
   * @param {string|Object} keyOrUpdates - 状态键或更新对象
   * @param {*} [value] - 状态值（当第一个参数是字符串时）
   */
  set(keyOrUpdates, value) {
    const oldState = { ...this.#state };

    if (typeof keyOrUpdates === 'object') {
      // 批量更新
      Object.assign(this.#state, keyOrUpdates);
      this.#logger.debug("Batch state update:", keyOrUpdates);
    } else {
      // 单个更新
      this.#state[keyOrUpdates] = value;
      this.#logger.debug(`State update: ${keyOrUpdates} = ${value}`);
    }

    // 通知变更
    this.#notifyStateChange(oldState);
  }

  /**
   * 更新缩放状态
   * @param {number} scale - 缩放级别
   * @param {string} [mode] - 缩放模式
   */
  updateScale(scale, mode = 'custom') {
    this.set({
      currentScale: scale,
      scaleMode: mode
    });
    this.#logger.info(`Scale updated: ${scale} (${mode})`);
  }

  /**
   * 更新页面状态
   * @param {number} currentPage - 当前页码
   * @param {number} [totalPages] - 总页数
   */
  updatePageInfo(currentPage, totalPages) {
    const updates = { currentPage };
    if (totalPages !== undefined) {
      updates.totalPages = totalPages;
    }
    this.set(updates);
    this.#logger.info(`Page info updated: ${currentPage}/${totalPages || this.#state.totalPages}`);
  }

  /**
   * 更新加载状态
   * @param {boolean} isLoading - 是否正在加载
   * @param {boolean} [isLoaded] - 是否已加载
   */
  updateLoadingState(isLoading, isLoaded) {
    const updates = { isLoading };
    if (isLoaded !== undefined) {
      updates.isLoaded = isLoaded;
      if (isLoaded) {
        updates.hasError = false;
        updates.errorMessage = '';
      }
    }
    this.set(updates);
  }

  /**
   * 更新错误状态
   * @param {boolean} hasError - 是否有错误
   * @param {string} [errorMessage] - 错误消息
   */
  updateErrorState(hasError, errorMessage = '') {
    this.set({
      hasError,
      errorMessage,
      isLoading: false
    });
    if (hasError) {
      this.#logger.error(`Error state: ${errorMessage}`);
    }
  }

  /**
   * 更新渲染状态
   * @param {boolean} isRendering - 是否正在渲染
   * @param {number} [pageNumber] - 正在渲染的页码
   */
  updateRenderingState(isRendering, pageNumber) {
    const updates = { isRendering };
    if (pageNumber !== undefined) {
      updates.renderingPage = pageNumber;
    }

    // 更新性能指标
    if (!isRendering && this.#state.isRendering) {
      const renderTime = Date.now() - this.#state.lastRenderTime;
      updates.renderCount = this.#state.renderCount + 1;
      updates.averageRenderTime =
        (this.#state.averageRenderTime * this.#state.renderCount + renderTime) /
        (this.#state.renderCount + 1);
    } else if (isRendering) {
      updates.lastRenderTime = Date.now();
    }

    this.set(updates);
  }

  /**
   * 添加到渲染队列
   * @param {number} pageNumber - 页码
   */
  addToRenderQueue(pageNumber) {
    if (!this.#state.renderQueue.includes(pageNumber)) {
      const queue = [...this.#state.renderQueue, pageNumber];
      this.set('renderQueue', queue);
      this.#logger.debug(`Added page ${pageNumber} to render queue`);
    }
  }

  /**
   * 从渲染队列移除
   * @param {number} pageNumber - 页码
   */
  removeFromRenderQueue(pageNumber) {
    const queue = this.#state.renderQueue.filter(p => p !== pageNumber);
    this.set('renderQueue', queue);
    this.#logger.debug(`Removed page ${pageNumber} from render queue`);
  }

  /**
   * 清空渲染队列
   */
  clearRenderQueue() {
    this.set('renderQueue', []);
    this.#logger.debug("Render queue cleared");
  }

  /**
   * 切换UI元素显示
   * @param {string} element - 元素名称
   */
  toggleUIElement(element) {
    const stateKey = `show${element.charAt(0).toUpperCase() + element.slice(1)}`;
    if (stateKey in this.#state) {
      this.set(stateKey, !this.#state[stateKey]);
      this.#logger.info(`Toggled ${element}: ${this.#state[stateKey]}`);
    }
  }

  /**
   * 注册状态变更回调
   * @param {string} id - 回调ID
   * @param {Function} callback - 回调函数
   */
  onStateChange(id, callback) {
    this.#stateChangeCallbacks.set(id, callback);
    this.#logger.debug(`State change callback registered: ${id}`);
  }

  /**
   * 移除状态变更回调
   * @param {string} id - 回调ID
   */
  removeStateChangeCallback(id) {
    this.#stateChangeCallbacks.delete(id);
    this.#logger.debug(`State change callback removed: ${id}`);
  }

  /**
   * 通知状态变更
   * @param {Object} oldState - 旧状态
   * @private
   */
  #notifyStateChange(oldState) {
    const changes = this.#getStateChanges(oldState, this.#state);
    if (Object.keys(changes).length > 0) {
      this.#stateChangeCallbacks.forEach(callback => {
        try {
          callback(this.#state, changes);
        } catch (error) {
          this.#logger.error("Error in state change callback:", error);
        }
      });
    }
  }

  /**
   * 获取状态变更
   * @param {Object} oldState - 旧状态
   * @param {Object} newState - 新状态
   * @returns {Object} 变更的键值对
   * @private
   */
  #getStateChanges(oldState, newState) {
    const changes = {};
    for (const key in newState) {
      if (oldState[key] !== newState[key]) {
        changes[key] = {
          old: oldState[key],
          new: newState[key]
        };
      }
    }
    return changes;
  }

  /**
   * 重置状态
   */
  reset() {
    this.#initializeState();
    this.#notifyStateChange({});
    this.#logger.info("UI state reset");
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能指标
   */
  getPerformanceStats() {
    return {
      renderCount: this.#state.renderCount,
      averageRenderTime: Math.round(this.#state.averageRenderTime),
      lastRenderTime: this.#state.lastRenderTime
    };
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.#stateChangeCallbacks.clear();
    this.reset();
    this.#logger.info("UI state manager destroyed");
  }
}