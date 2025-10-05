/**
 * RecentSearches Feature 配置
 */

export const RecentSearchesFeatureConfig = {
  name: 'recent-searches',
  version: '1.0.0',
  description: '最近搜索功能 - 显示和管理最近的搜索关键词',

  dependencies: [],

  config: {
    // 最大存储数量
    maxItems: 50,

    // 默认显示条数
    defaultDisplayLimit: 5,

    // LocalStorage键名
    storageKey: 'pdf-home:recent-searches',

    // 事件定义
    events: {
      local: {
        SEARCH_CLICKED: 'search:clicked',
        LIMIT_CHANGED: 'limit:changed'
      },
      global: {
        SEARCH_REQUESTED: 'search:requested'
      }
    }
  }
};

export default RecentSearchesFeatureConfig;
