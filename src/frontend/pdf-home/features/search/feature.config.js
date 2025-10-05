/**
 * Search Feature 配置
 * 搜索功能插件 - 面向用户的搜索起点
 */

export default {
  name: 'search',
  displayName: '搜索功能',
  version: '1.0.0',
  description: '提供PDF搜索框UI和搜索逻辑，是用户搜索的起点',

  // 功能依赖（通过EventBus通信，不需要直接依赖）
  dependencies: [],

  // 事件定义
  events: {
    // 发出的事件
    emits: [
      'search:query:requested',     // 请求搜索（携带搜索关键词）
      'search:clear:requested',     // 请求清除搜索
      'search:add:clicked',         // 点击添加按钮
      'search:sort:clicked'         // 点击排序按钮
    ],
    // 监听的事件
    listens: [
      'search:results:updated'      // 搜索结果更新（用于更新统计信息）
    ]
  },

  // 组件列表
  components: [
    'SearchBar'                     // 搜索框UI组件
  ],

  // 配置选项
  config: {
    // 实时搜索防抖延迟（毫秒）
    debounceDelay: 300,
    // 是否启用实时搜索
    enableLiveSearch: true,
    // 搜索框占位符文本
    placeholder: '输入关键词搜索PDF（文件名、标签、备注）...'
  }
};
