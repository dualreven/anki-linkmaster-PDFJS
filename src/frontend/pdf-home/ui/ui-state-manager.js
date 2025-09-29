/**
 * @file UI状态管理器，负责管理UI的状态和数据
 * @module UIStateManager
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * UI状态管理器类
 */
export class UIStateManager {
  #state;
  #logger;

  constructor() {
    this.#logger = getLogger("UIStateManager");
    this.#state = {
      pdfs: [],
      loading: false,
      websocketConnected: false,
      error: null,
    };
  }

  /**
   * 获取当前状态
   * @returns {Object} 状态对象
   */
  getState() {
    return { ...this.#state };
  }

  /**
   * 获取PDF列表
   * @returns {Array} PDF列表
   */
  getPDFs() {
    return [...this.#state.pdfs];
  }

  /**
   * 更新PDF列表
   * @param {Array} pdfs - PDF列表
   */
  updatePDFList(pdfs) {
    this.#logger.info("Updating PDF list in state manager");
    this.#state.pdfs = Array.isArray(pdfs) ? pdfs : [];
  }

  /**
   * 设置加载状态
   * @param {boolean} loading - 是否正在加载
   */
  setLoading(loading) {
    this.#state.loading = !!loading;
  }

  /**
   * 是否正在加载
   * @returns {boolean}
   */
  isLoading() {
    return this.#state.loading;
  }

  /**
   * 设置WebSocket连接状态
   * @param {boolean} connected - 是否已连接
   */
  setWebSocketConnected(connected) {
    this.#state.websocketConnected = !!connected;
  }

  /**
   * 获取WebSocket连接状态
   * @returns {boolean}
   */
  isWebSocketConnected() {
    return this.#state.websocketConnected;
  }

  /**
   * 设置错误信息
   * @param {string|null} error - 错误信息
   */
  setError(error) {
    this.#state.error = error;
  }

  /**
   * 获取错误信息
   * @returns {string|null}
   */
  getError() {
    return this.#state.error;
  }

  /**
   * 清除错误
   */
  clearError() {
    this.#state.error = null;
  }

  /**
   * 获取调试状态信息
   * @returns {Object} 调试信息
   */
  getDebugInfo() {
    const { pdfs, loading, websocketConnected, error } = this.#state;
    return {
      pdfCount: pdfs.length,
      loading,
      websocketConnected,
      hasError: !!error,
      errorMessage: error
    };
  }

  /**
   * 重置状态
   */
  reset() {
    this.#logger.info("Resetting UI state");
    this.#state = {
      pdfs: [],
      loading: false,
      websocketConnected: false,
      error: null,
    };
  }
}