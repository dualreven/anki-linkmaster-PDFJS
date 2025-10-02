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
        { field: 'id', title: 'ID', visible: false },
        { field: 'filename', title: '文件名', width: 300, frozen: true },
        { field: 'path', title: '路径', width: 400 },
        { field: 'size', title: '大小', width: 100, formatter: 'fileSize' },
        { field: 'modified_time', title: '修改时间', width: 180, formatter: 'datetime' },
        { field: 'page_count', title: '页数', width: 80 },
        { field: 'star', title: '星标', width: 100, formatter: 'star' },
        { field: 'tags', title: '标签', width: 200, formatter: 'tags' },
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
