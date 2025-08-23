/**
 * 事件名称常量模块
 * 定义所有事件名称常量，确保事件命名一致性
 */

// ===== 应用事件 =====
export const APP_EVENTS = {
  INITIALIZATION: {
    STARTED: 'app:initialization:started',
    COMPLETED: 'app:initialization:completed',
    FAILED: 'app:initialization:failed'
  }
};

// ===== 系统事件 =====
export const SYSTEM_EVENTS = {
  ERROR: {
    OCCURRED: 'system:error:occurred'
  }
};

// ===== WebSocket事件 =====
export const WEBSOCKET_EVENTS = {
  CONNECTION: {
    ESTABLISHED: 'websocket:connection:established',
    CLOSED: 'websocket:connection:closed',
    ERROR: 'websocket:connection:error',
    FAILED: 'websocket:connection:failed'
  },
  MESSAGE: {
    RECEIVED: 'websocket:message:received',
    SEND: 'websocket:message:send',
    SEND_FAILED: 'websocket:message:send_failed'
  },
  RECONNECT: {
    FAILED: 'websocket:reconnect:failed'
  }
};

// ===== PDF管理事件 =====
export const PDF_MANAGEMENT_EVENTS = {
  LIST: {
    UPDATED: 'pdf:management:list_updated'
  },
  ADD: {
    REQUESTED: 'pdf:management:add_requested',
    STARTED: 'pdf:management:add_started',
    FAILED: 'pdf:management:add_failed',
    COMPLETED: 'pdf:management:add_completed'
  },
  REMOVE: {
    REQUESTED: 'pdf:management:remove_requested',
    STARTED: 'pdf:management:remove_started',
    FAILED: 'pdf:management:remove_failed',
    COMPLETED: 'pdf:management:remove_completed'
  },
  OPEN: {
    REQUESTED: 'pdf:management:open_requested',
    STARTED: 'pdf:management:open_started',
    FAILED: 'pdf:management:open_failed',
    COMPLETED: 'pdf:management:open_completed'
  },
  ERROR: 'pdf:management:error:occurred',
  OPENED: 'pdf:management:open:completed'
};

// ===== UI事件 =====
export const UI_EVENTS = {
  ERROR: {
    SHOW: 'ui:error:show'
  },
  SUCCESS: {
    SHOW: 'ui:success:show'
  }
};

// ===== WebSocket消息事件 =====
export const WEBSOCKET_MESSAGE_EVENTS = {
  PDF_LIST_UPDATED: 'websocket:message:pdf_list_updated',
  PDF_LIST: 'websocket:message:pdf_list',
  SUCCESS: 'websocket:message:success',
  ERROR: 'websocket:message:error'
};

// ===== 事件名称验证工具 =====
export const validateEventName = (eventName) => {
  if (!eventName || typeof eventName !== 'string') {
    return false;
  }
  
  // 检查格式: {module}:{action}:{status}
  const parts = eventName.split(':');
  return parts.length === 3 && parts.every(part => part.length > 0);
};

// ===== 事件名称常量导出 =====
export const EVENT_CONSTANTS = {
  APP: APP_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
  WEBSOCKET: WEBSOCKET_EVENTS,
  PDF_MANAGEMENT: PDF_MANAGEMENT_EVENTS,
  UI: UI_EVENTS,
  WEBSOCKET_MESSAGE: WEBSOCKET_MESSAGE_EVENTS
};

// 默认导出所有事件常量
export default EVENT_CONSTANTS;