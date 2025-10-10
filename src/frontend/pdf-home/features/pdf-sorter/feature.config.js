/**
 * @file PDF Sorter 功能域配置
 * @module features/pdf-sorter/config
 */

export const PDFSorterFeatureConfig = {
  /**
   * 功能名称（唯一标识）
   */
  name: 'pdf-sorter',

  /**
   * 功能版本（遵循 SemVer 规范）
   */
  version: '1.0.0',

  /**
   * 功能依赖
   * - 依赖 pdf-list 功能域（需要访问列表数据）
   */
  dependencies: ['pdf-list'],

  /**
   * 功能描述
   */
  description: 'PDF 排序功能域 - 提供 PDF 列表的多字段排序、自定义排序、保存排序方案等功能',

  /**
   * 功能作者
   */
  author: 'PDF-Home Team',

  /**
   * 功能配置
   */
  config: {
    /**
     * 排序配置
     */
    sorter: {
      // 默认排序字段（按标题字母序）
      defaultSortField: 'title',

      // 默认排序方向（升序）
      defaultSortDirection: 'asc', // 'asc' or 'desc'

      // 支持的排序字段
      sortableFields: [
        { field: 'filename', label: '文件名', type: 'string' },
        { field: 'title', label: '书名', type: 'string' },
        { field: 'author', label: '作者', type: 'string' },
        { field: 'subject', label: '主题', type: 'string' },
        { field: 'keywords', label: '关键词', type: 'string' },
        { field: 'notes', label: '备注', type: 'string' },
        { field: 'size', label: '文件大小', type: 'number' },
        { field: 'rating', label: '评分', type: 'number' },
        { field: 'review_count', label: '复习次数', type: 'number' },
        { field: 'total_reading_time', label: '总阅读时长', type: 'number' },
        { field: 'page_count', label: '页数', type: 'number' },
        { field: 'star', label: '星标', type: 'number' },
        { field: 'created_time', label: '创建时间', type: 'datetime' },
        { field: 'modified_time', label: '修改时间', type: 'datetime' },
        { field: 'last_accessed_at', label: '最后访问时间', type: 'datetime' },
        { field: 'due_date', label: '截止日期', type: 'datetime' }
      ],

      // 是否支持多字段排序
      multiSort: true,

      // 最多支持的排序字段数量
      maxSortFields: 3
    },

    /**
     * 事件配置
     */
    events: {
      // 事件命名空间（由 ScopedEventBus 自动添加）
      namespace: '@pdf-sorter/',

      // 本地事件（功能域内部事件）
      local: {
        // 排序方案改变事件
        SORT_CHANGED: 'sort:changed',
        // 排序方案保存事件
        SORT_SAVED: 'sort:saved',
        // 排序方案加载事件
        SORT_LOADED: 'sort:loaded'
      },

      // 全局事件（跨功能域通信）
      global: {
        // 通知其他功能域排序已改变
        SORT_APPLIED: 'sorter:sort:applied',
        SORT_CLEARED: 'sorter:sort:cleared'
      }
    },

    /**
     * UI 配置
     */
    ui: {
      // 排序面板容器 ID
      containerId: 'pdf-sorter-panel',

      // 显示位置（'toolbar' | 'sidebar' | 'popup'）
      position: 'toolbar',

      // 主题
      theme: 'default'
    }
  }
};

export default PDFSorterFeatureConfig;
