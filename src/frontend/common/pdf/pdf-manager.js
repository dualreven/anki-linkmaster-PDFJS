/**

 * PDFManager (moved)

 */

import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
} from "../event/event-constants.js";

import Logger from "../utils/logger.js";

/**
 * PDF 管理器，负责注册事件、维护 PDF 列表并与后端通信。
 * @class PDFManager
 */
export class PDFManager {
  #pdfs = [];
  #batchTrack = new Map();

  #eventBus;
  #logger;
  #unsubscribeFunctions = [];

/**
   * 创建 PDFManager 实例。
   * @param {Object} eventBus - 应用的事件总线，用于模块间通信。
   */
  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = new Logger("PDFManager");
  }

/**
   * 初始化管理器：注册 websocket 与本地事件监听器并请求初始 PDF 列表。
   * @returns {void}
   */
  initialize() {
    this.#setupWebSocketListeners();
    this.#setupEventListeners();
    this.#loadPDFList();
    this.#logger.info("PDF Manager initialized.");
  }

/**
   * 获取当前缓存的 PDF 列表（返回副本）。
   * @returns {Array<Object>} PDF 元数据数组。
   */
  getPDFs() {
    return Array.isArray(this.#pdfs) ? [...this.#pdfs] : [];
  }

/**
   * 销毁管理器：取消订阅所有注册的监听器并清理资源。
   * @returns {void}
   */
  destroy() {
    this.#logger.info(
      "Destroying PDF Manager and unsubscribing from all events."
    );
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

/**
   * 注册与 WebSocket 相关的事件监听器到事件总线（内部方法）。
   * @returns {void}
   */
  #setupWebSocketListeners() {
    const listeners = [
      this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED,
        (data) => this.#handlePDFListUpdate(data, "update"),
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.PDF_LIST,
        (data) => this.#handlePDFListUpdate(data, "list"),
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.SUCCESS,
        (data) => this.#handleSuccessResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.ERROR,
        (data) => this.#handleErrorResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
        (data) => this.#handleResponse(data),
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        (message) =>
          this.#logger.debug(
            `Received WebSocket message: ${message.type}`,
            message
          ),
        { subscriberId: "PDFManager" }
      ),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

/**
   * 注册与 PDF 相关的本地事件监听器到事件总线（内部方法）。
   * 负责将事件路由到相应的处理函数并在错误时上报。
   * @returns {void}
   */
  #setupEventListeners() {
    const listeners = [
      this.#eventBus.on(
        PDF_MANAGEMENT_EVENTS.ADD.REQUESTED,
        (fileInfo) => {
          try {
            this.addPDF(fileInfo);
          } catch (error) {
            this.#logger.error("Error handling ADD.REQUESTED event:", error);
            this.#eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle add PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED,
        (filename) => {
          try {
            this.removePDF(filename);
          } catch (error) {
            this.#logger.error("Error handling REMOVE.REQUESTED event:", error);
            this.#eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle remove PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED,
        (batchData) => {
          try {
            this.handleBatchRemove(batchData);
          } catch (error) {
            this.#logger.error("Error handling BATCH.REQUESTED event:", error);
            this.#eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle batch remove PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
      this.#eventBus.on(
        PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED,
        (filename) => {
          try {
            this.openPDF(filename);
          } catch (error) {
            this.#logger.error("Error handling OPEN.REQUESTED event:", error);
            this.#eventBus.emit(
              PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED,
              { message: "Failed to handle open PDF request." },
              { actorId: "PDFManager" }
            );
          }
        },
        { subscriberId: "PDFManager" }
      ),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

/**
   * 向后端发送请求以获取完整的 PDF 列表。
   * @returns {void}
   */
  #loadPDFList() {
    this.#logger.info("Requesting PDF list from server.");
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      { type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST },
      { actorId: "PDFManager" }
    );
  }

/**
   * 处理来自后端的 PDF 列表更新：将后端数据映射并更新内部缓存，然后广播更新事件。
   * @param {Object} data - 后端返回的消息对象，期望 data.data.files 为数组。
   * @param {string} source - 来源字符串，供日志记录使用。
   * @returns {void}
   */
  #handlePDFListUpdate(data, source) {
    this.#logger.info(
      `Processing PDF list from '${source}': ${JSON.stringify(
        data,
        null,
        2
      ).substring(0, 100)}[truncated]`
    );
    const files = data?.data?.files || [];
    const newPdfs = files.map((file) => this.#mapBackendToFrontend(file));
    this.#pdfs = Array.isArray(newPdfs) ? newPdfs : [];
    this.#logger.info(`PDF list updated with ${this.#pdfs.length} entries`);
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.getPDFs(), { actorId: "PDFManager" });
  }

/**
   * 处理 WEBSOCKET_MESSAGE_EVENTS.SUCCESS 类型的消息，检测是否包含 GET_PDF_LIST 的结果。
   * @param {Object} data - websocket 返回的消息对象。
   * @returns {void}
   */
  #handleSuccessResponse(data) {
    this.#logger.info("Handling success response:", data.original_type);
    if (
      data?.data?.original_type === WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST &&
      data?.data?.result?.files
    ) {
      this.#handlePDFListUpdate({ data: data.data.result }, "success_get_list");
    }
  }

/**
   * 处理后端返回的错误消息并向 UI 广播错误事件。
   * @param {Object} data - 错误消息对象，可能包含 data.message 或 message。
   * @returns {void}
   */
  #handleErrorResponse(data) {
    const errorMessage =
      data?.data?.message || data?.message || "Unknown error from server.";
    this.#logger.error("Handling error response from server:", errorMessage);
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, {
      message: errorMessage,
    });
  }

