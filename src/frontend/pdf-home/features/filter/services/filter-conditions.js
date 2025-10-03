/**
 * @file 筛选条件类
 * @description 定义各种筛选条件类，实现IFilterCondition接口
 */

/**
 * 筛选条件基类接口
 * 所有筛选条件必须实现此接口
 */
export class IFilterCondition {
  /**
   * 条件唯一标识
   * @returns {string}
   */
  getConditionId() {
    throw new Error('Must implement getConditionId()');
  }

  /**
   * 条件类型
   * @returns {string} 'field' | 'fuzzy' | 'composite'
   */
  getConditionType() {
    throw new Error('Must implement getConditionType()');
  }

  /**
   * 获取可读描述
   * @returns {string}
   */
  getDescription() {
    throw new Error('Must implement getDescription()');
  }

  /**
   * 执行筛选（返回是否匹配）
   * @param {Object} record - PDF记录
   * @returns {boolean}
   */
  match(record) {
    throw new Error('Must implement match()');
  }

  /**
   * 验证条件合法性
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate() {
    throw new Error('Must implement validate()');
  }

  /**
   * 序列化条件（用于保存和传输）
   * @returns {Object}
   */
  serialize() {
    throw new Error('Must implement serialize()');
  }

  /**
   * 反序列化条件
   * @param {Object} config
   */
  deserialize(config) {
    throw new Error('Must implement deserialize()');
  }

  /**
   * 克隆条件
   * @returns {IFilterCondition}
   */
  clone() {
    throw new Error('Must implement clone()');
  }
}

/**
 * 字段筛选条件
 * 支持按单一字段进行精确筛选
 */
export class FieldCondition extends IFilterCondition {
  constructor(config = {}) {
    super();
    this.field = config.field || null;          // 字段名
    this.operator = config.operator || 'eq';    // 操作符
    this.value = config.value;                  // 筛选值
    this.dataType = config.dataType || 'auto';  // 数据类型
  }

  getConditionId() {
    return `field_${this.field}_${Date.now()}`;
  }

  getConditionType() {
    return 'field';
  }

  getDescription() {
    const operatorLabels = {
      'eq': '等于',
      'ne': '不等于',
      'gt': '大于',
      'lt': '小于',
      'gte': '大于等于',
      'lte': '小于等于',
      'contains': '包含',
      'not_contains': '不包含',
      'starts_with': '开头是',
      'ends_with': '结尾是',
      'in_range': '范围内',
      'has_tag': '标签包含',
      'not_has_tag': '标签不包含'
    };

    const opLabel = operatorLabels[this.operator] || this.operator;
    return `${this.field} ${opLabel} ${this.value}`;
  }

