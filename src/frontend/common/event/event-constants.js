/**
 * 事件常量（统一三段式命名）
 */
export const APP_EVENTS = {
  INITIALIZATION: {
    STARTED: 'app:initialization:started',
    COMPLETED: 'app:initialization:completed',
    FAILED: 'app:initialization:failed'
  }
};

export const SYSTEM_EVENTS = {
  ERROR: {
    OCCURRED: 'system:error:occurred'
  }
};

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
    SEND_FAILED: 'websocket:message:send-failed'
  },
  RECONNECT: {
    FAILED: 'websocket:reconnect:failed'
  },
  MSG_CENTER: {
    STATUS: {
      REQUEST: 'msg-center:status:requested',
      RESPONSE: 'msg-center:status:completed'
    }
  }
};

export const PDF_MANAGEMENT_EVENTS = {
  LIST: {
    UPDATED: 'pdf:list:updated',
    ADD_FILES: 'pdf:list:add-files',
    REMOVE_FILES: 'pdf:list:remove-files'
  },
  ADD_FILES: {
    REQUEST: 'pdf:add-files:requested',
    RESPONSE: 'pdf:add-files:completed'
  },
  REMOVE_FILES: {
    REQUEST: 'pdf:remove-files:requested',
    RESPONSE: 'pdf:remove-files:completed'
  },
  REMOVE: {
    REQUESTED: 'pdf:remove:requested',
    STARTED: 'pdf:remove:started',
    FAILED: 'pdf:remove:failed',
    COMPLETED: 'pdf:remove:completed'
  },
  BATCH: {
    REQUESTED: 'pdf:batch:requested',
    STARTED: 'pdf:batch:started',
    FAILED: 'pdf:batch:failed',
    COMPLETED: 'pdf:batch:completed'
  },
  OPEN: {
    REQUESTED: 'pdf:open:requested',
    STARTED: 'pdf:open:started',
    FAILED: 'pdf:open:failed',
    COMPLETED: 'pdf:open:completed'
  },
  EDIT: {
    REQUESTED: 'pdf:edit:requested',
    STARTED: 'pdf:edit:started',
    FAILED: 'pdf:edit:failed',
    COMPLETED: 'pdf:edit:completed'
  },
  OPERATION: {
    PROGRESS: 'pdf:operation:progress'
  },
  ERROR: {
    OCCURRED: 'pdf:error:occurred'
  }
};

export const UI_EVENTS = {
  ERROR: {
    SHOW: 'ui:error:show'
  },
  SUCCESS: {
    SHOW: 'ui:success:show'
  },
  SELECTION: {
    CHANGED: 'ui:selection:changed'
  }
};

export const WEBSOCKET_MESSAGE_EVENTS = {
  PDF_LIST_UPDATED: 'websocket:message:updated',
  PDF_LIST: 'websocket:message:list',
  PDF_LIST_RECEIVED: 'websocket:message:received',
  LOAD_PDF_FILE: 'websocket:message:load-file',
  SUCCESS: 'websocket:message:success',
  ERROR: 'websocket:message:error',
  RESPONSE: 'websocket:message:response',
  SYSTEM_STATUS: 'websocket:message:system-status',
  BOOKMARK_LIST: 'websocket:message:bookmark-list',
  BOOKMARK_SAVE: 'websocket:message:bookmark-save',
  UNKNOWN: 'websocket:message:unknown'
};

