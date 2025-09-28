/**
 * @file PDF管理器 - 前端PDF文件管理实现
 * @module PDFManager
 * @description 负责PDF文件的添加、删除、打开和管理功能
 */

import { PDFManagerCore } from "./pdf-manager-core.js";
import { WebSocketHandler } from "./websocket-handler.js";
import { EventHandler } from "./event-handler.js";
import { WEBSOCKET_EVENTS } from "../event/event-constants.js";

/**
 * @class PDFManager
 * @description PDF管理器，处理PDF文件的管理功能
 */
export class PDFManager extends PDFManagerCore {
  #websocketHandler;
  #eventHandler;

  constructor(eventBus) {
    super(eventBus);
    this.#websocketHandler = new WebSocketHandler(this);
    this.#eventHandler = new EventHandler(this);
  }

  /**
   * 初始化管理器：注册 websocket 与本地事件监听器并请求初始 PDF 列表。
   * @returns {void}
   */
  initialize() {
    // 设置WebSocket监听器
    const wsListeners = this.#websocketHandler.setupWebSocketListeners();
    this.unsubscribeFunctions.push(...wsListeners);

    // 设置事件监听器
    const eventListeners = this.#eventHandler.setupEventListeners();
    this.unsubscribeFunctions.push(...eventListeners);

    // 检查WebSocket连接状态并决定执行策略
    this.#checkConnectionAndRequestList();

    this.logger.info("PDF Manager initialized.");
  }

  /**
   * 检查WebSocket连接状态并请求PDF列表
   * @private
   */
  #checkConnectionAndRequestList() {
    this.logger.debug("Checking WebSocket connection status...");

    // 使用 once() 避免竞态条件和手动清理
    const timeoutId = setTimeout(() => {
      this.logger.warn("WebSocket status query timeout; falling back to connection event subscription.");
      this.#subscribeToConnectionEstablished();
    }, 1000);

    // 使用 once() 确保只处理一次状态响应
    this.eventBus.once(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE,
      (statusData) => {
        // 清理超时定时器
        clearTimeout(timeoutId);

        try {
          this.logger.info(`WebSocket status received: ${JSON.stringify(statusData)}`);

          if (statusData && statusData.connected) {
            // WebSocket已连接，直接请求PDF列表
            this.logger.info("WebSocket already connected; requesting initial PDF list directly.");
            this.loadPDFList();
          } else {
            // WebSocket未连接，订阅连接建立事件
            this.logger.info("WebSocket not connected; subscribing to connection event.");
            this.#subscribeToConnectionEstablished();
          }
        } catch (error) {
          this.logger.error("Error processing WebSocket status response:", error);
          // 发生错误时，回退到订阅连接事件
          this.#subscribeToConnectionEstablished();
        }
      },
      { subscriberId: "PDFManager" }
    );

    // 发送状态查询请求
    this.eventBus.emit(WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST, {}, { actorId: "PDFManager" });
  }

  /**
   * 订阅WebSocket连接建立事件
   * @private
   */
  #subscribeToConnectionEstablished() {
    // 使用 once() 自动处理取消订阅
    this.eventBus.once(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      () => {
        this.logger.info("WebSocket established; requesting initial PDF list.");
        this.loadPDFList();
      },
      { subscriberId: "PDFManager" }
    );
  }

  /**
   * 处理来自后端的 PDF 列表更新：将后端数据映射并更新内部缓存，然后广播更新事件。
   * @param {Object} data - 后端返回的消息对象，期望 data.data.files 为数组。
   * @param {string} source - 来源字符串，供日志记录使用。
   * @returns {void}
   */
  handlePDFListUpdate(data, source) {
    this.#websocketHandler.handlePDFListUpdate(data, source);
  }

  /**
   * 处理 WEBSOCKET_MESSAGE_EVENTS.SUCCESS 类型的消息，检测是否包含 GET_PDF_LIST 的结果。
   * @param {Object} data - websocket 返回的消息对象。
   * @returns {void}
   */
  handleSuccessResponse(data) {
    this.#websocketHandler.handleSuccessResponse(data);
  }

  /**
   * 处理后端返回的错误消息并向 UI 广播错误事件。
   * @param {Object} data - 错误消息对象，可能包含 data.message 或 message。
   * @returns {void}
   */
  handleErrorResponse(data) {
    this.#websocketHandler.handleErrorResponse(data);
  }

  /**
   * 处理通用的 RESPONSE 消息：包括快速返回的文件数组和批次删除进度追踪。
   * @param {Object} data - websocket 响应负载。
   * @returns {void}
   */
  handleResponse(data) {
    this.#websocketHandler.handleResponse(data);
  }

  /**
   * 处理批量删除请求：将批次拆分为若干单文件删除请求并附带批次元数据以便跟踪。
   * @param {Object} batchData - 包含 files 数组及可选 timestamp 的对象。
   * @returns {void}
   */
  handleBatchRemove(batchData) {
    this.#eventHandler.handleBatchRemove(batchData);
  }
}

export default PDFManager;