  match(record) {
    try {
      const fieldValue = record[this.field];

      // 处理 null/undefined
      if (fieldValue == null) {
        return this.operator === 'ne' || this.operator === 'not_contains';
      }

      switch (this.operator) {
        case 'eq':
          return fieldValue == this.value;

        case 'ne':
          return fieldValue != this.value;

        case 'gt':
          return Number(fieldValue) > Number(this.value);

        case 'lt':
          return Number(fieldValue) < Number(this.value);

        case 'gte':
          return Number(fieldValue) >= Number(this.value);

        case 'lte':
          return Number(fieldValue) <= Number(this.value);

        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(this.value).toLowerCase());

        case 'not_contains':
          return !String(fieldValue).toLowerCase().includes(String(this.value).toLowerCase());

        case 'starts_with':
          return String(fieldValue).toLowerCase().startsWith(String(this.value).toLowerCase());

        case 'ends_with':
          return String(fieldValue).toLowerCase().endsWith(String(this.value).toLowerCase());

        case 'in_range':
          const [min, max] = this.value;
          const numValue = Number(fieldValue);
          return numValue >= Number(min) && numValue <= Number(max);

        case 'has_tag':
          // fieldValue 应该是数组
          if (!Array.isArray(fieldValue)) return false;
          return fieldValue.some(tag => String(tag).toLowerCase().includes(String(this.value).toLowerCase()));

        case 'not_has_tag':
          if (!Array.isArray(fieldValue)) return true;
          return !fieldValue.some(tag => String(tag).toLowerCase().includes(String(this.value).toLowerCase()));

        default:
          return false;
      }
    } catch (error) {
      console.warn('[FieldCondition] Match error:', error);
      return false;
    }
  }

  validate() {
    const errors = [];

    if (!this.field) {
      errors.push('字段名不能为空');
    }

    if (!this.operator) {
      errors.push('操作符不能为空');
    }

    if (this.value === undefined || this.value === null || this.value === '') {
      if (this.operator !== 'ne' && this.operator !== 'not_contains') {
        errors.push('筛选值不能为空');
      }
    }

    // 范围操作符需要数组
    if (this.operator === 'in_range' && !Array.isArray(this.value)) {
      errors.push('范围筛选需要提供[最小值, 最大值]');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  serialize() {
    return {
      type: 'field',
      field: this.field,
      operator: this.operator,
      value: this.value,
      dataType: this.dataType
    };
  }

  deserialize(config) {
    this.field = config.field;
    this.operator = config.operator;
    this.value = config.value;
    this.dataType = config.dataType || 'auto';
  }

  clone() {
    return new FieldCondition({
      field: this.field,
      operator: this.operator,
      value: this.value,
      dataType: this.dataType
    });
  }
}

/**
 * 模糊搜索条件
 * 在所有可搜索字段中查找关键词
 */
export class FuzzySearchCondition extends IFilterCondition {
  constructor(config = {}) {
    super();
    this.keywords = config.keywords || [];  // 关键词数组
    this.searchFields = config.searchFields || [
      'filename', 'tags', 'notes'
    ];  // 可搜索字段
    this.matchMode = config.matchMode || 'any';  // 'any' 或 'all'
  }

  getConditionId() {
    return `fuzzy_${Date.now()}`;
  }

  getConditionType() {
    return 'fuzzy';
  }

  getDescription() {
    const keywordsStr = this.keywords.join(' ');
    const modeLabel = this.matchMode === 'all' ? '全部匹配' : '任一匹配';
    return `模糊搜索: "${keywordsStr}" (${modeLabel})`;
  }

  match(record) {
    try {
      if (this.keywords.length === 0) return true;

      const results = this.keywords.map(keyword => {
        return this.searchFields.some(field => {
          const value = record[field];
          if (value == null) return false;

          // 处理数组字段（如tags）
          if (Array.isArray(value)) {
            return value.some(item =>
              String(item).toLowerCase().includes(keyword.toLowerCase())
            );
          }

          // 处理普通字段
          return String(value).toLowerCase().includes(keyword.toLowerCase());
        });
      });

      // 根据匹配模式返回结果
      return this.matchMode === 'all'
        ? results.every(r => r)  // 所有关键词都匹配
        : results.some(r => r);  // 任一关键词匹配
    } catch (error) {
      console.warn('[FuzzySearchCondition] Match error:', error);
      return false;
    }
  }

  validate() {
    const errors = [];

    if (this.keywords.length === 0) {
      errors.push('至少需要一个关键词');
    }

    if (this.searchFields.length === 0) {
      errors.push('至少需要指定一个搜索字段');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  serialize() {
    return {
      type: 'fuzzy',
      keywords: [...this.keywords],
      searchFields: [...this.searchFields],
      matchMode: this.matchMode
    };
  }

  deserialize(config) {
    this.keywords = config.keywords || [];
    this.searchFields = config.searchFields || [];
    this.matchMode = config.matchMode || 'any';
  }

  clone() {
    return new FuzzySearchCondition({
      keywords: [...this.keywords],
      searchFields: [...this.searchFields],
      matchMode: this.matchMode
    });
  }

  /**
   * 从搜索文本解析关键词
   * @param {string} searchText
   */
  static parseKeywords(searchText) {
    // 按空格分隔，去除空白
    return searchText
      .split(/\s+/)
      .map(kw => kw.trim())
      .filter(kw => kw.length > 0);
  }
}

/**
 * 组合条件
 * 支持 AND、OR、NOT 逻辑组合
 */
export class CompositeCondition extends IFilterCondition {
  constructor(config = {}) {
    super();
    this.operator = config.operator || 'AND';  // 'AND', 'OR', 'NOT'
    this.conditions = config.conditions || [];  // 子条件数组
  }

  getConditionId() {
    return `composite_${this.operator}_${Date.now()}`;
  }

  getConditionType() {
    return 'composite';
  }

  getDescription() {
    if (this.operator === 'NOT') {
      const subDesc = this.conditions[0]?.getDescription() || '';
      return `非 (${subDesc})`;
    }

    const subDescriptions = this.conditions.map(c => c.getDescription());
    const opLabel = this.operator === 'AND' ? '且' : '或';
    return `(${subDescriptions.join(` ${opLabel} `)})`;
  }

  match(record) {
    try {
      if (this.conditions.length === 0) return true;

      switch (this.operator) {
        case 'AND':
          return this.conditions.every(condition => condition.match(record));

        case 'OR':
          return this.conditions.some(condition => condition.match(record));

        case 'NOT':
          // NOT 只对第一个条件取反
          return !this.conditions[0].match(record);

        default:
          return false;
      }
    } catch (error) {
      console.warn('[CompositeCondition] Match error:', error);
      return false;
    }
  }

  validate() {
    const errors = [];

    if (this.conditions.length === 0) {
      errors.push('组合条件至少需要一个子条件');
    }

    if (this.operator === 'NOT' && this.conditions.length > 1) {
      errors.push('NOT 操作符只能有一个子条件');
    }

    // 验证所有子条件
    this.conditions.forEach((condition, index) => {
      const validation = condition.validate();
      if (!validation.valid) {
        errors.push(`子条件${index + 1}验证失败: ${validation.errors.join(', ')}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  serialize() {
    return {
      type: 'composite',
      operator: this.operator,
      conditions: this.conditions.map(c => c.serialize())
    };
  }

  deserialize(config) {
    this.operator = config.operator;
    // 注意：这里需要FilterConditionFactory来反序列化子条件
    // 在实际使用时由Factory调用
    this.conditions = config.conditions || [];
  }

  clone() {
    return new CompositeCondition({
      operator: this.operator,
      conditions: this.conditions.map(c => c.clone())
    });
  }

  /**
   * 添加子条件
   */
  addCondition(condition) {
    this.conditions.push(condition);
  }

  /**
   * 移除子条件
   */
  removeCondition(index) {
    this.conditions.splice(index, 1);
  }
}
