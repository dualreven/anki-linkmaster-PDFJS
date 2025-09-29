/**
 * @file UI响应处理器
 * @module UIResponseHandler
 * @description 专门处理UI状态响应和更新事件
 */

import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "../../../common/event/event-constants.js";
import { DOMUtils } from "../../../common/utils/dom-utils.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * UI响应处理器类
 * @class UIResponseHandler
 */
export class UIResponseHandler {
  #eventBus;
  #logger;
  #stateManager;
  #unsubscribeFunctions = [];

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} stateManager - 状态管理器
   */
  constructor(eventBus, stateManager) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIResponseHandler");
    this.#stateManager = stateManager;
  }

  /**
   * 设置UI响应事件监听器
   */
  setupEventListeners() {
    const listeners = [
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => this.#handlePDFListUpdated(pdfs)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => this.#handleWebSocketConnected(true)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.CLOSED, () => this.#handleWebSocketConnected(false)),
      this.#eventBus.on(UI_EVENTS.ERROR.SHOW, (errorInfo) => this.#handleShowError(errorInfo.message)),
      this.#eventBus.on(UI_EVENTS.SUCCESS.SHOW, (message) => this.#handleShowSuccess(message)),
      this.#eventBus.on('ui:debug:toggle', (info) => this.#handleDebugToggle(info)),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying UIResponseHandler and cleaning up listeners.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 处理PDF列表更新事件
   * @param {Array} pdfs - PDF列表
   * @private
   */
  #handlePDFListUpdated(pdfs) {
    this.#stateManager.updatePDFList(pdfs);
  }

  /**
   * 处理WebSocket连接状态变化
   * @param {boolean} connected - 连接状态
   * @private
   */
  #handleWebSocketConnected(connected) {
    this.#stateManager.setWebSocketConnected(connected);
  }

  /**
   * 处理显示错误事件
   * @param {string} message - 错误消息
   * @private
   */
  #handleShowError(message) {
    DOMUtils.showError(message);
    this.#stateManager.setError(message);
  }

  /**
   * 处理显示成功事件
   * @param {string} message - 成功消息
   * @private
   */
  #handleShowSuccess(message) {
    DOMUtils.showSuccess(message);
    this.#stateManager.clearError();
  }

  /**
   * 处理调试状态切换
   * @param {Object} info - 调试切换信息
   * @private
   */
  #handleDebugToggle(info) {
    if (info.visible) {
      // 更新调试状态显示
      this.#updateDebugStatus();
    }
  }

  /**
   * 更新调试状态显示
   * @private
   */
  #updateDebugStatus() {
    // 这个方法由调试状态切换触发
    // 确保调试信息是最新的
    const debugInfo = this.#stateManager.getDebugInfo();
    this.#logger.debug('Debug status updated:', debugInfo);
  }
}