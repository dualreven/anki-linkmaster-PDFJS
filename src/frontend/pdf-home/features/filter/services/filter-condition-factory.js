/**
 * 筛选条件工厂 - 负责创建和反序列化筛选条件
 */

import { FieldCondition, FuzzySearchCondition, CompositeCondition } from './filter-conditions.js';

export class FilterConditionFactory {
  /**
   * 从配置创建筛选条件
   * @param {Object} config - 条件配置对象
   * @returns {IFilterCondition} 筛选条件实例
   */
  static createCondition(config) {
    if (!config || !config.type) {
      throw new Error('Invalid condition config: missing type');
    }

    switch (config.type) {
      case 'field':
        return new FieldCondition(config);

      case 'fuzzy':
        return new FuzzySearchCondition(config);

      case 'composite':
        // 递归创建子条件
        const childConditions = (config.conditions || []).map(childConfig =>
          FilterConditionFactory.createCondition(childConfig)
        );
        return new CompositeCondition({
          operator: config.operator,
          conditions: childConditions
        });

      default:
        throw new Error(`Unknown condition type: ${config.type}`);
    }
  }

  /**
   * 从JSON字符串反序列化条件
   * @param {string} jsonString - JSON字符串
   * @returns {IFilterCondition} 筛选条件实例
   */
  static deserialize(jsonString) {
    try {
      const config = JSON.parse(jsonString);
      return FilterConditionFactory.createCondition(config);
    } catch (error) {
      throw new Error(`Failed to deserialize condition: ${error.message}`);
    }
  }

  /**
   * 从搜索文本快速创建模糊搜索条件
   * @param {string} searchText - 搜索文本
   * @param {Array<string>} searchFields - 要搜索的字段列表
   * @returns {FuzzySearchCondition} 模糊搜索条件
   */
  static createFuzzySearch(searchText, searchFields = ['filename', 'tags', 'notes']) {
    const keywords = FuzzySearchCondition.parseKeywords(searchText);
    return new FuzzySearchCondition({
      keywords,
      searchFields,
      matchMode: 'any'
    });
  }

  /**
   * 创建字段等于条件的快捷方法
   * @param {string} field - 字段名
   * @param {*} value - 字段值
   * @returns {FieldCondition} 字段条件
   */
  static createFieldEquals(field, value) {
    return new FieldCondition({
      field,
      operator: 'eq',
      value
    });
  }

  /**
   * 创建字段包含条件的快捷方法
   * @param {string} field - 字段名
   * @param {*} value - 包含的值
   * @returns {FieldCondition} 字段条件
   */
  static createFieldContains(field, value) {
    return new FieldCondition({
      field,
      operator: 'contains',
      value
    });
  }

  /**
   * 创建AND组合条件
   * @param {Array<IFilterCondition>} conditions - 子条件数组
   * @returns {CompositeCondition} 组合条件
   */
  static createAnd(...conditions) {
    return new CompositeCondition({
      operator: 'AND',
      conditions
    });
  }

  /**
   * 创建OR组合条件
   * @param {Array<IFilterCondition>} conditions - 子条件数组
   * @returns {CompositeCondition} 组合条件
   */
  static createOr(...conditions) {
    return new CompositeCondition({
      operator: 'OR',
      conditions
    });
  }

  /**
   * 创建NOT条件
   * @param {IFilterCondition} condition - 要取反的条件
   * @returns {CompositeCondition} 组合条件
   */
  static createNot(condition) {
    return new CompositeCondition({
      operator: 'NOT',
      conditions: [condition]
    });
  }
}