/**
   * 处理通用的 RESPONSE 消息：包括快速返回的文件数组和批次删除进度追踪。
   * @param {Object} data - websocket 响应负载。
   * @returns {void}
   */
  #handleResponse(data) {
    this.#logger.info("Handling response message:", data);

    // 兼容：后端返回完整文件数组的快速路径
    if (data?.status === "success" && Array.isArray(data?.data?.files)) {
      if (data.data.files.length > 0) {
        this.#handlePDFListUpdate(
          { data: { files: data.data.files } },
          "response_get_list"
        );
      } else {
        const addedCount = data?.data?.summary?.added || data?.data?.added || 0;
        if (addedCount > 0) {
          this.#logger.info(
            "Detected added files in response, requesting full list"
          );
          this.#loadPDFList();
        } else {
          this.#logger.debug(
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

      if (batchId && this.#batchTrack.has(batchId)) {
        const entry = this.#batchTrack.get(batchId);
        // 将成功或失败均计为已处理一项，减少 pending
        entry.pending = Math.max(0, entry.pending - 1);
        this.#logger.info(
          `Batch ${batchId} progress: ${entry.pending} remaining`
        );
        if (entry.pending === 0) {
          this.#batchTrack.delete(batchId);
          this.#logger.info(
            `Batch ${batchId} completed, requesting full PDF list`
          );
          this.#loadPDFList();
          this.#eventBus.emit(
            PDF_MANAGEMENT_EVENTS.BATCH.COMPLETED,
            { batchRequestId: batchId },
            { actorId: "PDFManager" }
          );
        }
      }
    } catch (e) {
      this.#logger.warn("Error while processing batch response tracking", e);
    }

    // 处理添加类成功提示后刷新列表的逻辑
    if (
      data?.status === "success" &&
      (data?.message?.includes("添加") || data?.message?.includes("add"))
    ) {
      this.#logger.info("PDF添加成功，重新请求列表");
      this.#loadPDFList();
    }
  }

/**
   * 请求打开文件选择器以添加 PDF（通过后端/网络层）。
   * @param {Object} fileInfo - 可选的文件信息/提示，用于引导选择流程。
   * @returns {void}
   */
  addPDF(fileInfo) {
    this.#logger.info(
      `Requesting to add PDF: ${JSON.stringify(fileInfo, null, 2)}`
    );
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      {
        type: WEBSOCKET_MESSAGE_TYPES.REQUEST_FILE_SELECTION,
        request_id: this.#generateRequestId(),
        data: { prompt: "请选择要添加的PDF文件" },
      },
      { actorId: "PDFManager" }
    );
  }

/**
   * 生成一个用于请求跟踪的半唯一 ID。
   * @returns {string} 请求 ID 字符串。
   */
  #generateRequestId() {
    return "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

/**
   * 请求删除指定 PDF（支持 id 或 filename）。
   * 若 identifier 为 id，会尝试从缓存解析对应的 filename 并补全 .pdf 后缀。
   * @param {string|number} identifier - PDF 的 id 或文件名。
   * @returns {void}
   */
  removePDF(identifier) {
    this.#logger.info(`Requesting to remove PDF: ${identifier}`);
    // Resolve filename from loaded list when possible (ensure .pdf suffix)
    const fileEntry = this.#pdfs.find(
      (p) => p.id === identifier || p.filename === identifier
    );
    let filename = fileEntry
      ? fileEntry.filename
      : typeof identifier === "string"
      ? identifier
      : undefined;
    if (filename && !filename.endsWith(".pdf")) filename = `${filename}.pdf`;
    const data = { file_id: identifier };
    if (filename) data.filename = filename;
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      {
        type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
        data,
      },
      { actorId: "PDFManager" }
    );
  }

/**
   * 请求后端打开指定的 PDF 文件（以 file_id 为标识）。
   * @param {string} filename - 要打开的文件标识。
   * @returns {void}
   */
  openPDF(filename) {
    this.#logger.info(`Requesting to open PDF: ${filename}`);
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      { type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF, data: { file_id: filename } },
      { actorId: "PDFManager" }
    );
  }

/**
   * 处理批量删除请求：将批次拆分为若干单文件删除请求并附带批次元数据以便跟踪。
   * @param {Object} batchData - 包含 files 数组及可选 timestamp 的对象。
   * @returns {void}
   */
  handleBatchRemove(batchData) {
    const { files = [], timestamp } = batchData;
    this.#logger.info(
      `Handling batch remove request for ${files.length} files, timestamp: ${timestamp}`
    );

    // 为批量删除生成唯一的请求ID并跟踪剩余计数
    const batchRequestId = this.#generateRequestId();
    this.#batchTrack.set(batchRequestId, {
      pending: files.length,
      files: [...files],
    });

    // 按文件逐条发送删除请求，包含批次元数据，兼容后端单文件删除接口
    files.forEach((file, index) => {
      const fileEntry =
        this.#pdfs.find((p) => p.id === file || p.filename === file) || null;
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
      this.#eventBus.emit(
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
   * 将后端的 PDF 对象转换为前端使用的标准结构。
   * @param {Object} backendData - 后端返回的单个 PDF 描述对象。
   * @returns {Object} 标准化后的 PDF 元数据对象。
   */
  #mapBackendToFrontend(backendData) {
    return {
      id: backendData.id || backendData.filename,
      filename: backendData.filename,
      filepath: backendData.filepath || "",
      title: backendData.title,
      size: backendData.file_size || backendData.size || 0,
      modified_time: backendData.modified_time,
      page_count: backendData.page_count,
      annotations_count: backendData.annotations_count,
      cards_count: backendData.cards_count,
      importance: backendData.importance || "medium",
    };
  }
}

export default PDFManager;
