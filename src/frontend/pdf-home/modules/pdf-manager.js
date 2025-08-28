/**
 * PDF Manager Module
 * 负责PDF文件的管理和操作
 */

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
} from "./event-constants.js";

// 导入日志模块
import Logger from "../utils/logger.js";

/**
 * PDF文件管理器类
 */
export class PDFManager {
  #pdfs = [];
  #eventBus;
  #logger;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = new Logger("PDFManager");
  }

  /**
   * 初始化PDF管理器
   */
  initialize() {
    this.#setupWebSocketListeners();
    this.#setupEventListeners();
    this.#loadPDFList();
    this.#logger.info("PDF Manager initialized.");
  }
  
  /**
  * 销毁实例并清理资源
  */
  destroy() {
    this.#logger.info("Destroying PDF Manager and unsubscribing from all events.");
    this.#unsubscribeFunctions.forEach(unsub => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 设置WebSocket消息监听
   */
  #setupWebSocketListeners() {
    const listeners = [
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, (data) => this.#handlePDFListUpdate(data, "update")),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, (data) => this.#handlePDFListUpdate(data, "list")),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (data) => this.#handleSuccessResponse(data)),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (data) => this.#handleErrorResponse(data)),
      this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => this.#logger.debug(`Received WebSocket message: ${message.type}`, message)),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  /**
   * 设置模块内部事件监听
   */
  #setupEventListeners() {
    const listeners = [
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, (fileInfo) => {
        try {
          this.addPDF(fileInfo);
        } catch (error) {
          this.#logger.error("Error handling ADD.REQUESTED event:", error);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle add PDF request." });
        }
      }),
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, (filename) => {
        try {
          this.removePDF(filename);
        } catch (error) {
          this.#logger.error("Error handling REMOVE.REQUESTED event:", error);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle remove PDF request." });
        }
      }),
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (filename) => {
        try {
          this.openPDF(filename);
        } catch (error) {
          this.#logger.error("Error handling OPEN.REQUESTED event:", error);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle open PDF request." });
        }
      }),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  #loadPDFList() {
    this.#logger.info("Requesting PDF list from server.");
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, { type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST });
  }

  #handlePDFListUpdate(data, source) {
    try {
      this.#logger.info(`Processing PDF list from '${source}'.`);
      const files = data?.data?.files || [];
      this.#pdfs = files.map(file => this.#mapBackendToFrontend(file));
      this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.#pdfs);
    } catch (error) {
      this.#logger.error(`Error processing PDF list update from ${source}:`, error);
     this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to process PDF list." });
    }
  }

  #handleSuccessResponse(data) {
    this.#logger.info("Handling success response:", data.original_type);
    if (data?.data?.original_type === WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST && data?.data?.result?.files) {
        this.#handlePDFListUpdate({ data: data.data.result }, "success_get_list");
    }
  }

  #handleErrorResponse(data) {
    const errorMessage = data?.data?.message || data?.message || "Unknown error from server.";
    this.#logger.error("Handling error response from server:", errorMessage);
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: errorMessage });
  }

  addPDF(fileInfo) {
    this.#logger.info("Requesting to add PDF:", fileInfo);
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF,
      data: { fileInfo },
    });
  }

  removePDF(filename) {
    this.#logger.info("Requesting to remove PDF:", filename);
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
      data: { filename },
    });
  }

  openPDF(filename) {
    this.#logger.info("Requesting to open PDF:", filename);
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
      data: { filename },
    });
  }

  #mapBackendToFrontend(backendData) {
    return {
        filename: backendData.filename,
        title: backendData.title,
        size: backendData.size,
        modified_time: backendData.modified_time,
        page_count: backendData.page_count,
        annotations_count: backendData.annotations_count,
        cards_count: backendData.cards_count,
        importance: backendData.importance || "medium",
    };
  }
}

export default PDFManager;