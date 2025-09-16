/**
 * @file PDF管理器核心模块
 * @module PDFManagerCore
 * @description PDF管理器的核心功能，包括基础管理和配置
 */

import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
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