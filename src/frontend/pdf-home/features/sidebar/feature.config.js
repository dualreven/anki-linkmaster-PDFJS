/**
 * Sidebar Feature 配置
 */

export const SidebarFeatureConfig = {
  name: 'sidebar',
  version: '1.0.0',
  dependencies: [],

  config: {
    // 最近项目的最大数量
    maxRecentItems: {
      searches: 5,
      opened: 5,
      added: 5
    },

    // LocalStorage键名
    storageKeys: {
      searches: 'pdf-home:recent-searches',
      opened: 'pdf-home:recent-opened',
      added: 'pdf-home:recent-added'
    },

    // 事件名称
    events: {
      local: {
        // 内部事件（带@sidebar/前缀）
        SEARCH_CLICKED: 'search:clicked',
        PDF_CLICKED: 'pdf:clicked'
      },
      global: {
        // 监听的全局事件
        SEARCH_REQUESTED: '@filter/filter:search:requested',
        PDF_OPENED: '@pdf-list/pdf:open:requested',
        PDF_ADDED: '@pdf-list/data:change:completed'
      }
    }
  }
};
