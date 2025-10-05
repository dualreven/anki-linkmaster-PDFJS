/**
 * @file 排序管理器服务
 * @module features/pdf-sorter/services/sort-manager
 * @description
 * 负责排序逻辑的核心管理，包括多级排序、加权排序的计算和执行
 */

/**
 * 排序管理器
 * @class SortManager
 */
export class SortManager {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 全局事件总线
   * @type {EventBus}
   * @private
   */
  #globalEventBus = null;

  /**
   * 当前排序模式
   * @type {number}
   * @private
   */
  #currentMode = 2; // 默认多级排序

  /**
   * 多级排序配置
   * @type {Array<{field: string, direction: 'asc'|'desc'}>}
   * @private
   */
  #multiSortConfigs = [];

  /**
   * 加权排序公式
   * @type {string}
   * @private
   */
  #weightedFormula = '';

  /**
   * 数据源引用
   * @type {Array|null}
   * @private
   */
  #dataSource = null;

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {EventBus} globalEventBus - 全局事件总线
   */
  constructor(logger, globalEventBus) {
    this.#logger = logger;
    this.#globalEventBus = globalEventBus;
  }

  /**
   * 设置数据源
   * @param {Array} data - 数据数组
   * @public
   */
  setDataSource(data) {
    this.#dataSource = data;
    this.#logger.info('[SortManager] Data source set', { count: data?.length });
  }

  /**
   * 设置排序模式
   * @param {number} mode - 排序模式
   * @public
   */
  setMode(mode) {
    this.#currentMode = mode;
    this.#logger.info(`[SortManager] Mode set to: ${mode}`);
  }

