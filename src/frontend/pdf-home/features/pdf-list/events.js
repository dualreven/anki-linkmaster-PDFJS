/**
 * @file PDF列表事件定义
 * @module PDFListEvents
 * @description
 * PDF列表功能域的事件常量定义
 * 使用ScopedEventBus时会自动添加@pdf-list/前缀
 */

/**
 * PDF列表事件常量
 * @constant
 */
export const PDF_LIST_EVENTS = {
  // 数据加载事件
  DATA_LOAD_REQUESTED: 'data:load:requested',
  DATA_LOAD_STARTED: 'data:load:started',
  DATA_LOAD_COMPLETED: 'data:load:completed',
  DATA_LOAD_FAILED: 'data:load:failed',

  // 数据变更事件
  DATA_CHANGED: 'data:changed',
  DATA_UPDATED: 'data:updated',
  DATA_CLEARED: 'data:cleared',

  // PDF操作事件
  PDF_ADD_REQUESTED: 'pdf:add:requested',
  PDF_ADD_COMPLETED: 'pdf:add:completed',
  PDF_ADD_FAILED: 'pdf:add:failed',

  PDF_REMOVE_REQUESTED: 'pdf:remove:requested',
  PDF_REMOVE_COMPLETED: 'pdf:remove:completed',
  PDF_REMOVE_FAILED: 'pdf:remove:failed',

  PDF_UPDATE_REQUESTED: 'pdf:update:requested',
  PDF_UPDATE_COMPLETED: 'pdf:update:completed',
  PDF_UPDATE_FAILED: 'pdf:update:failed',

  // 选择事件
  ROW_SELECTED: 'row:selected',
  ROW_DESELECTED: 'row:deselected',
  SELECTION_CHANGED: 'selection:changed',
  SELECTION_CLEARED: 'selection:cleared',

  // 交互事件
  ROW_CLICKED: 'row:clicked',
  ROW_DOUBLE_CLICKED: 'row:double-clicked',
  ROW_CONTEXT_MENU: 'row:context-menu',

  // 排序/筛选事件
  SORT_CHANGED: 'sort:changed',
  FILTER_CHANGED: 'filter:changed',
  FILTER_CLEARED: 'filter:cleared',

  // 视图事件
  VIEW_CONFIG_CHANGED: 'view:config:changed',
  COLUMN_CONFIG_CHANGED: 'column:config:changed',
  PAGINATION_CHANGED: 'pagination:changed',

  // 生命周期事件
  TABLE_INITIALIZED: 'table:initialized',
  TABLE_READY: 'table:ready',
  TABLE_DESTROYED: 'table:destroyed',
  TABLE_REFRESH_REQUESTED: 'table:refresh:requested',
  TABLE_REFRESHED: 'table:refreshed',

  // 错误事件
  ERROR_OCCURRED: 'error:occurred',
};

/**
 * 创建事件数据的辅助函数
 */
export class EventDataFactory {
  /**
   * 创建数据加载事件数据
   * @param {Array} items - PDF项数组
   * @param {number} total - 总数
   * @returns {Object}
   */
  static createDataLoadedData(items, total) {
    return {
      items,
      total,
      timestamp: Date.now()
    };
  }

  /**
   * 创建选择变更事件数据
   * @param {Array<number>} selectedIndices - 选中的索引
   * @param {Array<Object>} selectedItems - 选中的项
   * @returns {Object}
   */
  static createSelectionChangedData(selectedIndices, selectedItems) {
    return {
      selectedIndices,
      selectedItems,
      count: selectedIndices.length,
      timestamp: Date.now()
    };
  }

  /**
   * 创建行点击事件数据
   * @param {number} index - 行索引
   * @param {Object} row - 行数据
   * @param {Event} nativeEvent - 原生事件
   * @returns {Object}
   */
  static createRowClickedData(index, row, nativeEvent) {
    return {
      index,
      row,
      nativeEvent: {
        type: nativeEvent.type,
        button: nativeEvent.button,
        ctrlKey: nativeEvent.ctrlKey,
        shiftKey: nativeEvent.shiftKey,
        altKey: nativeEvent.altKey
      },
      timestamp: Date.now()
    };
  }

  /**
   * 创建错误事件数据
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   * @returns {Object}
   */
  static createErrorData(error, context) {
    return {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * 创建排序变更事件数据
   * @param {string} column - 排序列
   * @param {string} direction - 排序方向
   * @returns {Object}
   */
  static createSortChangedData(column, direction) {
    return {
      column,
      direction,
      timestamp: Date.now()
    };
  }

  /**
   * 创建过滤变更事件数据
   * @param {Object} filters - 过滤条件
   * @returns {Object}
   */
  static createFilterChangedData(filters) {
    return {
      filters,
      timestamp: Date.now()
    };
  }
}
