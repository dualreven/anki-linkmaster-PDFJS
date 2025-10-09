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
      // 添加文件请求监听
      this.#manager.eventBus.on(
        PDF_MANAGEMENT_EVENTS.ADD_FILES.REQUEST,
        async (fileInfo) => {
          try {
            await this.handleAddFilesRequest(fileInfo);
          } catch (error) {
            this.#manager.logger.error("Error handling ADD_FILES.REQUEST event:", error);
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle add files request." },
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
        (filenameOrData) => {
          try {
            // 直接传递数据到 openPDF 方法
            // openPDF 方法会处理两种格式：string（旧格式）或 object（新格式）
            // Schema 参考: docs/SPEC/schemas/eventbus/pdf-management/v1/open.requested.schema.json
            this.#manager.openPDF(filenameOrData);
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

      // 确保 file_id 是纯ID（不带 .pdf 后缀）
      let fileId = file;
      if (typeof fileId === "string" && fileId.endsWith(".pdf")) {
        fileId = fileId.replace(/\.pdf$/, "");
      }

      let filename = fileEntry
        ? fileEntry.filename
        : typeof file === "string"
          ? file
          : undefined;
      if (filename && !filename.endsWith(".pdf")) {filename = `${filename}.pdf`;}

      const data = { file_id: fileId };
      if (filename) {data.filename = filename;}
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
   * 处理添加文件请求（新版本v002规范）- 直接向msgCenter发送消息
   * @param {Object} fileInfo - 文件信息 { isBatch: boolean }
   */
  async handleAddFilesRequest(fileInfo) {
    this.#manager.logger.info("[阶段3] [ADD_FILES] Handling add files request:", JSON.stringify(fileInfo, null, 2));

    try {
      // 检查是否已经有文件路径（新流程：文件已经通过 QWebChannel 选择好了）
      const selectedFiles = fileInfo?.files;

      if (!selectedFiles || selectedFiles.length === 0) {
        this.#manager.logger.info("[阶段3] [ADD_FILES] No files provided in request");
        return;
      }

      this.#manager.logger.info(`[阶段3] [ADD_FILES] Processing ${selectedFiles.length} files from request`);

      // 为每个文件发送WebSocket消息到msgCenter
      for (const filePath of selectedFiles) {
        const fileName = filePath.split(/[\\/]/).pop(); // 提取文件名

        this.#manager.logger.info(`[阶段3] [ADD_FILES] 发送文件到 msgCenter: ${fileName}`);
        this.#manager.logger.info(`[阶段3] [ADD_FILES]   完整路径: ${filePath}`);

        this.#manager.eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND,
          {
            type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF,
            data: {
              name: fileName,
              filepath: filePath
            }
          },
          { actorId: "PDFManager" }
        );
      }

      this.#manager.logger.info(`[阶段3] [ADD_FILES] 已发送 ${selectedFiles.length} 个文件请求到 msgCenter`);

    } catch (error) {
      this.#manager.logger.error("[阶段3] [ADD_FILES] Error in handleAddFilesRequest:", error);
      throw error;
    }
  }

}
