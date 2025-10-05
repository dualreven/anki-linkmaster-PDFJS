/**
 * SearchResultItem Feature 配置
 */

export const SearchResultItemFeatureConfig = {
  name: 'search-result-item',
  version: '1.0.0',
  description: '搜索结果条目 - 渲染单个PDF搜索结果项',

  dependencies: [],

  config: {
    // 事件定义
    events: {
      local: {
        ITEM_CLICKED: 'item:click:completed',
        ITEM_SELECTED: 'item:select:completed'
      },
      global: {
        RESULT_ITEM_CLICKED: 'search:result:item:clicked',
        RESULT_ITEM_SELECTED: 'search:result:item:selected'
      }
    },

    // 条目配置
    item: {
      showThumbnail: false,  // 是否显示缩略图
      showTags: true,        // 是否显示标签
      showMetadata: true     // 是否显示元数据
    }
  }
};

export default SearchResultItemFeatureConfig;
