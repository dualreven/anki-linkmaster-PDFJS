/**
 * 事件名称常量模块
 * 定义所有事件名称常量，确保事件命名一致性
 */

// ===== 应用事件 =====
export const APP_EVENTS = {
  INITIALIZATION: {
    STARTED: "app:initialization:started",
    COMPLETED: "app:initialization:completed",
    FAILED: "app:initialization:failed"
  }
};

// ===== 系统事件 =====
export const SYSTEM_EVENTS = {
  ERROR: {
    OCCURRED: "system:error:occurred"
  }
};

// ===== WebSocket事件 =====
export const WEBSOCKET_EVENTS = {
  CONNECTION: {
    ESTABLISHED: "websocket:connection:established",
    CLOSED: "websocket:connection:closed",
    ERROR: "websocket:connection:error",
    FAILED: "websocket:connection:failed"
  },
  MESSAGE: {
    RECEIVED: "websocket:message:received",
    SEND: "websocket:message:send",
    SEND_FAILED: "websocket:message:send_failed"
  },
  RECONNECT: {
    FAILED: "websocket:reconnect:failed"
  }
};

// ===== PDF管理事件 =====
export const PDF_MANAGEMENT_EVENTS = {
  LIST: {
    UPDATED: "pdf:list:updated"
  },
  ADD: {
    REQUESTED: "pdf:add:requested",
    STARTED: "pdf:add:started",
    FAILED: "pdf:add:failed",
    COMPLETED: "pdf:add:completed"
  },
  REMOVE: {
    REQUESTED: "pdf:remove:requested",
    STARTED: "pdf:remove:started",
    FAILED: "pdf:remove:failed",
    COMPLETED: "pdf:remove:completed"
  },
  DELETE: {
    REQUESTED: "pdf:delete:requested"
  },
  OPEN: {
    REQUESTED: "pdf:open:requested",
    STARTED: "pdf:open:started",
    FAILED: "pdf:open:failed",
    COMPLETED: "pdf:open:completed"
  },
  ERROR: {
    OCCURRED: "pdf:error:occurred"
  }
};

// ===== UI事件 =====
export const UI_EVENTS = {
  ERROR: {
    SHOW: "ui:error:show"
  },
  SUCCESS: {
    SHOW: "ui:success:show"
  },
  SELECTION: {
    CHANGED: "ui:selection:changed"
  }
};

// ===== WebSocket消息事件 =====
export const WEBSOCKET_MESSAGE_EVENTS = {
  PDF_LIST_UPDATED: "websocket:message:updated",
  PDF_LIST_RECEIVED: "websocket:message:received",
  SUCCESS: "websocket:message:success",
  ERROR: "websocket:message:error",
  UNKNOWN: "websocket:message:unknown" // 用于未知消息类型
};

// ===== WebSocket消息类型常量 =====
export const WEBSOCKET_MESSAGE_TYPES = {
  GET_PDF_LIST: "get_pdf_list",
  ADD_PDF: "add_pdf",
  REMOVE_PDF: "remove_pdf",
  OPEN_PDF: "open_pdf"
};

// ===== 事件名称验证工具 =====
export const validateEventName = (eventName) => {
  if (!eventName || typeof eventName !== "string") {
    return false;
  }

  // 检查格式: {module}:{action}:{status}
  const parts = eventName.split(":");
  return parts.length === 3 && parts.every(part => part.length > 0);
};

// ===== 事件名称常量导出 =====
export const EVENT_CONSTANTS = {
  APP: APP_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
  WEBSOCKET: WEBSOCKET_EVENTS,
  PDF_MANAGEMENT: PDF_MANAGEMENT_EVENTS,
  UI: UI_EVENTS,
  WEBSOCKET_MESSAGE: WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES: WEBSOCKET_MESSAGE_TYPES
};

// 默认导出所有事件常量
export default EVENT_CONSTANTS;
