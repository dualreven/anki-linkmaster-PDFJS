/**
 * 筛选管理器 - 统筹管理筛选逻辑
 */

import { FilterConditionFactory } from './filter-condition-factory.js';

export class FilterManager {
  #logger = null;
  #eventBus = null;
  #currentCondition = null;  // 当前生效的筛选条件
  #filteredData = [];        // 筛选后的数据
  #originalData = [];        // 原始数据
  #filterHistory = [];       // 筛选历史记录（用于撤销）
  #maxHistorySize = 10;

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 设置原始数据源
   * @param {Array} data - 原始数据数组
   */
  setDataSource(data) {
    this.#originalData = data;
    this.#logger.info('[FilterManager] Data source updated', { count: data.length });

    // 如果有当前筛选条件，重新应用
    if (this.#currentCondition) {
      this.applyFilter(this.#currentCondition);
    } else {
      this.#filteredData = [...data];
    }
  }

  /**
   * 获取原始数据源
   * @returns {Array} 原始数据数组
   */
  getDataSource() {
    return this.#originalData;
  }

  /**
   * 应用筛选条件
   * @param {IFilterCondition} condition - 筛选条件
   * @returns {Array} 筛选后的数据
   */
  applyFilter(condition) {
    try {
      // 验证条件
      const validation = condition.validate();
      if (!validation.valid) {
        this.#logger.error('[FilterManager] Invalid condition', validation.errors);
        throw new Error(`筛选条件无效: ${validation.errors.join(', ')}`);
      }

      // 保存历史
      this.#saveToHistory();

      // 执行筛选
      this.#currentCondition = condition;
      this.#filteredData = this.#originalData.filter(record => condition.match(record));

      this.#logger.info('[FilterManager] Filter applied', {
        conditionType: condition.getConditionType(),
        description: condition.getDescription(),
        originalCount: this.#originalData.length,
        filteredCount: this.#filteredData.length
      });

      // 发出筛选完成事件
      this.#eventBus.emit('filter:applied', {
        condition: condition.serialize(),
        resultCount: this.#filteredData.length,
        data: this.#filteredData
      });

      return this.#filteredData;
    } catch (error) {
      this.#logger.error('[FilterManager] Apply filter failed', error);
      throw error;
    }
  }

  /**
   * 快速模糊搜索（便捷方法）
   * @param {string} searchText - 搜索文本
   * @param {Array<string>} searchFields - 搜索字段列表
   * @returns {Array} 筛选后的数据
   */
  quickSearch(searchText, searchFields = ['filename', 'tags', 'notes']) {
    if (!searchText || searchText.trim() === '') {
      return this.clearFilter();
    }

    const condition = FilterConditionFactory.createFuzzySearch(searchText, searchFields);
    return this.applyFilter(condition);
  }

  /**
   * 清除筛选（显示所有数据）
   * @returns {Array} 原始数据
   */
  clearFilter() {
    this.#saveToHistory();
    this.#currentCondition = null;
    this.#filteredData = [...this.#originalData];

    this.#logger.info('[FilterManager] Filter cleared');
    this.#eventBus.emit('filter:cleared', {
      resultCount: this.#filteredData.length,
      data: this.#filteredData
    });

    return this.#filteredData;
  }

  /**
   * 撤销上一次筛选
   * @returns {Array} 恢复后的数据
   */
  undo() {
    if (this.#filterHistory.length === 0) {
      this.#logger.warn('[FilterManager] No history to undo');
      return this.#filteredData;
    }

    const previousState = this.#filterHistory.pop();
    this.#currentCondition = previousState.condition;
    this.#filteredData = previousState.filteredData;

    this.#logger.info('[FilterManager] Filter undone');
    this.#eventBus.emit('filter:undone', {
      resultCount: this.#filteredData.length,
      data: this.#filteredData
    });

    return this.#filteredData;
  }

  /**
   * 获取当前筛选后的数据
   * @returns {Array}
   */
  getFilteredData() {
    return this.#filteredData;
  }

  /**
   * 获取当前筛选条件
   * @returns {IFilterCondition|null}
   */
  getCurrentCondition() {
    return this.#currentCondition;
  }

  /**
   * 获取筛选统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      originalCount: this.#originalData.length,
      filteredCount: this.#filteredData.length,
      filteredOutCount: this.#originalData.length - this.#filteredData.length,
      hasFilter: this.#currentCondition !== null,
      currentCondition: this.#currentCondition ? {
        type: this.#currentCondition.getConditionType(),
        description: this.#currentCondition.getDescription()
      } : null
    };
  }

  /**
   * 从JSON恢复筛选条件
   * @param {string} jsonString - 序列化的条件JSON
   * @returns {Array} 筛选后的数据
   */
  restoreFromJson(jsonString) {
    try {
      const condition = FilterConditionFactory.deserialize(jsonString);
      return this.applyFilter(condition);
    } catch (error) {
      this.#logger.error('[FilterManager] Restore from JSON failed', error);
      throw error;
    }
  }

  /**
   * 导出当前筛选条件为JSON
   * @returns {string|null}
   */
  exportToJson() {
    if (!this.#currentCondition) {
      return null;
    }
    return JSON.stringify(this.#currentCondition.serialize());
  }

  /**
   * 保存当前状态到历史
   * @private
   */
  #saveToHistory() {
    if (this.#currentCondition || this.#filteredData.length !== this.#originalData.length) {
      this.#filterHistory.push({
        condition: this.#currentCondition,
        filteredData: [...this.#filteredData]
      });

      // 限制历史记录大小
      if (this.#filterHistory.length > this.#maxHistorySize) {
        this.#filterHistory.shift();
      }
    }
  }

  /**
   * 重置管理器
   */
  reset() {
    this.#currentCondition = null;
    this.#filteredData = [];
    this.#originalData = [];
    this.#filterHistory = [];
    this.#logger.info('[FilterManager] Manager reset');
  }
}
