/**
 * @file 事件处理器模块
 * @module EventHandler
 * @description 处理PDF管理的事件监听器设置
 */

import { PDF_MANAGEMENT_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../event/event-constants.js";

/**
 * @class EventHandler
 * @description 事件处理器，负责设置和管理PDF管理相关的事件监听器
 */
export class EventHandler {
  #manager;

  /**
   * 创建事件处理器实例
   * @param {PDFManagerCore} manager - PDF管理器实例
   */
  constructor(manager) {
    this.#manager = manager;
  }

  /**
   * 注册与 PDF 相关的本地事件监听器到事件总线
   * 负责将事件路由到相应的处理函数并在错误时上报。
   * @returns {Array} 取消订阅函数数组
   */
  setupEventListeners() {
    const listeners = [
      this.#manager.eventBus.on(
        PDF_MANAGEMENT_EVENTS.ADD.REQUESTED,
        async (fileInfo) => {
          try {
            await this.handleAddPDFRequest(fileInfo);
          } catch (error) {
            this.#manager.logger.error("Error handling ADD.REQUESTED event:", error);
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle add PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED,
        (filename) => {
          try {
            this.#manager.removePDF(filename);
          } catch (error) {
            this.#manager.logger.error("Error handling REMOVE.REQUESTED event:", error);
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle remove PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED,
        (batchData) => {
          try {
            this.handleBatchRemove(batchData);
          } catch (error) {
            this.#manager.logger.error("Error handling BATCH.REQUESTED event:", error);
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle batch remove PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED,
        (filename) => {
          try {
            this.#manager.openPDF(filename);
          } catch (error) {
            this.#manager.logger.error("Error handling OPEN.REQUESTED event:", error);
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle open PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
    ];
    return listeners;
  }

  /**
   * 处理批量删除请求：将批次拆分为若干单文件删除请求并附带批次元数据以便跟踪。
   * @param {Object} batchData - 包含 files 数组及可选 timestamp 的对象。
   * @returns {void}
   */
  handleBatchRemove(batchData) {
    const { files = [], timestamp } = batchData;
    this.#manager.logger.info(
      `Handling batch remove request for ${files.length} files, timestamp: ${timestamp}`
    );

    // 为批量删除生成唯一的请求ID并跟踪剩余计数
    const batchRequestId = this.#manager.generateRequestId();
    this.#manager.batchTrack.set(batchRequestId, {
      pending: files.length,
      files: [...files],
    });

    // 按文件逐条发送删除请求，包含批次元数据，兼容后端单文件删除接口
    files.forEach((file, index) => {
      const fileEntry =
        this.#manager.pdfs.find((p) => p.id === file || p.filename === file) || null;
      let filename = fileEntry
        ? fileEntry.filename
        : typeof file === "string"
        ? file
        : undefined;
      if (filename && !filename.endsWith(".pdf")) filename = `${filename}.pdf`;
      const data = { file_id: file };
      if (filename) data.filename = filename;
      data.batch_request_id = batchRequestId;
      data.batch_index = index + 1;
      data.batch_total = files.length;
      this.#manager.eventBus.emit(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        {
          type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
          data,
        },
        { actorId: "PDFManager" }
      );
    });
  }

  /**
   * 处理添加PDF的请求 - 支持QWebChannel和WebSocket两种方式
   * @param {Object} fileInfo - 文件信息
   */
  async handleAddPDFRequest(fileInfo) {
    this.#manager.logger.info("Handling add PDF request:", JSON.stringify(fileInfo, null, 2));

    // 检查是否支持QWebChannel
    const qwebchannelAvailable = await this.#checkQWebChannelAvailable();

    if (qwebchannelAvailable) {
      this.#manager.logger.info("Using QWebChannel for file selection");
      await this.#handleQWebChannelFileSelection(fileInfo);
    } else {
      this.#manager.logger.info("Falling back to WebSocket file selection");
      this.#manager.addPDF(fileInfo);
    }
  }

  /**
   * 检查QWebChannel是否可用
   * @returns {boolean} 是否可用
   */
  async #checkQWebChannelAvailable() {
    return new Promise((resolve) => {
      // 发送检查事件并等待回应
      const timeout = setTimeout(() => resolve(false), 1000);

      const unsubscribe = this.#manager.eventBus.on('qwebchannel:ready', () => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
      });

      const unsubscribeUnavailable = this.#manager.eventBus.on('qwebchannel:unavailable', () => {
        clearTimeout(timeout);
        unsubscribe();
        unsubscribeUnavailable();
        resolve(false);
      });

      // 检查QWebChannel是否已经就绪
      this.#manager.eventBus.emit('qwebchannel:check', {}, { actorId: 'EventHandler' });
    });
  }

  /**
   * 使用QWebChannel处理文件选择
   * @param {Object} fileInfo - 文件信息
   */
  async #handleQWebChannelFileSelection(fileInfo) {
    try {
      // 通过事件总线请求QWebChannel文件选择
      this.#manager.eventBus.emit('qwebchannel:selectFiles', {
        isBatch: fileInfo?.isBatch || false
      }, { actorId: 'EventHandler' });

      this.#manager.logger.info("QWebChannel file selection request sent");
    } catch (error) {
      this.#manager.logger.error("QWebChannel file selection failed:", error);
      throw error;
    }
  }
}