/**
 * PDF-Viewer 事件常量（权威列表以此文件为准）
 * 详细说明：docs/standards/pdf-viewer-event-constants.md
 * 事件流程：docs/standards/pdf-viewer-event-flow.md
 */
export const PDF_VIEWER_EVENTS = {
  FILE: {
    LOAD: {
      REQUESTED: "pdf-viewer:file:load-requested",
      SUCCESS: "pdf-viewer:file:load-success",
      FAILED: "pdf-viewer:file:load-failed",
      PROGRESS: "pdf-viewer:file:load-progress",
      RETRY: "pdf-viewer:file:load-retry",
    },
    CLOSE: "pdf-viewer:file:close",
    INFO_REQUESTED: "pdf-viewer:file:info:requested",
    INFO_RESPONSE: "pdf-viewer:file:info:response",
  },
  PAGE: {
    CHANGING: "pdf-viewer:page:changing",
  },
  NAVIGATION: {
    PREVIOUS: "pdf-viewer:navigation:previous",
    NEXT: "pdf-viewer:navigation:next",
    GOTO: "pdf-viewer:navigation:goto",
    CHANGED: "pdf-viewer:navigation:changed",
    TOTAL_PAGES_UPDATED: "pdf-viewer:navigation:total-pages-updated",
    URL_PARAMS: {
      PARSED: "pdf-viewer:url-params:parsed",
      REQUESTED: "pdf-viewer:url-params:requested",
      SUCCESS: "pdf-viewer:url-params:success",
      FAILED: "pdf-viewer:url-params:failed",
    },
  },
  ZOOM: {
    IN: "pdf-viewer:zoom:in",
    OUT: "pdf-viewer:zoom:out",
    FIT_WIDTH: "pdf-viewer:zoom:fit-width",
    FIT_HEIGHT: "pdf-viewer:zoom:fit-height",
    ACTUAL_SIZE: "pdf-viewer:zoom:actual-size",
    CHANGED: "pdf-viewer:zoom:changed",
    CHANGING: "pdf-viewer:zoom:changing",
  },
  TRANSLATOR: {
    TEXT: {
      SELECTED: "pdf-translator:text:selected",
      CLEARED: "pdf-translator:text:cleared",
    },
    TRANSLATE: {
      REQUESTED: "pdf-translator:translate:requested",
      STARTED: "pdf-translator:translate:started",
      COMPLETED: "pdf-translator:translate:completed",
      FAILED: "pdf-translator:translate:failed",
    },
    SIDEBAR: {
      TOGGLE: "pdf-translator:sidebar:toggle",
      OPENED: "pdf-translator:sidebar:opened",
      CLOSED: "pdf-translator:sidebar:closed",
    },
    CARD: {
      CREATE_REQUESTED: "pdf-translator:card:create-requested",
      CREATE_SUCCESS: "pdf-translator:card:create-success",
      CREATE_FAILED: "pdf-translator:card:create-failed",
    },
    ENGINE: {
      CHANGED: "pdf-translator:engine:changed",
    },
    HISTORY: {
      ADDED: "pdf-translator:history:added",
      CLEARED: "pdf-translator:history:cleared",
    },
  },
  VIEW_MODE: {
    RENDER_MODE_CHANGED: "pdf-viewer:render-mode:changed",
    MOUSE_MODE_CHANGED: "pdf-viewer:mouse-mode:changed",
  },
  RENDER: {
    READY: "pdf-viewer:render:ready",
    PAGE_REQUESTED: "pdf-viewer:render-page:requested",
    PAGE_COMPLETED: "pdf-viewer:render-page:completed",
    PAGE_FAILED: "pdf-viewer:render-page:failed",
    QUALITY_CHANGED: "pdf-viewer:render:quality:changed",
  },
  TEXT: {
    SELECTED: "pdf-viewer:text:selected",
    SEARCH_REQUESTED: "pdf-viewer:text:search:requested",
    SEARCH_RESULT: "pdf-viewer:text:search:result",
    SEARCH_COMPLETED: "pdf-viewer:text:search:completed",
  },
  SEARCH: {
    UI: {
      OPEN: "pdf-viewer:search-ui:opened",
      CLOSE: "pdf-viewer:search-ui:closed",
      TOGGLE: "pdf-viewer:search-ui:toggled",
    },
    EXECUTE: {
      QUERY: "pdf-viewer:search:query-requested",
      QUERY_CHANGED: "pdf-viewer:search:query-changed",
      CLEAR: "pdf-viewer:search:clear-requested",
    },
    RESULT: {
      FOUND: "pdf-viewer:search-result:found",
      NOT_FOUND: "pdf-viewer:search-result:not-found",
      UPDATED: "pdf-viewer:search-result:updated",
      PROGRESS: "pdf-viewer:search-result:progress",
    },
    NAVIGATE: {
      NEXT: "pdf-viewer:search-navigate:next",
      PREV: "pdf-viewer:search-navigate:prev",
      TO: "pdf-viewer:search-navigate:to",
      COMPLETED: "pdf-viewer:search-navigate:completed",
    },
    OPTION: {
      CHANGED: "pdf-viewer:search-option:changed",
      RESET: "pdf-viewer:search-option:reset",
    },
    STATE: {
      INITIALIZED: "pdf-viewer:search-state:initialized",
      DESTROYED: "pdf-viewer:search-state:destroyed",
      SEARCHING: "pdf-viewer:search-state:searching",
      IDLE: "pdf-viewer:search-state:idle",
    },
  },
  OUTLINE: {
    SIDEBAR: {
      TOGGLE: "pdf-viewer:outline-sidebar:toggle",
      OPENED: "pdf-viewer:outline-sidebar:opened",
      CLOSED: "pdf-viewer:outline-sidebar:closed",
    },
    LOAD: {
      REQUESTED: "pdf-viewer:outline-load:requested",
      SUCCESS: "pdf-viewer:outline-load:success",
      FAILED: "pdf-viewer:outline-load:failed",
      EMPTY: "pdf-viewer:outline-load:empty",
    },
    NAVIGATE: {
      REQUESTED: "pdf-viewer:outline-navigate:requested",
      SUCCESS: "pdf-viewer:outline-navigate:success",
      FAILED: "pdf-viewer:outline-navigate:failed",
    },
    NAVIGATE_BY_ID: {
      REQUESTED: "pdf-viewer:outline-navigate-by-id:requested",
    },
    CREATE: {
      REQUESTED: "pdf-viewer:outline-create:requested",
      SUCCESS: "pdf-viewer:outline-create:success",
      FAILED: "pdf-viewer:outline-create:failed",
    },
    UPDATE: {
      REQUESTED: "pdf-viewer:outline-update:requested",
      SUCCESS: "pdf-viewer:outline-update:success",
      FAILED: "pdf-viewer:outline-update:failed",
    },
    DELETE: {
      REQUESTED: "pdf-viewer:outline-delete:requested",
      SUCCESS: "pdf-viewer:outline-delete:success",
      FAILED: "pdf-viewer:outline-delete:failed",
    },
    REORDER: {
      REQUESTED: "pdf-viewer:outline-reorder:requested",
      SUCCESS: "pdf-viewer:outline-reorder:success",
      FAILED: "pdf-viewer:outline-reorder:failed",
    },
    SORT: {
      MODE_CHANGED: "pdf-viewer:outline-sort:mode-changed",
    },
    SELECT: {
      CHANGED: "pdf-viewer:outline-select:changed",
    },
    SORT_MODE: {
      CHANGED: "pdf-viewer:outline-sortmode:changed",
    },
  },
  RESUME: {
    LOAD: {
      REQUESTED: "resume:load:requested",
      LOADED: "resume:load:success",
      LOAD_FAILED: "resume:load:failed",
    },
    APPLY: {
      REQUESTED: "resume:apply:requested",
      SUCCESS: "resume:apply:success",
      FAILED: "resume:apply:failed",
    },
    UPDATE: {
      REQUESTED: "resume:update:requested",
      SUCCESS: "resume:update:success",
      FAILED: "resume:update:failed",
    },
    FLOW: {
      DONE: "resume:flow:done"
    }
  },
  UI: {
    TOOLBAR_TOGGLE: "pdf-viewer:ui:toolbar-toggle",
    SIDEBAR_TOGGLE: "pdf-viewer:ui:sidebar:toggle",
    THUMBNAIL_TOGGLE: "pdf-viewer:ui:thumbnail:toggle",
    RESIZED: "pdf-viewer:ui:resized",
    FULLSCREEN_TOGGLE: "pdf-viewer:ui:fullscreen:toggle",
  },
  STATE: {
    CHANGED: "pdf-viewer:state:changed",
    INITIALIZED: "pdf-viewer:state:initialized",
    DESTROYED: "pdf-viewer:state:destroyed",
    ERROR: "pdf-viewer:state:error",
    LOADING: "pdf-viewer:state:loading",
    RESET: "pdf-viewer:state:reset",
  },
  SIDEBAR_MANAGER: {
    TOGGLE_REQUESTED: "sidebar:toggle:requested",
    OPEN_REQUESTED: "sidebar:open:requested",
    CLOSE_REQUESTED: "sidebar:close:requested",
    OPENED_COMPLETED: "sidebar:opened:completed",
    CLOSED_COMPLETED: "sidebar:closed:completed",
    LAYOUT_UPDATED: "sidebar:layout:updated",
  },
  ANNOTATION: {
    SIDEBAR: {
      OPEN: "annotation-sidebar:toggle:open",
      CLOSE: "annotation-sidebar:toggle:close",
      TOGGLE: "annotation-sidebar:toggle:requested",
      OPENED: "annotation-sidebar:toggle:opened",
      CLOSED: "annotation-sidebar:toggle:closed",
      FILTER_TOGGLE: "annotation-sidebar:filter:toggle",
      SORT_TOGGLE: "annotation-sidebar:sort:toggle",
      SETTINGS_OPEN: "annotation-sidebar:settings:open",
      ID_COPY_SUCCESS: "annotation:id-copy:success",
    },
    MANAGER: {
      OPEN_WINDOW_REQUESTED: "annotation-manager:window-open:requested",
      OPEN_WINDOW_SUCCESS: "annotation-manager:window-open:success",
      OPEN_WINDOW_FAILED: "annotation-manager:window-open:failed",
    },
    TOOL: {
      ACTIVATE: "annotation-tool:activate:requested",
      DEACTIVATE: "annotation-tool:deactivate:requested",
      ACTIVATED: "annotation-tool:activate:success",
      DEACTIVATED: "annotation-tool:deactivate:success",
    },
    CREATE: "annotation:create:requested",
    CREATED: "annotation:create:success",
    CREATE_FAILED: "annotation:create:failed",
    UPDATE: "annotation:update:requested",
    UPDATED: "annotation:update:success",
    UPDATE_FAILED: "annotation:update:failed",
    DELETE: "annotation:delete:requested",
    DELETED: "annotation:delete:success",
    DELETE_FAILED: "annotation:delete:failed",
    SELECT: "annotation:select:requested",
    SELECTED: "annotation:select:success",
    NAVIGATION: {
      JUMP_REQUESTED: "annotation-navigation:jump:requested",
      JUMP_SUCCESS: "annotation-navigation:jump:success",
      JUMP_FAILED: "annotation-navigation:jump:failed",
    },
    JUMP_TO: "annotation-navigation:jump:requested",
    HIGHLIGHT: "annotation:highlight:requested",
    COMMENT: {
      ADD: "annotation-comment:add:requested",
      ADDED: "annotation-comment:add:success",
      DELETE: "annotation-comment:delete:requested",
      DELETED: "annotation-comment:delete:success",
    },
    DATA: {
      LOAD: "annotation-data:load:requested",
      LOADED: "annotation-data:load:success",
      SAVE: "annotation-data:save:requested",
      SAVED: "annotation-data:save:success",
      LOAD_FAILED: "annotation-data:load:failed",
      SAVE_FAILED: "annotation-data:save:failed",
    },
    SCREENSHOT: {
      START: "annotation-screenshot:start:requested",
      AREA_SELECTED: "annotation-screenshot:area:selected",
      CAPTURED: "annotation-screenshot:capture:success",
      CANCEL: "annotation-screenshot:cancel:requested",
    },
    TEXT_HIGHLIGHT: {
      SELECTION_START: "annotation-highlight:selection:started",
      TEXT_SELECTED: "annotation-highlight:text:selected",
      HIGHLIGHT_APPLIED: "annotation-highlight:apply:success",
    },
    COMMENT_TOOL: {
      ACTIVE: "annotation-comment-tool:activate:success",
      POSITION_SELECTED: "annotation-comment-tool:position:selected",
    },
  },
  PDFJS_EVENTS: {
    PAGE: {
      CHANGING: "pagechanging",
      RENDERED: "pagerendered",
      TEXT_LAYER_RENDERED: "textlayerrendered",
    },
    SCALE: {
      CHANGING: "scalechanging",
      CHANGED: "scalechange",
    },
    FIND: {
      UPDATE_MATCHES_COUNT: "updatefindmatchescount",
      UPDATE_CONTROL_STATE: "updatefindcontrolstate",
    }
  },
  MOUSE: {
    MODE_CHANGED: "pdf-viewer:mouse-mode:changed",
  },
  PAGE_TRANSFER: {
    REQUESTED: "pdf-viewer:page-transfer:requested",
    RESPONSE: "pdf-viewer:page-transfer:response",
  },
  NOTIFICATION: {
    ERROR: {
      TRIGGERED: "notification:error:triggered",
    },
  },
  ANCHOR: {
    DATA: {
      LOAD: "anchor-data:load:requested",
      LOADED: "anchor-data:load:success",
      LOAD_FAILED: "anchor-data:load:failed",
    },
    CREATE: "anchor:create:requested",
    CREATED: "anchor:create:success",
    CREATE_FAILED: "anchor:create:failed",
    UPDATE: "anchor:update:requested",
    UPDATED: "anchor:update:success",
    UPDATE_FAILED: "anchor:update:failed",
    DELETE: "anchor:delete:requested",
    DELETED: "anchor:delete:success",
    DELETE_FAILED: "anchor:delete:failed",
    COPY: "anchor:copy:requested",
    COPIED: "anchor:copy:success",
    ACTIVATE: "anchor:activate:requested",
    ACTIVATED: "anchor:activate:success",
    NAVIGATE: {
      REQUESTED: "anchor-navigate:jump:requested",
      SUCCESS: "anchor-navigate:jump:success",
      FAILED: "anchor-navigate:jump:failed",
    },
  },
};
export default PDF_VIEWER_EVENTS;
