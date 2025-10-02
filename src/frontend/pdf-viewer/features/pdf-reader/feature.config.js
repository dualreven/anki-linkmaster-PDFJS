/**
 * @file PDF阅读器功能域配置
 * @module features/pdf-reader/config
 */

export const PDFReaderFeatureConfig = {
  // 功能名称（唯一标识）
  name: 'pdf-reader',

  // 版本号
  version: '1.0.0',

  // 依赖的功能或服务
  dependencies: [],

  // 功能描述
  description: 'PDF阅读核心功能 - 文件加载、页面渲染、导航控制',

  // 功能包含的能力
  capabilities: [
    'PDF文件加载',
    '页面渲染',
    '导航控制（上一页/下一页）',
    '缩放控制',
    '文本层管理',
    '页面缓存管理'
  ],

  // 状态定义
  stateSchema: {
    // 当前文件信息
    currentFile: null,

    // PDF文档对象
    pdfDocument: null,

    // 当前页码
    currentPage: 1,

    // 总页数
    totalPages: 0,

    // 缩放级别
    zoomLevel: 1.0,

    // 加载状态
    loadingStatus: {
      isLoading: false,
      progress: 0,
      error: null
    },

    // 页面缓存
    pageCache: {
      maxSize: 10,
      cachedPages: []
    }
  },

  // 事件定义
  events: {
    // 文件加载相关
    FILE_LOAD_REQUESTED: '@pdf-reader/file:load:requested',
    FILE_LOAD_STARTED: '@pdf-reader/file:load:started',
    FILE_LOAD_PROGRESS: '@pdf-reader/file:load:progress',
    FILE_LOAD_SUCCESS: '@pdf-reader/file:load:success',
    FILE_LOAD_ERROR: '@pdf-reader/file:load:error',

    // 页面导航相关
    PAGE_CHANGE_REQUESTED: '@pdf-reader/page:change:requested',
    PAGE_CHANGED: '@pdf-reader/page:changed',
    PAGE_RENDER_START: '@pdf-reader/page:render:start',
    PAGE_RENDER_SUCCESS: '@pdf-reader/page:render:success',
    PAGE_RENDER_ERROR: '@pdf-reader/page:render:error',

    // 缩放控制相关
    ZOOM_CHANGE_REQUESTED: '@pdf-reader/zoom:change:requested',
    ZOOM_CHANGED: '@pdf-reader/zoom:changed'
  },

  // 服务定义
  services: {
    pdfLoader: 'pdf-loader-service',
    documentManager: 'pdf-document-manager',
    pageRenderer: 'pdf-page-renderer',
    pageCacheManager: 'pdf-page-cache-manager'
  },

  // 元数据
  metadata: {
    author: 'Anki-Linkmaster Team',
    phase: 'Phase 1',
    priority: 'high',
    createdAt: '2025-10-02',
    updatedAt: '2025-10-02'
  }
};
