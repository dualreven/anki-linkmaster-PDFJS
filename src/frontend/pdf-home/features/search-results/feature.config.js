/**
 * SearchResults Feature 配置
 */

export const SearchResultsFeatureConfig = {
  name: 'search-results',
  version: '1.0.0',
  description: '搜索结果功能 - 显示和管理PDF搜索结果',

  dependencies: [],

  config: {
    // 事件定义
    events: {
      local: {
        ROW_SELECTED: 'row:selected',
        ROW_DBLCLICK: 'row:dblclick'
      },
      global: {
        SEARCH_REQUESTED: 'search:requested',
        SEARCH_RESULTS_UPDATED: 'search:results:updated',
        PDF_OPENED: 'pdf:opened'
      }
    },

    // 表格配置
    table: {
      height: '600px',
      pagination: true,
      paginationSize: 20
    }
  }
};

export default SearchResultsFeatureConfig;
