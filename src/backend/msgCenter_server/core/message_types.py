from enum import Enum


class MessageType(Enum):
    """标准消息类型枚举 - 三段式命名及兼容旧协议"""

    # === PDF Library 基础操作 ===
    PDF_LIBRARY_LIST_REQUESTED = "pdf-library:list:requested"
    PDF_LIBRARY_LIST_COMPLETED = "pdf-library:list:completed"
    PDF_LIBRARY_LIST_FAILED = "pdf-library:list:failed"

    PDF_LIBRARY_ADD_REQUESTED = "pdf-library:add:requested"
    PDF_LIBRARY_ADD_COMPLETED = "pdf-library:add:completed"
    PDF_LIBRARY_ADD_FAILED = "pdf-library:add:failed"

    PDF_LIBRARY_REMOVE_REQUESTED = "pdf-library:remove:requested"
    PDF_LIBRARY_REMOVE_COMPLETED = "pdf-library:remove:completed"
    PDF_LIBRARY_REMOVE_FAILED = "pdf-library:remove:failed"

    PDF_LIBRARY_VIEWER_REQUESTED = "pdf-library:viewer:requested"
    PDF_LIBRARY_VIEWER_COMPLETED = "pdf-library:viewer:completed"
    PDF_LIBRARY_VIEWER_FAILED = "pdf-library:viewer:failed"

    PDF_LIBRARY_INFO_REQUESTED = "pdf-library:info:requested"
    PDF_LIBRARY_INFO_COMPLETED = "pdf-library:info:completed"
    PDF_LIBRARY_INFO_FAILED = "pdf-library:info:failed"

    PDF_LIBRARY_SEARCH_REQUESTED = "pdf-library:search:requested"
    PDF_LIBRARY_SEARCH_COMPLETED = "pdf-library:search:completed"
    PDF_LIBRARY_SEARCH_FAILED = "pdf-library:search:failed"
    PDF_LIBRARY_RECORD_UPDATE_REQUESTED = "pdf-library:record-update:requested"
    PDF_LIBRARY_RECORD_UPDATE_COMPLETED = "pdf-library:record-update:completed"
    PDF_LIBRARY_RECORD_UPDATE_FAILED = "pdf-library:record-update:failed"

    PDF_LIBRARY_CONFIG_READ_REQUESTED = "pdf-library:config-read:requested"
    PDF_LIBRARY_CONFIG_READ_COMPLETED = "pdf-library:config-read:completed"
    PDF_LIBRARY_CONFIG_READ_FAILED = "pdf-library:config-read:failed"

    PDF_LIBRARY_CONFIG_WRITE_REQUESTED = "pdf-library:config-write:requested"
    PDF_LIBRARY_CONFIG_WRITE_COMPLETED = "pdf-library:config-write:completed"
    PDF_LIBRARY_CONFIG_WRITE_FAILED = "pdf-library:config-write:failed"

    # === Bookmark 操作 ===
    BOOKMARK_LIST_REQUESTED = "bookmark:list:requested"
    BOOKMARK_LIST_COMPLETED = "bookmark:list:completed"
    BOOKMARK_LIST_FAILED = "bookmark:list:failed"

    BOOKMARK_SAVE_REQUESTED = "bookmark:save:requested"
    BOOKMARK_SAVE_COMPLETED = "bookmark:save:completed"
    BOOKMARK_SAVE_FAILED = "bookmark:save:failed"

    # === PDF 页面传输 ===
    PDF_PAGE_LOAD_REQUESTED = "pdf-page:load:requested"
    PDF_PAGE_LOAD_COMPLETED = "pdf-page:load:completed"
    PDF_PAGE_LOAD_FAILED = "pdf-page:load:failed"

    PDF_PAGE_PRELOAD_REQUESTED = "pdf-page:preload:requested"
    PDF_PAGE_CACHE_CLEAR_REQUESTED = "pdf-page:cache-clear:requested"

    # === 系统与心跳 ===
    SYSTEM_STATUS_UPDATED = "system:status:updated"
    SYSTEM_CONFIG_UPDATED = "system:config:updated"
    SYSTEM_ERROR_OCCURRED = "system:error:occurred"

    HEARTBEAT_REQUESTED = "system:heartbeat:requested"
    HEARTBEAT_COMPLETED = "system:heartbeat:completed"

    # === 能力注册中心（Capability Registry） ===
    CAPABILITY_DISCOVER_REQUESTED = "capability:discover:requested"
    CAPABILITY_DISCOVER_COMPLETED = "capability:discover:completed"
    CAPABILITY_DISCOVER_FAILED = "capability:discover:failed"

    CAPABILITY_DESCRIBE_REQUESTED = "capability:describe:requested"
    CAPABILITY_DESCRIBE_COMPLETED = "capability:describe:completed"
    CAPABILITY_DESCRIBE_FAILED = "capability:describe:failed"

    # === 存储服务（KV 最小实现） ===
    STORAGE_KV_GET_REQUESTED = "storage-kv:get:requested"
    STORAGE_KV_GET_COMPLETED = "storage-kv:get:completed"
    STORAGE_KV_GET_FAILED = "storage-kv:get:failed"
    STORAGE_KV_SET_REQUESTED = "storage-kv:set:requested"
    STORAGE_KV_SET_COMPLETED = "storage-kv:set:completed"
    STORAGE_KV_SET_FAILED = "storage-kv:set:failed"
    STORAGE_KV_DELETE_REQUESTED = "storage-kv:delete:requested"
    STORAGE_KV_DELETE_COMPLETED = "storage-kv:delete:completed"
    STORAGE_KV_DELETE_FAILED = "storage-kv:delete:failed"

    # === 存储服务（FS 最小实现） ===
    STORAGE_FS_READ_REQUESTED = "storage-fs:read:requested"
    STORAGE_FS_READ_COMPLETED = "storage-fs:read:completed"
    STORAGE_FS_READ_FAILED = "storage-fs:read:failed"
    STORAGE_FS_WRITE_REQUESTED = "storage-fs:write:requested"
    STORAGE_FS_WRITE_COMPLETED = "storage-fs:write:completed"
    STORAGE_FS_WRITE_FAILED = "storage-fs:write:failed"

    # === Annotation（标注） ===
    ANNOTATION_LIST_REQUESTED = "annotation:list:requested"
    ANNOTATION_LIST_COMPLETED = "annotation:list:completed"
    ANNOTATION_LIST_FAILED = "annotation:list:failed"

    ANNOTATION_SAVE_REQUESTED = "annotation:save:requested"
    ANNOTATION_SAVE_COMPLETED = "annotation:save:completed"
    ANNOTATION_SAVE_FAILED = "annotation:save:failed"

    # === Outline（大纲） ===
    # 2025-11-06: 统一为 pdf-viewer 前缀 + outline-* + request/complete/failed
    OUTLINE_LIST_REQUESTED = "pdf-viewer:outline-list:request"
    OUTLINE_LIST_COMPLETED = "pdf-viewer:outline-list:complete"
    OUTLINE_LIST_FAILED = "pdf-viewer:outline-list:failed"

    OUTLINE_CREATE_REQUESTED = "pdf-viewer:outline-create:request"
    OUTLINE_CREATE_COMPLETED = "pdf-viewer:outline-create:complete"
    OUTLINE_CREATE_FAILED = "pdf-viewer:outline-create:failed"

    OUTLINE_UPDATE_REQUESTED = "pdf-viewer:outline-update:request"
    OUTLINE_UPDATE_COMPLETED = "pdf-viewer:outline-update:complete"
    OUTLINE_UPDATE_FAILED = "pdf-viewer:outline-update:failed"

    OUTLINE_DELETE_REQUESTED = "pdf-viewer:outline-delete:request"
    OUTLINE_DELETE_COMPLETED = "pdf-viewer:outline-delete:complete"
    OUTLINE_DELETE_FAILED = "pdf-viewer:outline-delete:failed"

    OUTLINE_REORDER_REQUESTED = "pdf-viewer:outline-reorder:request"
    OUTLINE_REORDER_COMPLETED = "pdf-viewer:outline-reorder:complete"
    OUTLINE_REORDER_FAILED = "pdf-viewer:outline-reorder:failed"

    # 批量导入（一次性写入扁平大纲列表）
    OUTLINE_BULK_SAVE_REQUESTED = "pdf-viewer:outline-bulk-save:request"
    OUTLINE_BULK_SAVE_COMPLETED = "pdf-viewer:outline-bulk-save:complete"
    OUTLINE_BULK_SAVE_FAILED = "pdf-viewer:outline-bulk-save:failed"

    # === Debug / Flags ===
    DEBUG_INFO_READ_REQUESTED = "debug-info:read:requested"
    DEBUG_INFO_READ_COMPLETED = "debug-info:read:completed"
    DEBUG_INFO_READ_FAILED = "debug-info:read:failed"

    ANNOTATION_DELETE_REQUESTED = "annotation:delete:requested"
    ANNOTATION_DELETE_COMPLETED = "annotation:delete:completed"
    ANNOTATION_DELETE_FAILED = "annotation:delete:failed"

    # === Anchor（锚点） ===
    ANCHOR_GET_REQUESTED = "anchor:get:requested"
    ANCHOR_GET_COMPLETED = "anchor:get:completed"
    ANCHOR_GET_FAILED = "anchor:get:failed"

    ANCHOR_LIST_REQUESTED = "anchor:list:requested"
    ANCHOR_LIST_COMPLETED = "anchor:list:completed"
    ANCHOR_LIST_FAILED = "anchor:list:failed"

    ANCHOR_CREATE_REQUESTED = "anchor:create:requested"
    ANCHOR_CREATE_COMPLETED = "anchor:create:completed"
    ANCHOR_CREATE_FAILED = "anchor:create:failed"

    ANCHOR_UPDATE_REQUESTED = "anchor:update:requested"
    ANCHOR_UPDATE_COMPLETED = "anchor:update:completed"
    ANCHOR_UPDATE_FAILED = "anchor:update:failed"

    ANCHOR_DELETE_REQUESTED = "anchor:delete:requested"
    ANCHOR_DELETE_COMPLETED = "anchor:delete:completed"
    ANCHOR_DELETE_FAILED = "anchor:delete:failed"

    ANCHOR_ACTIVATE_REQUESTED = "anchor:activate:requested"
    ANCHOR_ACTIVATE_COMPLETED = "anchor:activate:completed"
    ANCHOR_ACTIVATE_FAILED = "anchor:activate:failed"

    # === PDF-Viewer 实例注册与导航 ===
    PDF_VIEWER_REGISTER_REQUESTED = "pdf-viewer:register:requested"
    PDF_VIEWER_REGISTER_COMPLETED = "pdf-viewer:register:completed"
    PDF_VIEWER_REGISTER_FAILED = "pdf-viewer:register:failed"

    PDF_VIEWER_NAVIGATE_REQUESTED = "pdf-viewer:navigate:requested"
    PDF_VIEWER_NAVIGATE_COMPLETED = "pdf-viewer:navigate:completed"
    PDF_VIEWER_NAVIGATE_FAILED = "pdf-viewer:navigate:failed"

    # === 兼容旧版消息（保留常量以便查询与降级） ===
    LEGACY_PDF_HOME_GET_PDF_LIST = "pdf-home:get:pdf-list"
    LEGACY_PDF_HOME_ADD_PDF_FILES = "pdf-home:add:pdf-files"
    LEGACY_PDF_HOME_REMOVE_PDF_FILES = "pdf-home:remove:pdf-files"
    LEGACY_PDF_HOME_OPEN_PDF_FILE = "pdf-home:open:pdf-file"
    LEGACY_PDF_HOME_GET_PDF_INFO = "pdf-home:get:pdf-info"
    LEGACY_PDF_HOME_UPDATE_PDF = "pdf-home:update:pdf"

    LEGACY_PDF_LIBRARY_LIST = "pdf-library:list:records"
    LEGACY_PDF_LIBRARY_ADD = "pdf-library:add:records"
    LEGACY_PDF_LIBRARY_REMOVE = "pdf-library:remove:records"
    LEGACY_PDF_LIBRARY_OPEN = "pdf-library:open:viewer"
    LEGACY_PDF_LIBRARY_INFO = "pdf-library:get:info"
    LEGACY_PDF_LIBRARY_SEARCH = "pdf-library:search:records"
    LEGACY_PDF_LIBRARY_GET_CONFIG = "pdf-library:get:config"
    LEGACY_PDF_LIBRARY_UPDATE_CONFIG = "pdf-library:update:config"

    LEGACY_BOOKMARK_LIST = "bookmark:list:records"
    LEGACY_BOOKMARK_SAVE = "bookmark:save:record"

    LEGACY_PDF_PAGE_REQUEST = "pdf_page_request"
    LEGACY_PDF_PAGE_RESPONSE = "pdf_page_response"
    LEGACY_PDF_PAGE_PRELOAD = "pdf_page_preload"
    LEGACY_PDF_PAGE_CACHE_CLEAR = "pdf_page_cache_clear"
    LEGACY_PDF_PAGE_ERROR = "pdf_page_error"

    LEGACY_SYSTEM_STATUS = "system_status"
    LEGACY_SYSTEM_CONFIG = "system_config"
    LEGACY_ERROR = "error"
    LEGACY_HEARTBEAT = "heartbeat"
    LEGACY_HEARTBEAT_RESPONSE = "heartbeat_response"

