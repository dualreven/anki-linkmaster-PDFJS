/**

 * PDFManager (moved)

 */

import { PDF_MANAGEMENT_EVENTS, WEBSOCKET_MESSAGE_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../event/event-constants.js";

import Logger from "../../pdf-home/utils/logger.js";



export class PDFManager {

  #pdfs = [];

  #eventBus; #logger; #unsubscribeFunctions = [];

  constructor(eventBus) { this.#eventBus = eventBus; this.#logger = new Logger("PDFManager"); }

  initialize() { this.#setupWebSocketListeners(); this.#setupEventListeners(); this.#loadPDFList(); this.#logger.info("PDF Manager initialized."); }

  getPDFs() { return Array.isArray(this.#pdfs) ? [...this.#pdfs] : []; }

  destroy() { this.#logger.info("Destroying PDF Manager and unsubscribing from all events."); this.#unsubscribeFunctions.forEach(unsub => unsub()); this.#unsubscribeFunctions = []; }

  #setupWebSocketListeners() { const listeners = [this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, (data) => this.#handlePDFListUpdate(data, "update"), { subscriberId: 'PDFManager' }), this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, (data) => this.#handlePDFListUpdate(data, "list"), { subscriberId: 'PDFManager' }), this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (data) => this.#handleSuccessResponse(data), { subscriberId: 'PDFManager' }), this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (data) => this.#handleErrorResponse(data), { subscriberId: 'PDFManager' }), this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (data) => this.#handleResponse(data), { subscriberId: 'PDFManager' }), this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => this.#logger.debug(`Received WebSocket message: ${message.type}`, message), { subscriberId: 'PDFManager' }),]; this.#unsubscribeFunctions.push(...listeners); }

  #setupEventListeners() { const listeners = [this.#eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, (fileInfo) => { try { this.addPDF(fileInfo); } catch (error) { this.#logger.error("Error handling ADD.REQUESTED event:", error); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle add PDF request." }, { actorId: 'PDFManager' }); } }, { subscriberId: 'PDFManager' }), this.#eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, (filename) => { try { this.removePDF(filename); } catch (error) { this.#logger.error("Error handling REMOVE.REQUESTED event:", error); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle remove PDF request." }, { actorId: 'PDFManager' }); } }, { subscriberId: 'PDFManager' }), this.#eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (filename) => { try { this.openPDF(filename); } catch (error) { this.#logger.error("Error handling OPEN.REQUESTED event:", error); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to handle open PDF request." }, { actorId: 'PDFManager' }); } }, { subscriberId: 'PDFManager' }),]; this.#unsubscribeFunctions.push(...listeners); }

  #loadPDFList() { this.#logger.info("Requesting PDF list from server."); this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, { type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST }, { actorId: 'PDFManager' }); }

  #handlePDFListUpdate(data, source) { try { this.#logger.info(`Processing PDF list from '${source}': ${JSON.stringify(data, null, 2).substring(0, 100)}[truncated]`); const files = data?.data?.files || []; this.#pdfs = files.map(file => this.#mapBackendToFrontend(file)); this.#logger.info(`Processed ${this.#pdfs.length} PDF files: ${JSON.stringify(this.#pdfs, null, 2).substring(0, 100)}[truncated]`); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.#pdfs, { actorId: 'PDFManager' }); } catch (error) { this.#logger.error(`Error processing PDF list update from ${source}: ${error.message}`, error); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: "Failed to process PDF list." }, { actorId: 'PDFManager' }); } }

  #handleSuccessResponse(data) { this.#logger.info("Handling success response:", data.original_type); if (data?.data?.original_type === WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST && data?.data?.result?.files) { this.#handlePDFListUpdate({ data: data.data.result }, "success_get_list"); } }

  #handleErrorResponse(data) { const errorMessage = data?.data?.message || data?.message || "Unknown error from server."; this.#logger.error("Handling error response from server:", errorMessage); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR.OCCURRED, { message: errorMessage }); }

  #handleResponse(data) { this.#logger.info("Handling response message:", data); if (data?.status === "success" && Array.isArray(data?.data?.files)) { if (data.data.files.length > 0) { this.#handlePDFListUpdate({ data: { files: data.data.files } }, "response_get_list"); } else { const addedCount = data?.data?.summary?.added || data?.data?.added || 0; if (addedCount > 0) { this.#logger.info("Detected added files in response, requesting full list"); this.#loadPDFList(); } else { this.#logger.debug("Ignoring empty files array in response to avoid clearing UI"); } } } if (data?.status === "success" && (data?.message?.includes("添加") || data?.message?.includes("add"))) { this.#logger.info("PDF添加成功，重新请求列表"); this.#loadPDFList(); } }

  addPDF(fileInfo) { this.#logger.info(`Requesting to add PDF: ${JSON.stringify(fileInfo, null, 2)}`); this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, { type: WEBSOCKET_MESSAGE_TYPES.REQUEST_FILE_SELECTION, request_id: this.#generateRequestId(), data: { prompt: "请选择要添加的PDF文件" }, }, { actorId: 'PDFManager' }); }

  #generateRequestId() { return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

  removePDF(identifier) { this.#logger.info(`Requesting to remove PDF: ${identifier}`);
    // Resolve filename from loaded list when possible (ensure .pdf suffix)
    const fileEntry = this.#pdfs.find(p => p.id === identifier || p.filename === identifier);
    let filename = fileEntry ? fileEntry.filename : (typeof identifier === 'string' ? identifier : undefined);
    if (filename && !filename.endsWith('.pdf')) filename = `${filename}.pdf`;
    const data = { file_id: identifier };
    if (filename) data.filename = filename;
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
      data,
    }, { actorId: 'PDFManager' }); }

  openPDF(filename) { this.#logger.info(`Requesting to open PDF: ${filename}`); this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, { type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF, data: { file_id: filename }, }, { actorId: 'PDFManager' }); }

  #mapBackendToFrontend(backendData) { return { id: backendData.id || backendData.filename, filename: backendData.filename, filepath: backendData.filepath || '', title: backendData.title, size: backendData.file_size || backendData.size || 0, modified_time: backendData.modified_time, page_count: backendData.page_count, annotations_count: backendData.annotations_count, cards_count: backendData.cards_count, importance: backendData.importance || "medium", }; }

}

export default PDFManager;