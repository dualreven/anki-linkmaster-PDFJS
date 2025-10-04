/**
 * Sidebar Feature 配置（容器插件）
 */

export const SidebarFeatureConfig = {
  name: 'sidebar',
  version: '2.0.0',
  description: '侧边栏容器 - 管理三个子功能：最近搜索、最近阅读、最近添加',

  dependencies: [],

  config: {
    // 子功能
    subFeatures: [
      'recent-searches',
      'recent-opened',
      'recent-added'
    ],

    // 事件定义
    events: {
      local: {
        TOGGLE_COMPLETED: 'sidebar:toggle:completed'
      },
      global: {
        // 容器不直接处理全局事件，由子功能处理
      }
    },

    // LocalStorage键名
    storageKeys: {
      collapsed: 'pdf-home:sidebar-collapsed'
    }
  }
};

export default SidebarFeatureConfig;
