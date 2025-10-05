/**
 * SavedFilters Feature 配置
 * 已存搜索条件功能
 */

export const SavedFiltersFeatureConfig = {
  name: 'saved-filters',
  version: '1.0.0',
  description: '已存搜索条件功能 - 显示和管理保存的搜索条件',
  dependencies: [],

  config: {
    // 最大保存数量
    maxItems: 20,

    // 默认显示数量
    defaultDisplayLimit: 5,

    // LocalStorage 存储键
    storageKey: 'pdf-home:saved-filters',

    // 事件定义
    events: {
      // 局部事件（仅在saved-filters内部）
      local: {
        FILTER_CLICKED: 'filter:clicked',
        FILTER_DELETED: 'filter:deleted',
        FILTER_SAVED: 'filter:saved'
      },

      // 全局事件（跨Feature通信）
      global: {
        FILTER_APPLIED: 'filter:applied:requested',
        FILTER_SAVED: 'filter:save:completed'
      }
    }
  }
};
