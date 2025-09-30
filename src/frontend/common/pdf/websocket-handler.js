/**
 * @file WebSocket消息处理器模块
 * @module WebSocketHandler
 * @description 处理PDF管理的WebSocket消息接收和处理
 */

import {
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  PDF_MANAGEMENT_EVENTS
} from "../event/event-constants.js";

/**
 * @class WebSocketHandler
 * @description WebSocket消息处理器，负责处理PDF管理相关的WebSocket消息
 */
export class WebSocketHandler {
  #manager;

  /**
   * 创建WebSocket处理器实例
   * @param {PDFManagerCore} manager - PDF管理器实例
   */
  constructor(manager) {
    this.#manager = manager;
  }

  /**
   * 注册与 WebSocket 相关的事件监听器到事件总线
   * @returns {Array} 取消订阅函数数组
   */
  setupWebSocketListeners() {
    const listeners = [
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED,
        (data) => this.handlePDFListUpdate(data, "update"),
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.PDF_LIST,
        (data) => this.handlePDFListUpdate(data, "list"),
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.SUCCESS,
        (data) => this.handleSuccessResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.ERROR,
        (data) => this.handleErrorResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
        (data) => this.handleResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#manager.eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.SYSTEM_STATUS,
        (data) => this.handleSystemStatus(data),
        { subscriberId: "PDFManager" }
      ),
    ];
    return listeners;
  }

  /**
   * 处理来自后端的 PDF 列表更新：将后端数据映射并更新内部缓存，然后广播更新事件。
   * @param {Object} data - 后端返回的消息对象，期望 data.data.files 为数组。
   * @param {string} source - 来源字符串，供日志记录使用。
   * @returns {void}
   */
  handlePDFListUpdate(data, source) {
    this.#manager.logger.info(
      `Processing PDF list from '${source}': ${JSON.stringify(
        data,
        null,
        2
      ).substring(0, 100)}[truncated]`
    );
    const files = data?.data?.files || [];
    const newPdfs = files.map((file) => this.#manager.mapBackendToFrontend(file));
    this.#manager.pdfs = Array.isArray(newPdfs) ? newPdfs : [];
    this.#manager.logger.info(`PDF list updated with ${this.#manager.pdfs.length} entries`);
    this.#manager.eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.#manager.getPDFs(), { actorId: "PDFManager" });
  }

  /**
   * 处理 WEBSOCKET_MESSAGE_EVENTS.SUCCESS 类型的消息，检测是否包含 GET_PDF_LIST 的结果。
   * @param {Object} data - websocket 返回的消息对象。
   * @returns {void}
   */
  handleSuccessResponse(data) {
    this.#manager.logger.info("Handling success response:", data.original_type);
    if (
      data?.data?.original_type === WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST &&
      data?.data?.result?.files
    ) {
      this.handlePDFListUpdate({ data: data.data.result }, "success_get_list");
    }
  }

  /**
   * 处理后端返回的错误消息并向 UI 广播错误事件。
   * @param {Object} data - 错误消息对象，可能包含 data.message 或 message。
   * @returns {void}
   */
  handleErrorResponse(data) {
    const errorMessage =
      data?.data?.message || data?.message || "Unknown error from server.";
    this.#manager.logger.error("Handling error response from server:", errorMessage);
    this.#manager.eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, {
      message: errorMessage,
    });
  }

  /**
   * 处理系统状态消息（包括 file_added 等广播事件）
   * @param {Object} data - system_status 消息对象
   * @returns {void}
   */
  handleSystemStatus(data) {
    this.#manager.logger.info("[阶段4] 收到 system_status 消息:", JSON.stringify(data, null, 2));

    const eventType = data?.data?.event;

    if (eventType === "file_added") {
      const fileInfo = data?.data?.file_info;
      this.#manager.logger.info("[阶段4] 检测到文件添加事件:", fileInfo?.filename);

      // 发布 UI 成功消息事件
      const successMessage = `文件添加成功: ${fileInfo?.title || fileInfo?.filename}`;
      this.#manager.eventBus.emit(
        "ui:success:show",
        successMessage,
        { actorId: "PDFManager" }
      );

      // 增量添加新文件到本地列表（性能优化：避免完整刷新）
      if (fileInfo) {
        this.#manager.logger.info("[阶段4] 增量添加新文件到列表");
        const newPdf = this.#manager.mapBackendToFrontend(fileInfo);

        // 添加到列表顶部
        this.#manager.pdfs.unshift(newPdf);

        // 发布增量更新事件，UI层会自动调用 addRow
        this.#manager.eventBus.emit(
          "pdf:file:added",
          newPdf,
          { actorId: "PDFManager" }
        );

        this.#manager.logger.info("[阶段4] 新文件已添加到列表，无需完整刷新");
      }
    }
  }

  /**
   * 处理通用的 RESPONSE 消息：包括快速返回的文件数组和批次删除进度追踪。
   * @param {Object} data - websocket 响应负载。
   * @returns {void}
   */
  handleResponse(data) {
    this.#manager.logger.info("Handling response message:", JSON.stringify(data, null, 2));

    // 兼容：后端返回完整文件数组的快速路径
    if (data?.status === "success" && Array.isArray(data?.data?.files)) {
      if (data.data.files.length > 0) {
        this.handlePDFListUpdate(
          { data: { files: data.data.files } },
          "response_get_list"
        );
      } else {
        const addedCount = data?.data?.summary?.added || data?.data?.added || 0;
        if (addedCount > 0) {
          this.#manager.logger.info(
            "Detected added files in response, requesting full list"
          );
          this.#manager.loadPDFList();
        } else {
          this.#manager.logger.debug(
            "Ignoring empty files array in response to avoid clearing UI"
          );
        }
      }
    }

    // 处理单文件/批量删除响应：如果后端回显了 batch_request_id，则用于批次计数管理
    try {
      const respData = data?.data || {};
      const batchId =
        respData?.batch_request_id || respData?.batch_request_id_str || null;
      const originalType =
        respData?.original_type ||
        data?.original_type ||
        respData?.type ||
        null;

      if (batchId && this.#manager.batchTrack.has(batchId)) {
        const entry = this.#manager.batchTrack.get(batchId);
        // 后端可能会以多种方式回显批次处理结果：
        // 1) 按文件逐条回显（包含 batch_index）
        // 2) 聚合回显一次性完成（不包含 batch_index，但包含 files/summary/processed_count）
        // 根据回显内容决定如何更新 pending
        try {
          const batchIndex = respData?.batch_index;
          const batchTotal = respData?.batch_total || entry.files.length;

          // 聚合完成回显：如果响应中包含 files 数组且长度等于批次数量，或 summary 指示已处理数量等于批次数量
          const filesArray = Array.isArray(respData?.files) ? respData.files : Array.isArray(data?.data?.files) ? data.data.files : null;
          const processedSummary = respData?.summary || respData?.result || {};
          const processedCount = processedSummary?.processed || processedSummary?.deleted || processedSummary?.removed || processedSummary?.added || null;

          if (batchIndex != null) {
            // 单文件回显，减少1
            entry.pending = Math.max(0, entry.pending - 1);
          } else if (filesArray && filesArray.length === batchTotal) {
            // 后端一次性返回了全部文件 -> 批次全部完成
            entry.pending = 0;
          } else if (typeof processedCount === 'number') {
            // 如果 summary 中包含处理计数，按计数减少（保护性约束）
            const toReduce = Math.min(entry.pending, processedCount);
            entry.pending = Math.max(0, entry.pending - toReduce);
          } else {
            // 回退：默认减少1，兼容较简单的后端回显
            entry.pending = Math.max(0, entry.pending - 1);
          }

          this.#manager.logger.info(
            `Batch ${batchId} progress: ${entry.pending} remaining`
          );

          if (entry.pending === 0) {
            this.#manager.batchTrack.delete(batchId);
            this.#manager.logger.info(
              `Batch ${batchId} completed, requesting full PDF list`
            );
            const now = Date.now();
            if (now - this.#manager.lastListRequestTs > this.#manager.listRequestCooldownMs) {
              this.#manager.lastListRequestTs = now;
              this.#manager.loadPDFList();
            } else {
              this.#manager.logger.info('Skipping immediate list reload due to cooldown to avoid refresh loop');
            }
            this.#manager.eventBus.emit(
              PDF_MANAGEMENT_EVENTS.BATCH.COMPLETED,
              { batchRequestId: batchId },
              { actorId: "PDFManager" }
            );
          }
        } catch (e) {
          this.#manager.logger.warn('Error updating batch tracking for ' + batchId, e);
        }
      } else {
        // 移除聚合批处理响应的误判逻辑
        // 只有在明确需要刷新时（如删除、添加成功后）才会触发列表刷新
        // 普通的pdf_list响应不应该触发额外的刷新请求
      }
    } catch (e) {
      this.#manager.logger.warn("Error while processing batch response tracking", e);
    }

    // 处理添加类成功提示后刷新列表的逻辑
    if (
      data?.status === "success" &&
      (data?.message?.includes("添加") || data?.message?.includes("add"))
    ) {
      this.#manager.logger.info("PDF添加成功，重新请求列表");
      this.#manager.loadPDFList();
    }
  }
}