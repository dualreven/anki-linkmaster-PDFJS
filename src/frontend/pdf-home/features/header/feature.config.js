/**
 * Header Feature 配置
 */

export const HeaderFeatureConfig = {
  name: 'header',
  version: '1.0.0',
  description: 'Header UI管理 - 应用标题和操作按钮',

  dependencies: [],

  config: {
    // Header标题
    title: 'PDF文件管理-B',

    // 按钮配置
    buttons: [
      {
        id: 'add-pdf-btn',
        label: '＋添加',
        class: 'btn primary',
        title: '添加PDF文件',
        eventName: 'header:add:clicked',
        group: 'file-operations'
      },
      {
        id: 'batch-delete-btn',
        label: '－删除',
        class: 'btn danger',
        title: '删除选中的PDF文件',
        eventName: 'header:delete:clicked',
        group: 'file-operations'
      },
      {
        id: 'edit-pdf-btn',
        label: '✏️ 编辑',
        class: 'btn',
        title: '选择一条记录后可编辑',
        eventName: 'header:edit:clicked',
        group: 'record-operations'
      },
      {
        id: 'sort-btn',
        label: '🔃 排序',
        class: 'btn',
        title: '排序PDF列表',
        eventName: 'header:sort:clicked',
        group: 'record-operations'
      },
      {
        id: 'preset-filter-btn',
        label: '🔖 预设',
        class: 'btn',
        title: '保存和加载搜索预设',
        eventName: 'header:preset:clicked',
        group: 'record-operations'
      },
      {
        id: 'review-btn',
        label: '📚 复习',
        class: 'btn',
        title: '复习PDF文件',
        eventName: 'header:review:clicked',
        group: 'record-operations'
      },
      {
        id: 'open-pdf-btn',
        label: '📖 阅读',
        class: 'btn',
        title: '打开选中的PDF文件',
        eventName: 'header:read:clicked',
        group: 'record-operations'
      }
    ],

    // 事件定义
    events: {
      local: {
        // 按钮点击事件（内部）
      },
      global: {
        // 全局事件（发送给其他插件）
        ADD_CLICKED: 'header:add:clicked',
        DELETE_CLICKED: 'header:delete:clicked',
        EDIT_CLICKED: 'header:edit:clicked',
        SORT_CLICKED: 'header:sort:clicked',
        PRESET_CLICKED: 'header:preset:clicked',
        REVIEW_CLICKED: 'header:review:clicked',
        READ_CLICKED: 'header:read:clicked'
      }
    }
  }
};

export default HeaderFeatureConfig;
