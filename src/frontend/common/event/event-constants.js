/**
 * 事件常量（moved）
 */
export const APP_EVENTS = {
  INITIALIZATION: { STARTED: "app:initialization:started", COMPLETED: "app:initialization:completed", FAILED: "app:initialization:failed" }
};
export const SYSTEM_EVENTS = { ERROR: { OCCURRED: "system:error:occurred" } };
export const WEBSOCKET_EVENTS = { CONNECTION: { ESTABLISHED: "websocket:connection:established", CLOSED: "websocket:connection:closed", ERROR: "websocket:connection:error", FAILED: "websocket:connection:failed" }, MESSAGE: { RECEIVED: "websocket:message:received", SEND: "websocket:message:send", SEND_FAILED: "websocket:message:send_failed" }, RECONNECT: { FAILED: "websocket:reconnect:failed" }, MSG_CENTER: { STATUS: { REQUEST: "msgcenter:status:request", RESPONSE: "msgcenter:status:response" } } };
export const PDF_MANAGEMENT_EVENTS = {
  LIST: {
    UPDATED: "pdf:list:updated",
    ADD_FILES: "pdf:list:add-files",
    REMOVE_FILES: "pdf:list:remove-files"
  },
  ADD_FILES: {
    REQUEST: "pdf:add-files:request",
    RESPONSE: "pdf:add-files:response"
  },
  REMOVE_FILES: {
    REQUEST: "pdf:remove-files:request",
    RESPONSE: "pdf:remove-files:response"
  },
  REMOVE: {
    REQUESTED: "pdf:remove:requested",
    STARTED: "pdf:remove:started",
    FAILED: "pdf:remove:failed",
    COMPLETED: "pdf:remove:completed"
  },
  BATCH: {
    REQUESTED: "pdf:batch:requested",
    STARTED: "pdf:batch:started",
    FAILED: "pdf:batch:failed",
    COMPLETED: "pdf:batch:completed"
  },
  OPEN: {
    REQUESTED: "pdf:open:requested",
    STARTED: "pdf:open:started",
    FAILED: "pdf:open:failed",
    COMPLETED: "pdf:open:completed"
  },
  EDIT: {
    REQUESTED: "pdf:edit:requested",
    STARTED: "pdf:edit:started",
    FAILED: "pdf:edit:failed",
    COMPLETED: "pdf:edit:completed"
  },
  OPERATION: {
    PROGRESS: "pdf:operation:progress"
  },
  ERROR: {
    OCCURRED: "pdf:error:occurred"
  }
};
export const UI_EVENTS = { ERROR: { SHOW: "ui:error:show" }, SUCCESS: { SHOW: "ui:success:show" }, SELECTION: { CHANGED: "ui:selection:changed" } };
export const WEBSOCKET_MESSAGE_EVENTS = { PDF_LIST_UPDATED: "websocket:message:updated", PDF_LIST: "websocket:message:list", PDF_LIST_RECEIVED: "websocket:message:received", LOAD_PDF_FILE: "websocket:message:load_pdf_file", SUCCESS: "websocket:message:success", ERROR: "websocket:message:error", RESPONSE: "websocket:message:response", SYSTEM_STATUS: "websocket:message:system_status", UNKNOWN: "websocket:message:unknown" };
export const WEBSOCKET_MESSAGE_TYPES = {
  // 新规范 (v2: 主语:谓语:宾语)
  GET_PDF_LIST: "pdf-home:get:pdf-list",
  SEARCH_PDF: "pdf-home:search:pdf-files",  // 新增：搜索PDF文件
  ADD_PDF: "pdf-home:add:pdf-files",
  REMOVE_PDF: "pdf-home:remove:pdf-files",
  OPEN_PDF: "pdf-home:open:pdf-file",
  PDF_DETAIL_REQUEST: "pdf-home:get:pdf-info",

  // 废弃的类型
  REQUEST_FILE_SELECTION: "request_file_selection", // 已废弃，不再使用
  BATCH_REMOVE_PDF: "pdf-home:remove:pdf-files" // 合并到 REMOVE_PDF
};
export const validateEventName = (eventName) => { if (!eventName || typeof eventName !== "string") return false; const parts = eventName.split(":"); return parts.length === 3 && parts.every(part => part.length > 0); };
export const EVENT_CONSTANTS = { APP: APP_EVENTS, SYSTEM: SYSTEM_EVENTS, WEBSOCKET: WEBSOCKET_EVENTS, PDF_MANAGEMENT: PDF_MANAGEMENT_EVENTS, UI: UI_EVENTS, WEBSOCKET_MESSAGE: WEBSOCKET_MESSAGE_EVENTS, WEBSOCKET_MESSAGE_TYPES: WEBSOCKET_MESSAGE_TYPES };
export default EVENT_CONSTANTS;