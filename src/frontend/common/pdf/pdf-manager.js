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

    // 修改：仅在 WebSocket 连接建立后再请求列表，避免连接前入队导致的提前发送
    const unsubscribeEstablished = this.eventBus.on(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      () => {
        try {
          this.logger.info("WebSocket established; requesting initial PDF list.");
          this.loadPDFList();
        } finally {
          try { unsubscribeEstablished(); } catch (_) {}
        }
      },
      { subscriberId: "PDFManager" }
    );

    this.logger.info("PDF Manager initialized.");
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
