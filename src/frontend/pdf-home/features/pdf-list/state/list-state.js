/**
 * @file PDF列表状态定义
 * @module PDFListState
 * @description
 * 定义PDF列表功能域的状态结构，使用StateManager进行管理
 */

/**
 * PDF列表状态Schema
 * @typedef {Object} ListState
 * @property {Array<Object>} items - PDF列表项
 * @property {Array<number>} selectedIndices - 选中的行索引
 * @property {boolean} isLoading - 是否正在加载
 * @property {string|null} sortColumn - 当前排序列
 * @property {string} sortDirection - 排序方向 ('asc' | 'desc')
 * @property {Object} filters - 过滤条件
 * @property {Object} columnConfig - 列配置
 * @property {Object} pagination - 分页配置
 */
export const LIST_STATE_SCHEMA = {
  // 数据
  items: [],
  selectedIndices: [],

  // UI状态
  isLoading: false,
  error: null,

  // 排序
  sortColumn: null,
  sortDirection: 'asc',

  // 过滤
  filters: {
    searchText: '',
    tags: [],
    dateRange: null
  },

  // 列配置
  columnConfig: {
    filename: { visible: true, width: 300, frozen: false },
    path: { visible: true, width: 400, frozen: false },
    size: { visible: true, width: 100, frozen: false },
    lastModified: { visible: true, width: 150, frozen: false },
    tags: { visible: true, width: 200, frozen: false },
    rating: { visible: true, width: 100, frozen: false }
  },

  // 分页
  pagination: {
    page: 1,
    pageSize: 50,
    total: 0
  },

  // 视图配置
  viewConfig: {
    density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
    showThumbnails: false,
    showPreview: false
  }
};

/**
 * 创建PDF列表状态
 * @param {StateManager} stateManager - 状态管理器实例
 * @returns {ReactiveState} 响应式状态对象
 */
export function createListState(stateManager) {
  return stateManager.createState('pdf-list', LIST_STATE_SCHEMA);
}

/**
 * 状态操作辅助函数
 */
export class ListStateHelpers {
  /**
   * 添加PDF项到列表
   * @param {ReactiveState} state - 状态对象
   * @param {Object} pdfItem - PDF项数据
   */
  static addItem(state, pdfItem) {
    const items = [...state.items, pdfItem];
    state.items = items;
  }

  /**
   * 从列表移除PDF项
   * @param {ReactiveState} state - 状态对象
   * @param {string} filename - 文件名
   */
  static removeItem(state, filename) {
    const items = state.items.filter(item => item.filename !== filename);
    state.items = items;
  }

  /**
   * 更新PDF项
   * @param {ReactiveState} state - 状态对象
   * @param {string} filename - 文件名
   * @param {Object} updates - 更新数据
   */
  static updateItem(state, filename, updates) {
    const items = state.items.map(item =>
      item.filename === filename ? { ...item, ...updates } : item
    );
    state.items = items;
  }

  /**
   * 设置加载状态
   * @param {ReactiveState} state - 状态对象
   * @param {boolean} isLoading - 是否正在加载
   */
  static setLoading(state, isLoading) {
    state.isLoading = isLoading;
  }

  /**
   * 设置错误
   * @param {ReactiveState} state - 状态对象
   * @param {Error|null} error - 错误对象
   */
  static setError(state, error) {
    state.error = error ? error.message : null;
  }

  /**
   * 设置选中项
   * @param {ReactiveState} state - 状态对象
   * @param {Array<number>} indices - 选中的索引数组
   */
  static setSelectedIndices(state, indices) {
    state.selectedIndices = indices;
  }

  /**
   * 切换排序
   * @param {ReactiveState} state - 状态对象
   * @param {string} column - 列名
   */
  static toggleSort(state, column) {
    if (state.sortColumn === column) {
      // 切换排序方向
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // 切换列
      state.sortColumn = column;
      state.sortDirection = 'asc';
    }
  }

  /**
   * 设置过滤条件
   * @param {ReactiveState} state - 状态对象
   * @param {Object} filters - 过滤条件
   */
  static setFilters(state, filters) {
    state.filters = { ...state.filters, ...filters };
  }

  /**
   * 重置过滤条件
   * @param {ReactiveState} state - 状态对象
   */
  static resetFilters(state) {
    state.filters = LIST_STATE_SCHEMA.filters;
  }

  /**
   * 更新列配置
   * @param {ReactiveState} state - 状态对象
   * @param {string} columnName - 列名
   * @param {Object} config - 列配置
   */
  static updateColumnConfig(state, columnName, config) {
    state.columnConfig = {
      ...state.columnConfig,
      [columnName]: { ...state.columnConfig[columnName], ...config }
    };
  }

  /**
   * 设置分页
   * @param {ReactiveState} state - 状态对象
   * @param {Object} pagination - 分页配置
   */
  static setPagination(state, pagination) {
    state.pagination = { ...state.pagination, ...pagination };
  }
}
