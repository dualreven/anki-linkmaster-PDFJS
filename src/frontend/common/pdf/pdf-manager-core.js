/**
 * @file PDF管理器核心模块
 * @module PDFManagerCore
 * @description PDF管理器的核心功能，包括基础管理和配置
 */

import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
} from "../event/event-constants.js";

import Logger from "../utils/logger.js";

/**
 * @class PDFManagerCore
 * @description PDF管理器核心类，处理基础配置和生命周期
 */
export class PDFManagerCore {
  #pdfs = [];
  #batchTrack = new Map();
  #eventBus;
  #logger;
  #unsubscribeFunctions = [];
  #lastListRequestTs = 0; // 上次请求完整列表的时间戳（ms）
  #listRequestCooldownMs = 2000; // 防止短时间内重复刷新导致死循环（毫秒）

  /**
   * 创建 PDFManagerCore 实例。
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
    this.setupWebSocketListeners();
    this.setupEventListeners();
    this.loadPDFList();
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
   * 向后端发送请求以获取完整的 PDF 列表。
   * @returns {void}
   */
  loadPDFList() {
    this.#logger.info("Requesting PDF list from server.");
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      { type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST },
      { actorId: "PDFManager" }
    );
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
        request_id: this.generateRequestId(),
        data: { prompt: "请选择要添加的PDF文件" },
      },
      { actorId: "PDFManager" }
    );
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
    if (filename && !filename.endsWith(".pdf")) {filename = `${filename}.pdf`;}
    const data = { file_id: identifier };
    if (filename) {data.filename = filename;}
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
   *
   * Schema 参考: docs/SPEC/schemas/eventbus/pdf-management/v1/open.requested.schema.json
   *
   * @param {string|Object} filenameOrData - 文件标识或包含完整信息的对象
   *   - 旧格式（string）: 直接传递文件名，向后兼容
   *   - 新格式（object）: { filename: string, needNavigate?: Object }
   *
   * @param {string} filenameOrData.filename - PDF 文件名或文件 ID
   * @param {Object} [filenameOrData.needNavigate] - 可选的导航参数
   * @param {number} [filenameOrData.needNavigate.pageAt] - 目标页码（从1开始，1-10000）
   * @param {number} [filenameOrData.needNavigate.position] - 页面内位置百分比（0-100）
   * @param {string} [filenameOrData.needNavigate.pdfanchor] - PDF锚点ID（格式: pdfanchor-{12位十六进制}）
   * @param {string} [filenameOrData.needNavigate.pdfannotation] - PDF标注ID（格式: pdfannotation-{base64url16}）
   *
   * @returns {void}
   *
   * @example
   * // 旧格式：直接传递文件名
   * pdfManager.openPDF('sample.pdf');
   *
   * @example
   * // 新格式：仅打开文件
   * pdfManager.openPDF({ filename: 'sample.pdf' });
   *
   * @example
   * // 新格式：打开并跳转到页码
   * pdfManager.openPDF({
   *   filename: 'sample.pdf',
   *   needNavigate: { pageAt: 5 }
   * });
   *
   * @example
   * // 新格式：打开并跳转到页码+位置
   * pdfManager.openPDF({
   *   filename: 'sample.pdf',
   *   needNavigate: { pageAt: 5, position: 50 }
   * });
   *
   * @example
   * // 新格式：打开并跳转到锚点
   * pdfManager.openPDF({
   *   filename: 'sample.pdf',
   *   needNavigate: { pdfanchor: 'pdfanchor-abc123def456' }
   * });
   */
  openPDF(filenameOrData) {
    // 参数解析：兼容旧格式（string）和新格式（object）
    let filename;
    let needNavigate = null;

    if (typeof filenameOrData === "string") {
      // 旧格式：直接传递文件名字符串
      filename = filenameOrData;
      this.#logger.info(`Requesting to open PDF (legacy format): ${filename}`);
    } else if (typeof filenameOrData === "object" && filenameOrData !== null) {
      // 新格式：传递完整的数据对象
      filename = filenameOrData.filename;
      needNavigate = filenameOrData.needNavigate || null;

      this.#logger.info(`Requesting to open PDF (new format): ${filename}`, {
        hasNavigate: !!needNavigate,
        navigate: needNavigate
      });
    } else {
      this.#logger.error("Invalid parameter type for openPDF:", typeof filenameOrData);
      return;
    }

    // 验证文件名
    if (!filename || typeof filename !== "string") {
      this.#logger.error("Invalid filename for openPDF:", filename);
      return;
    }

    // 构建发送给后端的数据
    const data = { file_id: filename };

    // 如果存在 needNavigate，添加到数据中
    if (needNavigate && typeof needNavigate === "object") {
      data.needNavigate = { ...needNavigate };

      // 记录导航参数的详细信息
      this.#logger.debug("Navigation parameters included:", {
        hasPageAt: needNavigate.pageAt !== undefined,
        hasPosition: needNavigate.position !== undefined,
        hasPdfAnchor: needNavigate.pdfanchor !== undefined,
        hasPdfAnnotation: needNavigate.pdfannotation !== undefined,
        pageAt: needNavigate.pageAt,
        position: needNavigate.position,
        pdfanchor: needNavigate.pdfanchor,
        pdfannotation: needNavigate.pdfannotation
      });
    }

    // 发送 WebSocket 消息
    this.#eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      { type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF, data },
      { actorId: "PDFManager" }
    );
  }

  /**
   * 生成一个用于请求跟踪的半唯一 ID。
   * @returns {string} 请求 ID 字符串。
   */
  generateRequestId() {
    return "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 将后端的 PDF 对象转换为前端使用的标准结构。
   * @param {Object} backendData - 后端返回的单个 PDF 描述对象。
   * @returns {Object} 标准化后的 PDF 元数据对象。
   */
  mapBackendToFrontend(backendData) {
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
      // 学习管理字段 (扩展 - 2025-10-02)
      last_accessed_at: backendData.last_accessed_at || 0,
      review_count: backendData.review_count || 0,
      rating: backendData.rating || 0,
      is_visible: backendData.is_visible !== undefined ? backendData.is_visible : true,
      total_reading_time: backendData.total_reading_time || 0,
      due_date: backendData.due_date || 0,
    };
  }

  // 受保护的getter方法，供子类访问私有字段
  get eventBus() { return this.#eventBus; }
  get logger() { return this.#logger; }
  get pdfs() { return this.#pdfs; }
  set pdfs(value) { this.#pdfs = value; }
  get batchTrack() { return this.#batchTrack; }
  get unsubscribeFunctions() { return this.#unsubscribeFunctions; }
  get lastListRequestTs() { return this.#lastListRequestTs; }
  set lastListRequestTs(value) { this.#lastListRequestTs = value; }
  get listRequestCooldownMs() { return this.#listRequestCooldownMs; }
}