export const WEBSOCKET_MESSAGE_TYPES = {
  // 请求消息
  GET_PDF_LIST: 'pdf-library:list:requested',
  SEARCH_PDF: 'pdf-library:search:requested',
  ADD_PDF: 'pdf-library:add:requested',
  REMOVE_PDF: 'pdf-library:remove:requested',
  OPEN_PDF: 'pdf-library:viewer:requested',
  PDF_DETAIL_REQUEST: 'pdf-library:info:requested',
  GET_CONFIG: 'pdf-library:config-read:requested',
  UPDATE_CONFIG: 'pdf-library:config-write:requested',
  // 记录更新（编辑）
  PDF_LIBRARY_RECORD_UPDATE_REQUESTED: 'pdf-library:record-update:requested',
  BOOKMARK_LIST: 'bookmark:list:requested',
  BOOKMARK_SAVE: 'bookmark:save:requested',
  PDF_PAGE_REQUEST: 'pdf-page:load:requested',
  PDF_PAGE_PRELOAD: 'pdf-page:preload:requested',
  PDF_PAGE_CACHE_CLEAR: 'pdf-page:cache-clear:requested',
  // 能力注册与存储服务（新增）
  CAPABILITY_DISCOVER: 'capability:discover:requested',
  CAPABILITY_DESCRIBE: 'capability:describe:requested',
  STORAGE_KV_GET: 'storage-kv:get:requested',
  STORAGE_KV_SET: 'storage-kv:set:requested',
  STORAGE_KV_DELETE: 'storage-kv:delete:requested',
  STORAGE_FS_READ: 'storage-fs:read:requested',
  STORAGE_FS_WRITE: 'storage-fs:write:requested',

  // Annotation (标注) 消息
  ANNOTATION_LIST: 'annotation:list:requested',
  ANNOTATION_SAVE: 'annotation:save:requested',
  ANNOTATION_DELETE: 'annotation:delete:requested',

  // 响应/广播消息
  PDF_LIST_COMPLETED: 'pdf-library:list:completed',
  PDF_LIST_FAILED: 'pdf-library:list:failed',
  ADD_PDF_COMPLETED: 'pdf-library:add:completed',
  ADD_PDF_FAILED: 'pdf-library:add:failed',
  REMOVE_PDF_COMPLETED: 'pdf-library:remove:completed',
  REMOVE_PDF_FAILED: 'pdf-library:remove:failed',
  PDF_DETAIL_COMPLETED: 'pdf-library:info:completed',
  PDF_DETAIL_FAILED: 'pdf-library:info:failed',
  SEARCH_PDF_COMPLETED: 'pdf-library:search:completed',
  SEARCH_PDF_FAILED: 'pdf-library:search:failed',
  CONFIG_READ_COMPLETED: 'pdf-library:config-read:completed',
  CONFIG_READ_FAILED: 'pdf-library:config-read:failed',
  CONFIG_WRITE_COMPLETED: 'pdf-library:config-write:completed',
  CONFIG_WRITE_FAILED: 'pdf-library:config-write:failed',
  // 记录更新（编辑）响应
  PDF_LIBRARY_RECORD_UPDATE_COMPLETED: 'pdf-library:record-update:completed',
  PDF_LIBRARY_RECORD_UPDATE_FAILED: 'pdf-library:record-update:failed',
  BOOKMARK_LIST_COMPLETED: 'bookmark:list:completed',
  BOOKMARK_LIST_FAILED: 'bookmark:list:failed',
  BOOKMARK_SAVE_COMPLETED: 'bookmark:save:completed',
  BOOKMARK_SAVE_FAILED: 'bookmark:save:failed',
  PDF_PAGE_COMPLETED: 'pdf-page:load:completed',
  PDF_PAGE_FAILED: 'pdf-page:load:failed',
  PDF_PAGE_CACHE_CLEAR_COMPLETED: 'pdf-page:cache-clear:completed',
  // 能力注册与存储服务（新增）
  CAPABILITY_DISCOVER_COMPLETED: 'capability:discover:completed',
  CAPABILITY_DESCRIBE_COMPLETED: 'capability:describe:completed',
  STORAGE_KV_GET_COMPLETED: 'storage-kv:get:completed',
  STORAGE_KV_GET_FAILED: 'storage-kv:get:failed'
  ,STORAGE_KV_SET_COMPLETED: 'storage-kv:set:completed',
  STORAGE_KV_SET_FAILED: 'storage-kv:set:failed',
  STORAGE_KV_DELETE_COMPLETED: 'storage-kv:delete:completed',
  STORAGE_KV_DELETE_FAILED: 'storage-kv:delete:failed',
  STORAGE_FS_READ_COMPLETED: 'storage-fs:read:completed',
  STORAGE_FS_READ_FAILED: 'storage-fs:read:failed',
  STORAGE_FS_WRITE_COMPLETED: 'storage-fs:write:completed',
  STORAGE_FS_WRITE_FAILED: 'storage-fs:write:failed'
  ,ANNOTATION_LIST_COMPLETED: 'annotation:list:completed',
  ANNOTATION_LIST_FAILED: 'annotation:list:failed',
  ANNOTATION_SAVE_COMPLETED: 'annotation:save:completed',
  ANNOTATION_SAVE_FAILED: 'annotation:save:failed',
  ANNOTATION_DELETE_COMPLETED: 'annotation:delete:completed',
  ANNOTATION_DELETE_FAILED: 'annotation:delete:failed'
};

// ====== 搜索与筛选（新增，为全局事件白名单注册）======
export const SEARCH_EVENTS = {
  QUERY: {
    REQUESTED: 'search:query:requested',
    STARTED: 'search:query:started',
    CLEARED: 'search:clear:requested',
  },
  RESULTS: {
    UPDATED: 'search:results:updated',
    FAILED: 'search:results:failed',
  }
};

export const FILTER_EVENTS = {
  RESULTS: {
    UPDATED: 'filter:results:updated',
  }
};

export const validateEventName = (eventName) => {
  if (!eventName || typeof eventName !== 'string') return false;
  const parts = eventName.split(':');
  return parts.length === 3 && parts.every((part) => part.length > 0);
};

export const EVENT_CONSTANTS = {
  APP: APP_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
  WEBSOCKET: WEBSOCKET_EVENTS,
  PDF_MANAGEMENT: PDF_MANAGEMENT_EVENTS,
  UI: UI_EVENTS,
  WEBSOCKET_MESSAGE: WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  SEARCH: SEARCH_EVENTS,
  FILTER: FILTER_EVENTS
};

export default EVENT_CONSTANTS;
