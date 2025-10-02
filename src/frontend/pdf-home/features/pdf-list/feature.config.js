/**
 * @file PDF List 功能域配置
 * @module features/pdf-list/config
 */

export const PDFListFeatureConfig = {
  /**
   * 功能名称（唯一标识）
   */
  name: 'pdf-list',

  /**
   * 功能版本（遵循 SemVer 规范）
   */
  version: '2.0.0',

  /**
   * 功能依赖
   * - 依赖核心服务（logger, eventBus, wsClient）
   */
  dependencies: [],

  /**
   * 功能描述
   */
  description: 'PDF 列表管理功能域 - 提供 PDF 记录的列表展示、增删改查、搜索过滤等功能',

  /**
   * 功能作者
   */
  author: 'PDF-Home Team',

  /**
   * 功能配置
   */
  config: {
    /**
     * 表格配置
     */
    table: {
      // 每页显示数量
      pageSize: 20,

      // 是否启用虚拟滚动
      virtualScroll: true,

      // 是否启用分页
      pagination: true,

      // 列配置
      columns: [
        { formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerSort: false, width: 60, frozen: false, cssClass: "row-selection-cell" },
        { field: 'id', title: 'ID', visible: false },
        { field: 'title', title: '标题', width: 300, frozen: true },
        { field: 'author', title: '作者', width: 150 },
        { field: 'subject', title: '主题', width: 200 },
        { field: 'keywords', title: '关键词', width: 200 },
        {
          field: 'file_size',
          title: '大小',
          width: 100,
          formatter: function(cell) {
            const bytes = cell.getValue();
            if (!bytes) return '';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
          }
        },
        { field: 'page_count', title: '页数', width: 80 },
        { field: 'created_time', title: '创建时间', width: 180 },
        { field: 'modified_time', title: '修改时间', width: 180 },
        {
          field: 'last_accessed_at',
          title: '最后访问',
          width: 180,
          formatter: function(cell) {
            const timestamp = cell.getValue();
            if (!timestamp) return '';
            const date = new Date(timestamp * 1000);
            return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          }
        },
        { field: 'rating', title: '评分', width: 80 },
        { field: 'review_count', title: '复习次数', width: 100 },
        {
          field: 'total_reading_time',
          title: '阅读时长',
          width: 120,
          formatter: function(cell) {
            const seconds = cell.getValue();
            if (!seconds) return '0小时';
            return (seconds / 3600).toFixed(2) + '小时';
          }
        },
        {
          field: 'due_date',
          title: '到期日期',
          width: 180,
          formatter: function(cell) {
            const timestamp = cell.getValue();
            if (!timestamp) return '';
            const date = new Date(timestamp * 1000);
            return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          }
        },
        {
          field: 'tags',
          title: '标签',
          width: 250,
          formatter: function(cell) {
            const tags = cell.getValue();
            console.log('[DEBUG] Tags formatter called, value:', tags, 'type:', typeof tags, 'isArray:', Array.isArray(tags));

            if (!tags) {
              console.log('[DEBUG] Tags is null/undefined');
              return '';
            }

            if (!Array.isArray(tags)) {
              console.log('[DEBUG] Tags is not array, returning as string:', tags);
              return String(tags);
            }

            if (tags.length === 0) {
              console.log('[DEBUG] Tags array is empty');
              return '';
            }

            const html = tags.map(tag =>
              `<span style="display:inline-block;padding:2px 8px;margin:2px;background:#e3f2fd;color:#1976d2;border-radius:12px;font-size:12px;white-space:nowrap;">${tag}</span>`
            ).join('');
            console.log('[DEBUG] Generated HTML:', html);
            return html;
          },
          cssClass: 'tags-cell'
        },
        { field: 'notes', title: '备注', width: 300 }
      ]
    },

    /**
     * 事件配置
     */
    events: {
      // 事件命名空间（由 ScopedEventBus 自动添加）
      namespace: '@pdf-list/',

      // 本地事件（功能域内部事件）
      local: {
        // 表格行选中事件
        ROW_SELECTED: 'table:row:selected',
        // 表格行双击事件
        ROW_DOUBLE_CLICK: 'table:row:double-click',
        // 数据加载中事件
        DATA_LOADING: 'data:loading',
        // 数据加载完成事件
        DATA_LOADED: 'data:loaded'
      },

      // 全局事件（跨功能域通信）
      global: {
        // PDF 列表更新事件（通知其他功能域）
        LIST_UPDATED: 'pdf:list:updated',
        // PDF 打开请求事件
        OPEN_REQUESTED: 'pdf:open:requested',
        // PDF 删除请求事件
        DELETE_REQUESTED: 'pdf:delete:requested'
      }
    },

    /**
     * UI 配置
     */
    ui: {
      // 根容器选择器
      rootSelector: '#pdf-list-container',

      // 主题
      theme: 'default',

      // 是否显示工具栏
      showToolbar: true,

      // 是否显示搜索框
      showSearch: true
    }
  }
};

export default PDFListFeatureConfig;
