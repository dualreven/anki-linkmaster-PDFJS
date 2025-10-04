/**
 * RecentOpened Feature 配置
 */

export const RecentOpenedFeatureConfig = {
  name: 'recent-opened',
  version: '1.0.0',
  description: '最近阅读功能 - 显示和管理最近阅读的PDF',

  dependencies: [],

  config: {
    // 最大存储数量
    maxItems: 50,

    // 默认显示条数
    defaultDisplayLimit: 5,

    // LocalStorage键名
    storageKey: 'pdf-home:recent-opened',

    // 事件定义
    events: {
      local: {
        PDF_CLICKED: 'pdf:clicked',
        LIMIT_CHANGED: 'limit:changed'
      },
      global: {
        PDF_OPENED: 'pdf:opened'
      }
    }
  }
};

export default RecentOpenedFeatureConfig;
