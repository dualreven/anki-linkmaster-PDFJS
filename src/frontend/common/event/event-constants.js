/**
 * 事件常量（统一三段式命名）
 */
export const APP_EVENTS = {
  INITIALIZATION: {
    STARTED: "app:initialization:started",
    COMPLETED: "app:initialization:completed",
    FAILED: "app:initialization:failed"
  },
  ERROR: {
    UNHANDLED_REJECTION: "app:error:unhandled-rejection",
    GLOBAL: "app:error:global"
  }
};

export const SYSTEM_EVENTS = {
  ERROR: {
    OCCURRED: "system:error:occurred"
  },
  STATUS: {
    UPDATED: "system:status:updated"
  }
};

export const APP_WINDOW_EVENTS = {
  CLOSE: {
    REQUESTED: "app-window:close:requested",
    COMPLETED: "app-window:close:completed",
    FAILED: "app-window:close:failed"
  }
};

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
    SEND_FAILED: "websocket:message:send-failed"
  },
  RECONNECT: {
    FAILED: "websocket:reconnect:failed"
  },
  MSG_CENTER: {
    STATUS: {
      REQUEST: "msg-center:status:requested",
      RESPONSE: "msg-center:status:completed"
    }
  }
};

export const PDF_MANAGEMENT_EVENTS = {
  LIST: {
    UPDATED: "pdf:list:updated",
    ADD_FILES: "pdf:list:add-files",
    REMOVE_FILES: "pdf:list:remove-files"
  },
  ADD_FILES: {
    REQUEST: "pdf:add-files:requested",
    RESPONSE: "pdf:add-files:completed"
  },
  REMOVE_FILES: {
    REQUEST: "pdf:remove-files:requested",
    RESPONSE: "pdf:remove-files:completed"
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

export const PDF_HOME_EVENTS = {
  ADD_FILES: {
    WS_ERROR: "pdf-home:add-files:ws-error"
  },
  QWEBCHANNEL: {
    INIT: "pdf-home:qwebchannel:init"
  }
};

export const WEBSOCKET_MESSAGE_EVENTS = {
  PDF_LIST_UPDATED: "websocket:message:updated",
  PDF_LIST: "websocket:message:list",
  PDF_LIST_RECEIVED: "websocket:message:received",
  LOAD_PDF_FILE: "websocket:message:load-file",
  SUCCESS: "websocket:message:success",
  ERROR: "websocket:message:error",
  RESPONSE: "websocket:message:response",
  SYSTEM_STATUS: "websocket:message:system-status",
  BOOKMARK_LIST: "websocket:message:bookmark-list",
  BOOKMARK_SAVE: "websocket:message:bookmark-save",
  UNKNOWN: "websocket:message:unknown"
};

export const WEBSOCKET_MESSAGE_TYPES = {
  // 请求消息
  GET_PDF_LIST: "pdf-library:list:requested",
  SEARCH_PDF: "pdf-library:search:requested",
  ADD_PDF: "pdf-library:add:requested",
  REMOVE_PDF: "pdf-library:remove:requested",
  OPEN_PDF: "pdf-library:viewer:requested",
  PDF_DETAIL_REQUEST: "pdf-library:info:requested",
  GET_CONFIG: "pdf-library:config-read:requested",
  UPDATE_CONFIG: "pdf-library:config-write:requested",
  // 系统/心跳（严格三段式）
  CLIENT_REGISTER_REQUESTED: "client:register:requested",
  CLIENT_UNREGISTER_REQUESTED: "client:unregister:requested",  // 客户端取消注册
  HEARTBEAT_REQUESTED: "system:heartbeat:requested",
  // 记录更新（编辑）
  PDF_LIBRARY_RECORD_UPDATE_REQUESTED: "pdf-library:record-update:requested",
  BOOKMARK_LIST: "bookmark:list:requested",
  BOOKMARK_SAVE: "bookmark:save:requested",
  PDF_PAGE_REQUEST: "pdf-page:load:requested",
  PDF_PAGE_PRELOAD: "pdf-page:preload:requested",
  PDF_PAGE_CACHE_CLEAR: "pdf-page:cache-clear:requested",
  // 能力注册与存储服务（新增）
  CAPABILITY_DISCOVER: "capability:discover:requested",
  CAPABILITY_DESCRIBE: "capability:describe:requested",
  STORAGE_KV_GET: "storage-kv:get:requested",
  STORAGE_KV_SET: "storage-kv:set:requested",
  STORAGE_KV_DELETE: "storage-kv:delete:requested",
  STORAGE_FS_READ: "storage-fs:read:requested",
  STORAGE_FS_WRITE: "storage-fs:write:requested",

  // Annotation (标注) 消息
  ANNOTATION_LIST: "annotation:list:requested",
  ANNOTATION_SAVE: "annotation:save:requested",
  ANNOTATION_DELETE: "annotation:delete:requested",

  // Outline（大纲）消息 —— 统一命名为 pdf-viewer 前缀（2025-11-06）
  OUTLINE_LIST: "pdf-viewer:outline-list:request",
  OUTLINE_CREATE: "pdf-viewer:outline-create:request",
  OUTLINE_UPDATE: "pdf-viewer:outline-update:request",
  OUTLINE_DELETE: "pdf-viewer:outline-delete:request",
  OUTLINE_REORDER: "pdf-viewer:outline-reorder:request",

  // Anchor（锚点）消息
  ANCHOR_GET: "anchor:get:requested",
  ANCHOR_LIST: "anchor:list:requested",
  ANCHOR_CREATE: "anchor:create:requested",
  ANCHOR_UPDATE: "anchor:update:requested",
  ANCHOR_DELETE: "anchor:delete:requested",
  ANCHOR_ACTIVATE: "anchor:activate:requested",

  // Debug / Flags
  DEBUG_INFO_READ: "debug-info:read:requested",

  // 响应/广播消息
  // 查看器启动回执（pdf-home 侧接收）
  OPEN_PDF_COMPLETED: "pdf-library:viewer:completed",
  OPEN_PDF_FAILED: "pdf-library:viewer:failed",
  PDF_LIST_COMPLETED: "pdf-library:list:completed",
  PDF_LIST_FAILED: "pdf-library:list:failed",
  ADD_PDF_COMPLETED: "pdf-library:add:completed",
  ADD_PDF_FAILED: "pdf-library:add:failed",
  REMOVE_PDF_COMPLETED: "pdf-library:remove:completed",
  REMOVE_PDF_FAILED: "pdf-library:remove:failed",
  PDF_DETAIL_COMPLETED: "pdf-library:info:completed",
  PDF_DETAIL_FAILED: "pdf-library:info:failed",
  SEARCH_PDF_COMPLETED: "pdf-library:search:completed",
  SEARCH_PDF_FAILED: "pdf-library:search:failed",
  CONFIG_READ_COMPLETED: "pdf-library:config-read:completed",
  CONFIG_READ_FAILED: "pdf-library:config-read:failed",
  CONFIG_WRITE_COMPLETED: "pdf-library:config-write:completed",
  CONFIG_WRITE_FAILED: "pdf-library:config-write:failed",
  // 系统/心跳响应
  CLIENT_REGISTER_COMPLETED: "client:register:completed",
  CLIENT_REGISTER_FAILED: "client:register:failed",
  HEARTBEAT_COMPLETED: "system:heartbeat:completed",
  // 记录更新（编辑）响应
  PDF_LIBRARY_RECORD_UPDATE_COMPLETED: "pdf-library:record-update:completed",
  PDF_LIBRARY_RECORD_UPDATE_FAILED: "pdf-library:record-update:failed",
  BOOKMARK_LIST_COMPLETED: "bookmark:list:completed",
  BOOKMARK_LIST_FAILED: "bookmark:list:failed",
  BOOKMARK_SAVE_COMPLETED: "bookmark:save:completed",
  BOOKMARK_SAVE_FAILED: "bookmark:save:failed",
  PDF_PAGE_COMPLETED: "pdf-page:load:completed",
  PDF_PAGE_FAILED: "pdf-page:load:failed",
  PDF_PAGE_CACHE_CLEAR_COMPLETED: "pdf-page:cache-clear:completed",
  // 能力注册与存储服务（新增）
  CAPABILITY_DISCOVER_COMPLETED: "capability:discover:completed",
  CAPABILITY_DESCRIBE_COMPLETED: "capability:describe:completed",
  STORAGE_KV_GET_COMPLETED: "storage-kv:get:completed",
  STORAGE_KV_GET_FAILED: "storage-kv:get:failed"
  ,STORAGE_KV_SET_COMPLETED: "storage-kv:set:completed",
  STORAGE_KV_SET_FAILED: "storage-kv:set:failed",
  STORAGE_KV_DELETE_COMPLETED: "storage-kv:delete:completed",
  STORAGE_KV_DELETE_FAILED: "storage-kv:delete:failed",
  STORAGE_FS_READ_COMPLETED: "storage-fs:read:completed",
  STORAGE_FS_READ_FAILED: "storage-fs:read:failed",
  STORAGE_FS_WRITE_COMPLETED: "storage-fs:write:completed",
  STORAGE_FS_WRITE_FAILED: "storage-fs:write:failed"
  ,ANNOTATION_LIST_COMPLETED: "annotation:list:completed",
  ANNOTATION_LIST_FAILED: "annotation:list:failed",
  ANNOTATION_SAVE_COMPLETED: "annotation:save:completed",
  ANNOTATION_SAVE_FAILED: "annotation:save:failed",
  ANNOTATION_DELETE_COMPLETED: "annotation:delete:completed",
  ANNOTATION_DELETE_FAILED: "annotation:delete:failed"
  ,OUTLINE_LIST_COMPLETED: "pdf-viewer:outline-list:complete",
  OUTLINE_LIST_FAILED: "pdf-viewer:outline-list:failed",
  OUTLINE_CREATE_COMPLETED: "pdf-viewer:outline-create:complete",
  OUTLINE_CREATE_FAILED: "pdf-viewer:outline-create:failed",
  OUTLINE_UPDATE_COMPLETED: "pdf-viewer:outline-update:complete",
  OUTLINE_UPDATE_FAILED: "pdf-viewer:outline-update:failed",
  OUTLINE_DELETE_COMPLETED: "pdf-viewer:outline-delete:complete",
  OUTLINE_DELETE_FAILED: "pdf-viewer:outline-delete:failed",
  OUTLINE_REORDER_COMPLETED: "pdf-viewer:outline-reorder:complete",
  OUTLINE_REORDER_FAILED: "pdf-viewer:outline-reorder:failed"
  ,OUTLINE_BULK_SAVE: "pdf-viewer:outline-bulk-save:request",
  OUTLINE_BULK_SAVE_COMPLETED: "pdf-viewer:outline-bulk-save:complete",
  OUTLINE_BULK_SAVE_FAILED: "pdf-viewer:outline-bulk-save:failed"
  ,ANCHOR_GET_COMPLETED: "anchor:get:completed",
  ANCHOR_GET_FAILED: "anchor:get:failed",
  ANCHOR_LIST_COMPLETED: "anchor:list:completed",
  ANCHOR_LIST_FAILED: "anchor:list:failed",
  ANCHOR_CREATE_COMPLETED: "anchor:create:completed",
  ANCHOR_CREATE_FAILED: "anchor:create:failed",
  ANCHOR_UPDATE_COMPLETED: "anchor:update:completed",
  ANCHOR_UPDATE_FAILED: "anchor:update:failed",
  ANCHOR_DELETE_COMPLETED: "anchor:delete:completed",
  ANCHOR_DELETE_FAILED: "anchor:delete:failed",
  ANCHOR_ACTIVATE_COMPLETED: "anchor:activate:completed",
  ANCHOR_ACTIVATE_FAILED: "anchor:activate:failed",

  // Debug / Flags
  DEBUG_INFO_READ_COMPLETED: "debug-info:read:completed",
  DEBUG_INFO_READ_FAILED: "debug-info:read:failed",

  // ====== PDF-Viewer 实例注册与导航（新增）======
  // 前端→后端：PDF-Viewer 实例注册（包含 viewer_id 与 pdf_uuid 绑定）
  VIEWER_REGISTER_REQUESTED: "pdf-viewer:register:requested",
  // 后端→前端：PDF-Viewer 实例注册完成/失败回执
  VIEWER_REGISTER_COMPLETED: "pdf-viewer:register:completed",
  VIEWER_REGISTER_FAILED: "pdf-viewer:register:failed",
  // 后端→前端：请求指定 viewer 导航到目标位置
  VIEWER_NAVIGATE_REQUESTED: "pdf-viewer:navigate:requested",
  // 前端→后端：导航完成/失败回执（带 correlation_id）
  VIEWER_NAVIGATE_COMPLETED: "pdf-viewer:navigate:completed",
  VIEWER_NAVIGATE_FAILED: "pdf-viewer:navigate:failed"
};

// 旧服务/兼容消息类型（仅用于 ws-client 解析与迁移期兼容）
// 注意：该常量集允许出现三段式字面量，因为本文件属于事件常量白名单
export const WEBSOCKET_LEGACY_TYPES = {
  PDF_LIBRARY_LIST_RECORDS: "pdf-library:list:records",
  BOOKMARK_LIST_RECORDS: "bookmark:list:records",
  BOOKMARK_SAVE_RECORD: "bookmark:save:record",
  PDF_LIBRARY_REMOVE_RECORDS: "pdf-library:remove:records",
  PDF_LIBRARY_OPEN_VIEWER: "pdf-library:open:viewer"
};

// ====== 搜索与筛选（新增，为全局事件白名单注册）======
export const SEARCH_EVENTS = {
  QUERY: {
    REQUESTED: "search:query:requested",
    STARTED: "search:query:started",
    CLEARED: "search:clear:requested",
  },
  RESULTS: {
    UPDATED: "search:results:updated",
    FAILED: "search:results:failed",
  },
  ACTIONS: {
    // 顶部搜索栏的操作按钮（全局事件白名单）
    SORT_REQUESTED: "search:sort:requested",
    ADD_REQUESTED: "search:add:requested"
  }
};

export const FILTER_EVENTS = {
  ADVANCED: {
    OPEN: "filter:advanced:open",
  },
  PRESET: {
    SAVE: "filter:preset:save",
    SAVED: "filter:preset:saved",
  },
  APPLY: {
    COMPLETED: "filter:apply:completed",
  },
  STATE: {
    UPDATED: "filter:state:updated",
  },
  RESULTS: {
    UPDATED: "filter:results:updated",
  },
};

// 搜索结果控制（用于跨模块请求结果聚焦/高亮等）
export const SEARCH_RESULTS_EVENTS = {
  FOCUS: {
    REQUESTED: "search-results:focus:requested",
  },
  ACTIONS: {
    OPEN: "search-results:item:open",
    SELECTED: "search-results:item:selected",
    FOCUSED: "search-results:item:focused",
    SELECTION_TOGGLED: "search-results:item:selection-toggled",
    CTRL_CLICKED: "search-results:item:ctrl-clicked",
  },
};

export const SIDEBAR_EVENTS = {
  RENDER: {
    COMPLETED: "sidebar:render:completed"
  },
  TOGGLE: {
    COMPLETED: "sidebar:toggle:completed"
  }
};

// PDF编辑器事件（用于 pdf-editor 功能域）
export const PDF_EDITOR_EVENTS = {
  RECORD: {
    UPDATED: "editor:record:updated"
  }
};

// 表头事件（用于排序等功能）
export const HEADER_EVENTS = {
  SORT: {
    REQUESTED: "header:sort:requested"
  }
};

// 排序器事件（用于 pdf-sorter 功能域）
export const SORTER_EVENTS = {
  MODE: {
    CHANGED: "sorter:mode:changed",
  },
  SORT: {
    REQUESTED: "sorter:sort:requested",
    APPLIED: "sorter:sort:applied",
    CLEARED: "sorter:sort:cleared",
    CHANGED: "sorter:sort:changed",
    SAVED: "sorter:sort:saved",
    LOADED: "sorter:sort:loaded",
  },
  CONFIG: {
    CHANGED: "sorter:config:changed"
  },
  PANEL: {
    SHOWN: "sorter:panel:shown",
    HIDDEN: "sorter:panel:hidden"
  }
};

export const validateEventName = (eventName) => {
  if (!eventName || typeof eventName !== "string") {return false;}
  const parts = eventName.split(":");
  return parts.length === 3 && parts.every((part) => part.length > 0);
};

export const EVENT_CONSTANTS = {
  APP: APP_EVENTS,
  APP_WINDOW: APP_WINDOW_EVENTS,
  SYSTEM: SYSTEM_EVENTS,
  WEBSOCKET: WEBSOCKET_EVENTS,
  PDF_MANAGEMENT: PDF_MANAGEMENT_EVENTS,
  UI: UI_EVENTS,
  WEBSOCKET_MESSAGE: WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  SEARCH: SEARCH_EVENTS,
  FILTER: FILTER_EVENTS,
  SEARCH_RESULTS: SEARCH_RESULTS_EVENTS,
  SIDEBAR: SIDEBAR_EVENTS,
  PDF_EDITOR: PDF_EDITOR_EVENTS,
  HEADER: HEADER_EVENTS,
  SORTER: SORTER_EVENTS
};

export default EVENT_CONSTANTS;

