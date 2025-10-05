/**
 * RecentAdded Feature 配置
 */

export const RecentAddedFeatureConfig = {
  name: 'recent-added',
  version: '1.0.0',
  description: '最近添加功能 - 显示和管理最近添加的PDF',

  dependencies: [],

  config: {
    // 最大存储数量
    maxItems: 50,

    // 默认显示条数
    defaultDisplayLimit: 5,

    // LocalStorage键名
    storageKey: 'pdf-home:recent-added',

    // 事件定义
    events: {
      local: {
        PDF_CLICKED: 'pdf:clicked',
        LIMIT_CHANGED: 'limit:changed'
      },
      global: {
        PDF_ADDED: 'pdf:added'
      }
    }
  }
};

export default RecentAddedFeatureConfig;
