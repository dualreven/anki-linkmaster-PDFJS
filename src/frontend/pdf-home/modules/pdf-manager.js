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
} from "../event/event-constants.js";

// 导入日志模块
import Logger from "../../pdf-home/utils/logger.js";

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

  // Public accessor for other modules (e.g., app.getState)
  getPDFs() {
    return Array.isArray(this.#pdfs) ? [...this.#pdfs] : [];
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
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, (data) => this.#handlePDFListUpdate(data, "update"), { subscriberId: 'PDFManager' }),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, (data) => this.#handlePDFListUpdate(data, "list"), { subscriberId: 'PDFManager' }),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (data) => this.#handleSuccessResponse(data), { subscriberId: 'PDFManager' }),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (data) => this.#handleErrorResponse(data), { subscriberId: 'PDFManager' }),
      this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (data) => this.#handleResponse(data), { subscriberId: 'PDFManager' }),
      this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => this.#logger.debug(`Received WebSocket message: ${message.type}`, message), { subscriberId: 'PDFManager' }),
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
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle add PDF request." }, { actorId: 'PDFManager' });
        }
      }, { subscriberId: 'PDFManager' }),
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, (payload) => {
        try {
          const filename = (typeof payload === 'string') ? payload : (payload && (payload.filename || payload.filepath || payload.id));
          if (!filename) throw new Error('REMOVE.REQUESTED payload missing filename');
          this.removePDF(filename);
        } catch (error) {
          this.#logger.error("Error handling REMOVE.REQUESTED event:", error);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle remove PDF request." }, { actorId: 'PDFManager' });
        }
      }, { subscriberId: 'PDFManager' }),
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (payload) => {
        try {
          const filename = (typeof payload === 'string') ? payload : (payload && (payload.filename || payload.filepath || payload.id));
          if (!filename) throw new Error('OPEN.REQUESTED payload missing filename');
          this.openPDF(filename);
        } catch (error) {
          this.#logger.error("Error handling OPEN.REQUESTED event:", error);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle open PDF request." }, { actorId: 'PDFManager' });
        }
      }, { subscriberId: 'PDFManager' }),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  #loadPDFList() {
    this.#logger.info("Requesting PDF list from server.");
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, { type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST }, { actorId: 'PDFManager' });
  }

  #handlePDFListUpdate(data, source) {
    try {
      this.#logger.info(`Processing PDF list from '${source}': ${JSON.stringify(data, null, 2)}`);
      const files = data?.data?.files || [];
      this.#pdfs = files.map(file => this.#mapBackendToFrontend(file));
      this.#logger.info(`Processed ${this.#pdfs.length} PDF files: ${JSON.stringify(this.#pdfs, null, 2)}`);
      this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.#pdfs, { actorId: 'PDFManager' });
    } catch (error) {
      this.#logger.error(`Error processing PDF list update from ${source}: ${error.message}`, error);
     this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to process PDF list." }, { actorId: 'PDFManager' });
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

  #handleResponse(data) {
    this.#logger.info("Handling response message:", data);
    
    // 处理PDF列表响应（仅在服务器返回非空列表时替换本地列表）
    if (data?.status === "success" && Array.isArray(data?.data?.files)) {
      if (data.data.files.length > 0) {
        this.#handlePDFListUpdate({ data: { files: data.data.files } }, "response_get_list");
      } else {
        // 如果服务器返回空数组，通常意味着这是一次非列表更新（如添加操作的ack）或用户取消选择。
        // 避免用空数组覆盖本地列表。若响应中包含summary并指示已添加文件，则主动拉取完整列表。
        const addedCount = data?.data?.summary?.added || data?.data?.added || 0;
        if (addedCount > 0) {
          this.#logger.info("Detected added files in response, requesting full list");
          this.#loadPDFList();
        } else {
          this.#logger.debug("Ignoring empty files array in response to avoid clearing UI");
        }
      }
    }
    
    // 处理添加PDF的响应（兼容后端返回的消息字段）
    if (data?.status === "success" && (data?.message?.includes("添加") || data?.message?.includes("add"))) {
      this.#logger.info("PDF添加成功，重新请求列表");
      this.#loadPDFList(); // 重新请求PDF列表
    }
  }

  addPDF(fileInfo) {
    this.#logger.info(`Requesting to add PDF: ${JSON.stringify(fileInfo, null, 2)}`);
    
    // 对于QtWebEngine项目，后端会处理文件选择
    // 发送文件选择请求，后端会弹出文件选择器
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.REQUEST_FILE_SELECTION,
      request_id: this.#generateRequestId(),
      data: { 
        // 可以包含一些提示信息，但文件选择由后端处理
        prompt: "请选择要添加的PDF文件"
      },
    }, { actorId: 'PDFManager' });
  }

  /**
   * 生成请求ID
   * @returns {string} 唯一的请求ID
   */
  #generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  removePDF(identifier) {
    this.#logger.info(`Requesting to remove PDF: ${identifier}`);
    const data = {};
    if (identifier) {
      // Backend expects file_id field
      data.file_id = identifier;
    }

    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
      data,
    }, { actorId: 'PDFManager' });
  }

  openPDF(filename) {
    this.#logger.info(`Requesting to open PDF: ${filename}`);
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
      data: { filename },
    }, { actorId: 'PDFManager' });
  }

  #mapBackendToFrontend(backendData) {
    return {
        id: backendData.id || backendData.filename, // Use ID or fallback to filename
        filename: backendData.filename,
        filepath: backendData.filepath || '', // Include required filepath field
        title: backendData.title,
        size: backendData.file_size || backendData.size || 0, // Handle both backend field names
        modified_time: backendData.modified_time,
        page_count: backendData.page_count,
        annotations_count: backendData.annotations_count,
        cards_count: backendData.cards_count,
        importance: backendData.importance || "medium",
    };
  }
}

export default PDFManager;