  /**
   * 执行多级排序
   * @param {Array<{field: string, direction: 'asc'|'desc'}>} configs - 排序配置
   * @returns {Array} 排序后的数据
   * @public
   */
  applyMultiSort(configs) {
    if (!this.#dataSource) {
      this.#logger.warn('[SortManager] No data source available');
      return [];
    }

    if (!configs || configs.length === 0) {
      this.#logger.warn('[SortManager] No sort configs provided');
      return [...this.#dataSource];
    }

    this.#multiSortConfigs = configs;
    this.#logger.info('[SortManager] Applying multi-sort', configs);

    // 创建数据副本进行排序
    const sortedData = [...this.#dataSource].sort((a, b) => {
      // 按配置顺序逐级比较
      for (const config of configs) {
        const { field, direction } = config;
        const aValue = this.#getFieldValue(a, field);
        const bValue = this.#getFieldValue(b, field);

        const compareResult = this.#compareValues(aValue, bValue, direction);
        if (compareResult !== 0) {
          return compareResult;
        }
      }
      return 0;
    });

    this.#logger.info('[SortManager] Multi-sort applied', { resultCount: sortedData.length });

    // 触发全局事件通知其他Feature
    this.#globalEventBus.emit('@pdf-sorter/sort:applied', {
      mode: 'multi',
      configs,
      resultCount: sortedData.length
    });

    return sortedData;
  }

  /**
   * 执行加权排序
   * @param {string} formula - 权重计算公式
   * @returns {Array} 排序后的数据
   * @public
   */
  applyWeightedSort(formula) {
    if (!this.#dataSource) {
      this.#logger.warn('[SortManager] No data source available');
      return [];
    }

    if (!formula || !formula.trim()) {
      this.#logger.warn('[SortManager] No formula provided');
      return [...this.#dataSource];
    }

    this.#weightedFormula = formula;
    this.#logger.info('[SortManager] Applying weighted sort', { formula });

    try {
      // 为每条数据计算权重分数
      const dataWithWeights = this.#dataSource.map(item => {
        const weight = this.#calculateWeight(item, formula);
        return { ...item, __weight__: weight };
      });

      // 按权重降序排序
      const sortedData = dataWithWeights.sort((a, b) => b.__weight__ - a.__weight__);

      // 移除临时权重字段
      sortedData.forEach(item => delete item.__weight__);

      this.#logger.info('[SortManager] Weighted sort applied', { resultCount: sortedData.length });

      // 触发全局事件通知其他Feature
      this.#globalEventBus.emit('@pdf-sorter/sort:applied', {
        mode: 'weighted',
        formula,
        resultCount: sortedData.length
      });

      return sortedData;
    } catch (error) {
      this.#logger.error('[SortManager] Weighted sort failed', error);
      throw error;
    }
  }

  /**
   * 清除排序
   * @returns {Array} 原始数据
   * @public
   */
  clearSort() {
    this.#logger.info('[SortManager] Clearing sort');

    this.#multiSortConfigs = [];
    this.#weightedFormula = '';

    // 触发全局事件
    this.#globalEventBus.emit('@pdf-sorter/sort:cleared', {});

    return this.#dataSource ? [...this.#dataSource] : [];
  }

  /**
   * 获取字段值
   * @param {Object} item - 数据项
   * @param {string} field - 字段名
   * @returns {any} 字段值
   * @private
   */
  #getFieldValue(item, field) {
    // 支持嵌套字段访问，例如: "metadata.title"
    const keys = field.split('.');
    let value = item;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[key];
    }

    return value;
  }

  /**
   * 比较两个值
   * @param {any} a - 值A
   * @param {any} b - 值B
   * @param {'asc'|'desc'} direction - 排序方向
   * @returns {number} 比较结果 (-1, 0, 1)
   * @private
   */
  #compareValues(a, b, direction) {
    // 处理null/undefined
    if (a === null || a === undefined) return direction === 'asc' ? 1 : -1;
    if (b === null || b === undefined) return direction === 'asc' ? -1 : 1;

    let compareResult = 0;

    // 数字比较
    if (typeof a === 'number' && typeof b === 'number') {
      compareResult = a - b;
    }
    // 字符串比较
    else if (typeof a === 'string' && typeof b === 'string') {
      compareResult = a.localeCompare(b, 'zh-CN');
    }
    // 日期比较
    else if (a instanceof Date && b instanceof Date) {
      compareResult = a.getTime() - b.getTime();
    }
    // 尝试转为字符串比较
    else {
      compareResult = String(a).localeCompare(String(b), 'zh-CN');
    }

    // 应用排序方向
    return direction === 'asc' ? compareResult : -compareResult;
  }

  /**
   * 计算权重分数
   * @param {Object} item - 数据项
   * @param {string} formula - 权重公式
   * @returns {number} 权重分数
   * @private
   */
  #calculateWeight(item, formula) {
    try {
      // 创建一个安全的计算环境
      const context = this.#createFormulaContext(item);

      // 使用Function构造器安全执行公式
      // 注意：这里需要防止恶意代码注入
      const func = new Function(...Object.keys(context), `return ${formula}`);
      const result = func(...Object.values(context));

      if (typeof result !== 'number' || isNaN(result)) {
        this.#logger.warn('[SortManager] Formula returned non-number', { result });
        return 0;
      }

      return result;
    } catch (error) {
      this.#logger.error('[SortManager] Failed to calculate weight', error);
      return 0;
    }
  }

  /**
   * 创建公式计算上下文
   * @param {Object} item - 数据项
   * @returns {Object} 上下文对象
   * @private
   */
  #createFormulaContext(item) {
    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const lengthFn = (value) => {
      if (Array.isArray(value)) {
        return value.length;
      }
      if (value === null || value === undefined) {
        return 0;
      }
      return String(value).length;
    };

    const clampFn = (value, min, max) => {
      const v = toNumber(value);
      const lower = toNumber(min);
      const upper = toNumber(max);
      const minVal = Math.min(lower, upper);
      const maxVal = Math.max(lower, upper);
      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
        return v;
      }
      return Math.min(Math.max(v, minVal), maxVal);
    };

    const normalizeFn = (value, min, max) => {
      const v = toNumber(value);
      const minVal = toNumber(min);
      const maxVal = toNumber(max);
      if (maxVal === minVal) {
        return 0;
      }
      return (v - minVal) / (maxVal - minVal);
    };

    const tagsValue = Array.isArray(item.tags)
      ? item.tags
      : typeof item.tags === 'string' && item.tags.length > 0
        ? item.tags.split(/[,;\s]+/).filter(Boolean)
        : [];

    const context = {
      // 基础字段
      filename: item.filename || '',
      title: item.title || '',
      author: item.author || '',
      subject: item.subject || '',
      keywords: Array.isArray(item.keywords) ? item.keywords.join(',') : (item.keywords || ''),
      notes: item.notes || '',
      tags: Array.isArray(item.tags) ? item.tags : (item.tags || []),
      tags_count: tagsValue.length,
      size: item.size || 0,
      rating: (item.rating ?? item.star ?? 0),
      review_count: item.review_count || 0,
      total_reading_time: item.total_reading_time || 0,
      modified_time: item.modified_time || 0,
      created_time: item.created_time || 0,
      last_accessed_at: item.last_accessed_at || 0,
      due_date: item.due_date || 0,
      page_count: item.page_count || 0,
      star: item.star || 0,

      // 数学函数
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      max: Math.max,
      min: Math.min,
      sqrt: Math.sqrt,
      pow: Math.pow,
      length: lengthFn,
      asc: (value) => toNumber(value),
      desc: (value) => -toNumber(value),
      clamp: clampFn,
      normalize: normalizeFn
    };

    return context;
  }

  /**
   * 获取当前排序配置
   * @returns {Object} 排序配置信息
   * @public
   */
  getCurrentSortConfig() {
    return {
      mode: this.#currentMode,
      multiSortConfigs: [...this.#multiSortConfigs],
      weightedFormula: this.#weightedFormula
    };
  }

  /**
   * 测试公式
   * @param {string} formula - 要测试的公式
   * @param {number} sampleSize - 样本数量
   * @returns {Array} 测试结果
   * @public
   */
  testFormula(formula, sampleSize = 5) {
    if (!this.#dataSource || this.#dataSource.length === 0) {
      return [];
    }

    const samples = this.#dataSource.slice(0, Math.min(sampleSize, this.#dataSource.length));

    return samples.map(item => {
      try {
        const weight = this.#calculateWeight(item, formula);
        return {
          item: item.filename || 'Unknown',
          weight,
          success: true
        };
      } catch (error) {
        return {
          item: item.filename || 'Unknown',
          weight: null,
          success: false,
          error: error.message
        };
      }
    });
  }
}
