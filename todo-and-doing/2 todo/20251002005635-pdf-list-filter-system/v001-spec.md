# PDF列表筛选系统规格说明

**功能ID**: 20251002005635-pdf-list-filter-system
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 00:56:35
**预计完成**: 2025-10-06
**状态**: 设计中

## 现状说明

### 当前搜索能力
- PDF-Home 模块使用 Tabulator 表格展示记录
- Tabulator 提供基础的列头筛选功能（点击列头图标）
- 缺少统一的全局筛选入口
- 不支持复杂的组合条件
- 不支持跨字段的模糊搜索

### 用户需求场景
- **场景1**: 快速查找 - "我想找包含'Python'关键词的PDF"
- **场景2**: 精确筛选 - "我想找评分≥4星且复习次数>10的PDF"
- **场景3**: 复杂组合 - "我想找(标签包含'教程' 或 文件名包含'tutorial') 且 创建时间在最近7天内的PDF"
- **场景4**: 模糊搜索 - "我记得有个关于'机器学习'的PDF，但不记得具体字段"

## 存在问题

### 功能局限性
- **缺少全局搜索**: 没有统一的搜索框，用户找不到筛选入口
- **不支持逻辑组合**: 无法实现"既满足A条件又满足B条件"的筛选
- **不支持跨字段搜索**: 无法同时在多个字段中查找关键词
- **不支持高级操作符**: 无法使用 >, <, ≥, ≤, !=, 包含, 不包含等操作
- **缺少筛选历史**: 无法保存常用的筛选条件

### 用户体验问题
- 筛选操作复杂，需要逐列设置
- 无法快速清除所有筛选条件
- 不知道当前应用了哪些筛选条件
- 大数据量时筛选性能可能较差

### 扩展性问题
- 筛选逻辑与UI组件耦合
- 难以支持自定义筛选规则
- 无法支持后端筛选（服务端分页）

## 提出需求

### 核心功能（v001 基础版）

#### 1. 全局筛选搜索框
- **位置**: PDF列表顶部工具栏
- **功能**: 支持快速搜索和高级筛选
- **模式切换**:
  - 简单模式：单一搜索框，模糊搜索
  - 高级模式：条件构建器，支持复杂逻辑

#### 2. 模糊搜索（全字段）
- 在所有可搜索字段中查找关键词
- 支持多关键词（空格分隔）
- 高亮匹配结果
- 实时搜索（输入时延迟300ms触发）

#### 3. 精确筛选（单字段）
- 按指定字段筛选
- 支持不同数据类型的操作符：
  - **字符串**: 等于、包含、不包含、开头是、结尾是
  - **数字**: 等于、不等于、大于、小于、大于等于、小于等于、范围
  - **日期**: 等于、之前、之后、范围、相对时间（今天、昨天、最近7天）
  - **标签**: 包含任一、包含全部、不包含
  - **评分**: 等于、大于等于、小于等于

#### 4. 逻辑组合筛选
- 支持 AND（与）、OR（或）、NOT（非）逻辑
- 支持条件分组（括号）
- 可视化条件构建器
- 条件优先级明确

#### 5. 筛选状态管理
- 显示当前活跃的筛选条件
- 支持快速清除单个条件
- 支持一键清除所有条件
- 显示筛选结果数量

### 未来扩展预留（v002+）
- 筛选模板保存和加载
- 正则表达式支持
- 自定义筛选函数
- 后端筛选支持（服务端分页）
- 筛选结果导出
- 智能筛选建议（基于历史）

## 解决方案

### 技术架构设计

#### 1. 分层架构
```
┌─────────────────────────────────────────────────┐
│  UI Layer (FilterSearchBar + FilterBuilder)    │  ← 用户交互层
├─────────────────────────────────────────────────┤
│  Manager Layer (FilterManager)                  │  ← 业务协调层
├─────────────────────────────────────────────────┤
│  Condition Layer (FilterCondition Interface)    │  ← 条件抽象层
│  ├── FieldCondition (字段筛选)                  │
│  ├── FuzzySearchCondition (模糊搜索)            │
│  └── CompositeCondition (组合条件)              │
├─────────────────────────────────────────────────┤
│  Executor Layer (FilterExecutor)                │  ← 执行层
│  ├── FrontendFilter (前端筛选)                  │
│  └── BackendFilter (后端筛选, v002+)            │
├─────────────────────────────────────────────────┤
│  Event Layer (EventBus)                         │  ← 事件通信层
└─────────────────────────────────────────────────┘
```

#### 2. 筛选条件接口设计
```javascript
/**
 * 筛选条件基类接口
 * 所有筛选条件必须实现此接口
 */
class IFilterCondition {
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
```

#### 3. 字段筛选条件实现
```javascript
/**
 * 字段筛选条件
 * 支持按单一字段进行精确筛选
 */
class FieldCondition extends IFilterCondition {
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
        return fieldValue.some(tag => tag.toLowerCase().includes(String(this.value).toLowerCase()));

      case 'not_has_tag':
        if (!Array.isArray(fieldValue)) return true;
        return !fieldValue.some(tag => tag.toLowerCase().includes(String(this.value).toLowerCase()));

      default:
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
```

#### 4. 模糊搜索条件实现
```javascript
/**
 * 模糊搜索条件
 * 在所有可搜索字段中查找关键词
 */
class FuzzySearchCondition extends IFilterCondition {
  constructor(config = {}) {
    super();
    this.keywords = config.keywords || [];  // 关键词数组
    this.searchFields = config.searchFields || [
      'filename', 'tags', 'created_at', 'updated_at'
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
```

#### 5. 组合条件实现
```javascript
/**
 * 组合条件
 * 支持 AND、OR、NOT 逻辑组合
 */
class CompositeCondition extends IFilterCondition {
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
    this.conditions = config.conditions.map(condConfig => {
      return FilterConditionFactory.createFromConfig(condConfig);
    });
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
```

#### 6. 条件工厂
```javascript
/**
 * 筛选条件工厂
 * 用于创建和反序列化条件
 */
class FilterConditionFactory {
  /**
   * 从配置创建条件
   */
  static createFromConfig(config) {
    switch (config.type) {
      case 'field':
        const fieldCond = new FieldCondition();
        fieldCond.deserialize(config);
        return fieldCond;

      case 'fuzzy':
        const fuzzyCond = new FuzzySearchCondition();
        fuzzyCond.deserialize(config);
        return fuzzyCond;

      case 'composite':
        const compCond = new CompositeCondition();
        compCond.deserialize(config);
        return compCond;

      default:
        throw new Error(`未知的条件类型: ${config.type}`);
    }
  }

  /**
   * 从查询字符串创建条件（解析简单语法）
   * 例如: "filename:Python AND rating:>=4"
   */
  static createFromQueryString(queryString) {
    // v002+ 实现查询语言解析器
    throw new Error('查询语言解析器尚未实现');
  }
}
```

#### 7. 筛选管理器
```javascript
/**
 * 筛选管理器
 * 负责管理筛选条件、执行筛选、管理状态
 */
class FilterManager {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;

    // 当前活跃的条件
    this.activeConditions = [];

    // 筛选模式
    this.filterMode = 'simple';  // 'simple' 或 'advanced'

    // 筛选结果缓存
    this.filteredData = [];
    this.originalData = [];

    // 初始化事件监听
    this._setupEventListeners();
  }

  /**
   * 设置数据源
   */
  setDataSource(data) {
    this.originalData = data;
    this.applyFilters();
  }

  /**
   * 添加筛选条件
   */
  addCondition(condition) {
    const validation = condition.validate();
    if (!validation.valid) {
      throw new Error(`条件验证失败: ${validation.errors.join(', ')}`);
    }

    this.activeConditions.push(condition);
    this.logger.info('[FilterManager] 添加筛选条件', condition.getDescription());

    // 应用筛选
    this.applyFilters();

    // 触发事件
    this.eventBus.emit('filter:condition-added', {
      condition: condition.serialize(),
      totalConditions: this.activeConditions.length
    });
  }

  /**
   * 移除筛选条件
   */
  removeCondition(conditionId) {
    const index = this.activeConditions.findIndex(
      c => c.getConditionId() === conditionId
    );

    if (index === -1) {
      this.logger.warn('[FilterManager] 条件不存在', conditionId);
      return;
    }

    const removed = this.activeConditions.splice(index, 1)[0];
    this.logger.info('[FilterManager] 移除筛选条件', removed.getDescription());

    // 重新应用筛选
    this.applyFilters();

    // 触发事件
    this.eventBus.emit('filter:condition-removed', {
      conditionId,
      totalConditions: this.activeConditions.length
    });
  }

  /**
   * 清除所有条件
   */
  clearAllConditions() {
    this.logger.info('[FilterManager] 清除所有筛选条件');
    this.activeConditions = [];

    // 重置筛选
    this.applyFilters();

    // 触发事件
    this.eventBus.emit('filter:all-cleared');
  }

  /**
   * 应用筛选
   */
  applyFilters() {
    this.logger.info('[FilterManager] 应用筛选', {
      conditions: this.activeConditions.length,
      records: this.originalData.length
    });

    // 如果没有条件，返回全部数据
    if (this.activeConditions.length === 0) {
      this.filteredData = [...this.originalData];
    } else {
      // 执行筛选
      this.filteredData = this.originalData.filter(record => {
        return this.activeConditions.every(condition => {
          return condition.match(record);
        });
      });
    }

    this.logger.info('[FilterManager] 筛选完成', {
      original: this.originalData.length,
      filtered: this.filteredData.length
    });

    // 触发事件
    this.eventBus.emit('filter:applied', {
      totalRecords: this.originalData.length,
      filteredRecords: this.filteredData.length,
      conditions: this.activeConditions.map(c => c.serialize())
    });

    return this.filteredData;
  }

  /**
   * 获取筛选结果
   */
  getFilteredData() {
    return this.filteredData;
  }

  /**
   * 获取当前条件描述
   */
  getActiveConditionsDescription() {
    return this.activeConditions.map(c => c.getDescription());
  }

  /**
   * 切换筛选模式
   */
  setFilterMode(mode) {
    if (!['simple', 'advanced'].includes(mode)) {
      throw new Error(`无效的筛选模式: ${mode}`);
    }

    this.filterMode = mode;
    this.eventBus.emit('filter:mode-changed', { mode });
  }

  /**
   * 导出筛选配置
   */
  exportFilterConfig() {
    return {
      mode: this.filterMode,
      conditions: this.activeConditions.map(c => c.serialize()),
      timestamp: Date.now()
    };
  }

  /**
   * 导入筛选配置
   */
  importFilterConfig(config) {
    this.filterMode = config.mode || 'simple';
    this.activeConditions = (config.conditions || []).map(condConfig => {
      return FilterConditionFactory.createFromConfig(condConfig);
    });

    this.applyFilters();
  }

  /**
   * 设置事件监听
   * @private
   */
  _setupEventListeners() {
    // 监听数据更新
    this.eventBus.on('pdf:list:updated', (data) => {
      this.setDataSource(data.items || []);
    });
  }
}
```

#### 8. 筛选搜索框 UI 组件
```javascript
/**
 * 筛选搜索框组件（简单模式）
 */
class FilterSearchBar {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;
    this.filterManager = dependencies.filterManager;

    this.container = null;
    this.searchInput = null;
    this.searchTimeout = null;

    this._createUI();
    this._setupEventListeners();
  }

  /**
   * 创建 UI
   */
  _createUI() {
    const html = `
      <div id="filter-search-bar" class="filter-search-bar">
        <div class="search-input-group">
          <!-- 搜索图标 -->
          <span class="search-icon">🔍</span>

          <!-- 搜索输入框 -->
          <input
            type="text"
            class="search-input"
            placeholder="搜索 PDF (支持多关键词，空格分隔)..."
            autocomplete="off"
          >

          <!-- 清除按钮 -->
          <button class="btn-clear" hidden aria-label="清除">
            &times;
          </button>

          <!-- 高级筛选按钮 -->
          <button class="btn-advanced" title="高级筛选">
            <span>⚙️ 高级</span>
          </button>
        </div>

        <!-- 活跃条件显示 -->
        <div class="active-conditions" id="active-conditions" hidden>
          <div class="conditions-label">筛选条件:</div>
          <div class="conditions-list" id="conditions-list"></div>
          <button class="btn-clear-all">清除全部</button>
        </div>

        <!-- 筛选结果统计 -->
        <div class="filter-stats" id="filter-stats" hidden>
          <span class="stats-text">
            显示 <strong id="filtered-count">0</strong> / <strong id="total-count">0</strong> 项
          </span>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim();
    this.container = tempDiv.firstChild;

    // 插入到页面顶部（表格之前）
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.parentNode.insertBefore(this.container, tableContainer);
    } else {
      document.body.appendChild(this.container);
    }

    this.searchInput = this.container.querySelector('.search-input');
  }

  /**
   * 设置事件监听
   */
  _setupEventListeners() {
    const clearBtn = this.container.querySelector('.btn-clear');
    const advancedBtn = this.container.querySelector('.btn-advanced');
    const clearAllBtn = this.container.querySelector('.btn-clear-all');

    // 搜索输入（防抖）
    this.searchInput.addEventListener('input', (e) => {
      const searchText = e.target.value.trim();

      // 显示/隐藏清除按钮
      clearBtn.hidden = searchText.length === 0;

      // 防抖处理
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this._performSearch(searchText);
      }, 300);
    });

    // 回车立即搜索
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchTimeout);
        this._performSearch(this.searchInput.value.trim());
      }
    });

    // 清除按钮
    clearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      clearBtn.hidden = true;
      this._performSearch('');
    });

    // 高级筛选按钮
    advancedBtn.addEventListener('click', () => {
      this.eventBus.emit('filter:show-advanced-builder');
    });

    // 清除全部按钮
    clearAllBtn.addEventListener('click', () => {
      this.filterManager.clearAllConditions();
      this.searchInput.value = '';
      clearBtn.hidden = true;
    });

    // 监听筛选条件变化
    this.eventBus.on('filter:condition-added', () => {
      this._updateActiveConditionsDisplay();
    });

    this.eventBus.on('filter:condition-removed', () => {
      this._updateActiveConditionsDisplay();
    });

    this.eventBus.on('filter:all-cleared', () => {
      this._updateActiveConditionsDisplay();
    });

    // 监听筛选结果
    this.eventBus.on('filter:applied', (data) => {
      this._updateStatsDisplay(data.filteredRecords, data.totalRecords);
    });
  }

  /**
   * 执行搜索
   */
  _performSearch(searchText) {
    this.logger.info('[FilterSearchBar] 执行搜索', { searchText });

    // 清除之前的模糊搜索条件
    const existingFuzzy = this.filterManager.activeConditions.find(
      c => c.getConditionType() === 'fuzzy'
    );
    if (existingFuzzy) {
      this.filterManager.removeCondition(existingFuzzy.getConditionId());
    }

    // 如果搜索文本为空，直接返回
    if (!searchText) {
      return;
    }

    // 创建模糊搜索条件
    const keywords = FuzzySearchCondition.parseKeywords(searchText);
    const fuzzyCondition = new FuzzySearchCondition({
      keywords,
      searchFields: ['filename', 'tags'],
      matchMode: 'any'
    });

    // 添加条件
    this.filterManager.addCondition(fuzzyCondition);
  }

  /**
   * 更新活跃条件显示
   */
  _updateActiveConditionsDisplay() {
    const conditionsDiv = this.container.querySelector('#active-conditions');
    const conditionsList = this.container.querySelector('#conditions-list');

    const conditions = this.filterManager.activeConditions;

    if (conditions.length === 0) {
      conditionsDiv.hidden = true;
      return;
    }

    conditionsDiv.hidden = false;

    // 渲染条件
    const conditionsHtml = conditions.map(condition => {
      const id = condition.getConditionId();
      const desc = condition.getDescription();
      return `
        <div class="condition-chip" data-id="${id}">
          <span class="condition-text">${desc}</span>
          <button class="btn-remove" data-id="${id}" aria-label="移除">&times;</button>
        </div>
      `;
    }).join('');

    conditionsList.innerHTML = conditionsHtml;

    // 添加移除按钮事件
    conditionsList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterManager.removeCondition(btn.dataset.id);
      });
    });
  }

  /**
   * 更新统计显示
   */
  _updateStatsDisplay(filteredCount, totalCount) {
    const statsDiv = this.container.querySelector('#filter-stats');
    const filteredSpan = this.container.querySelector('#filtered-count');
    const totalSpan = this.container.querySelector('#total-count');

    statsDiv.hidden = false;
    filteredSpan.textContent = filteredCount;
    totalSpan.textContent = totalCount;

    // 如果全部显示，隐藏统计
    if (filteredCount === totalCount && this.filterManager.activeConditions.length === 0) {
      statsDiv.hidden = true;
    }
  }
}
```

#### 9. 高级筛选构建器 UI 组件
```javascript
/**
 * 高级筛选构建器（高级模式）
 */
class FilterBuilder {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;
    this.filterManager = dependencies.filterManager;

    this.container = null;
    this.conditionsList = [];

    this._createUI();
    this._setupEventListeners();
  }

  /**
   * 创建 UI
   */
  _createUI() {
    const html = `
      <div id="filter-builder" class="filter-builder" hidden>
        <div class="filter-builder-overlay"></div>
        <div class="filter-builder-dialog">
          <!-- 头部 -->
          <div class="filter-builder-header">
            <h3>高级筛选</h3>
            <button class="btn-close" aria-label="关闭">&times;</button>
          </div>

          <!-- 主体 -->
          <div class="filter-builder-body">
            <!-- 条件列表 -->
            <div class="conditions-builder" id="conditions-builder">
              <div class="empty-state">
                <p>暂无筛选条件</p>
                <button class="btn-add-first">添加第一个条件</button>
              </div>
            </div>

            <!-- 添加条件按钮 -->
            <div class="add-condition-row">
              <button class="btn-add-condition">+ 添加条件</button>
              <button class="btn-add-group">+ 添加条件组</button>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="filter-builder-footer">
            <div class="preview">
              <strong>预览:</strong>
              <span id="conditions-preview">无条件</span>
            </div>
            <div class="actions">
              <button class="btn-reset">重置</button>
              <button class="btn-apply">应用筛选</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim();
    this.container = tempDiv.firstChild;
    document.body.appendChild(this.container);
  }

  /**
   * 显示构建器
   */
  show() {
    this.container.hidden = false;
    this._loadCurrentConditions();
  }

  /**
   * 隐藏构建器
   */
  hide() {
    this.container.hidden = true;
  }

  /**
   * 添加条件行
   */
  addConditionRow(config = {}) {
    const rowId = `cond_${Date.now()}`;
    const row = {
      id: rowId,
      field: config.field || 'filename',
      operator: config.operator || 'contains',
      value: config.value || '',
      logic: config.logic || 'AND'  // 与下一个条件的逻辑关系
    };

    this.conditionsList.push(row);
    this._renderConditions();
    this._updatePreview();
  }

  /**
   * 移除条件行
   */
  removeConditionRow(rowId) {
    const index = this.conditionsList.findIndex(r => r.id === rowId);
    if (index > -1) {
      this.conditionsList.splice(index, 1);
      this._renderConditions();
      this._updatePreview();
    }
  }

  /**
   * 渲染条件列表
   */
  _renderConditions() {
    const builderDiv = this.container.querySelector('#conditions-builder');

    if (this.conditionsList.length === 0) {
      builderDiv.innerHTML = `
        <div class="empty-state">
          <p>暂无筛选条件</p>
          <button class="btn-add-first">添加第一个条件</button>
        </div>
      `;

      // 绑定事件
      builderDiv.querySelector('.btn-add-first').addEventListener('click', () => {
        this.addConditionRow();
      });

      return;
    }

    // 渲染每个条件行
    const rowsHtml = this.conditionsList.map((row, index) => {
      const isLast = index === this.conditionsList.length - 1;

      return `
        <div class="condition-row" data-id="${row.id}">
          <!-- 逻辑操作符（不显示在第一行） -->
          ${index > 0 ? `
            <div class="logic-selector">
              <select class="logic-select" data-id="${row.id}">
                <option value="AND" ${row.logic === 'AND' ? 'selected' : ''}>且 (AND)</option>
                <option value="OR" ${row.logic === 'OR' ? 'selected' : ''}>或 (OR)</option>
              </select>
            </div>
          ` : ''}

          <!-- 条件编辑器 -->
          <div class="condition-editor">
            <!-- 字段选择 -->
            <select class="field-select" data-id="${row.id}">
              <option value="filename" ${row.field === 'filename' ? 'selected' : ''}>文件名</option>
              <option value="tags" ${row.field === 'tags' ? 'selected' : ''}>标签</option>
              <option value="rating" ${row.field === 'rating' ? 'selected' : ''}>评分</option>
              <option value="review_count" ${row.field === 'review_count' ? 'selected' : ''}>复习次数</option>
              <option value="file_size" ${row.field === 'file_size' ? 'selected' : ''}>文件大小</option>
              <option value="created_at" ${row.field === 'created_at' ? 'selected' : ''}>创建时间</option>
              <option value="last_accessed_at" ${row.field === 'last_accessed_at' ? 'selected' : ''}>访问时间</option>
            </select>

            <!-- 操作符选择 -->
            <select class="operator-select" data-id="${row.id}">
              ${this._getOperatorOptions(row.field, row.operator)}
            </select>

            <!-- 值输入 -->
            <input
              type="text"
              class="value-input"
              data-id="${row.id}"
              value="${row.value}"
              placeholder="输入筛选值..."
            >

            <!-- 删除按钮 -->
            <button class="btn-remove-row" data-id="${row.id}" aria-label="删除">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    builderDiv.innerHTML = rowsHtml;

    // 绑定事件
    this._bindConditionRowEvents();
  }

  /**
   * 获取操作符选项（根据字段类型）
   */
  _getOperatorOptions(field, currentOperator) {
    let operators = [];

    // 根据字段类型返回不同的操作符
    const stringFields = ['filename', 'tags'];
    const numberFields = ['rating', 'review_count', 'file_size'];
    const dateFields = ['created_at', 'updated_at', 'last_accessed_at'];

    if (stringFields.includes(field)) {
      operators = [
        { value: 'contains', label: '包含' },
        { value: 'not_contains', label: '不包含' },
        { value: 'eq', label: '等于' },
        { value: 'starts_with', label: '开头是' },
        { value: 'ends_with', label: '结尾是' }
      ];
    } else if (numberFields.includes(field)) {
      operators = [
        { value: 'eq', label: '等于' },
        { value: 'ne', label: '不等于' },
        { value: 'gt', label: '大于' },
        { value: 'lt', label: '小于' },
        { value: 'gte', label: '大于等于' },
        { value: 'lte', label: '小于等于' }
      ];
    } else if (dateFields.includes(field)) {
      operators = [
        { value: 'eq', label: '等于' },
        { value: 'gt', label: '之后' },
        { value: 'lt', label: '之前' },
        { value: 'in_range', label: '范围内' }
      ];
    }

    return operators.map(op => {
      const selected = op.value === currentOperator ? 'selected' : '';
      return `<option value="${op.value}" ${selected}>${op.label}</option>`;
    }).join('');
  }

  /**
   * 绑定条件行事件
   */
  _bindConditionRowEvents() {
    const builderDiv = this.container.querySelector('#conditions-builder');

    // 逻辑选择器变化
    builderDiv.querySelectorAll('.logic-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.conditionsList.find(r => r.id === rowId);
        if (row) {
          row.logic = e.target.value;
          this._updatePreview();
        }
      });
    });

    // 字段选择器变化
    builderDiv.querySelectorAll('.field-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.conditionsList.find(r => r.id === rowId);
        if (row) {
          row.field = e.target.value;
          // 重新渲染以更新操作符选项
          this._renderConditions();
          this._updatePreview();
        }
      });
    });

    // 操作符选择器变化
    builderDiv.querySelectorAll('.operator-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.conditionsList.find(r => r.id === rowId);
        if (row) {
          row.operator = e.target.value;
          this._updatePreview();
        }
      });
    });

    // 值输入变化
    builderDiv.querySelectorAll('.value-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.conditionsList.find(r => r.id === rowId);
        if (row) {
          row.value = e.target.value;
          this._updatePreview();
        }
      });
    });

    // 删除按钮
    builderDiv.querySelectorAll('.btn-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeConditionRow(btn.dataset.id);
      });
    });
  }

  /**
   * 更新预览
   */
  _updatePreview() {
    const previewSpan = this.container.querySelector('#conditions-preview');

    if (this.conditionsList.length === 0) {
      previewSpan.textContent = '无条件';
      return;
    }

    // 构建描述文本
    const descriptions = this.conditionsList.map((row, index) => {
      let desc = `${row.field} ${row.operator} "${row.value}"`;
      if (index > 0) {
        desc = `${row.logic} ${desc}`;
      }
      return desc;
    });

    previewSpan.textContent = descriptions.join(' ');
  }

  /**
   * 应用筛选
   */
  applyFilter() {
    // 清除现有条件
    this.filterManager.clearAllConditions();

    // 构建条件
    if (this.conditionsList.length === 0) {
      this.hide();
      return;
    }

    // 将条件列表转换为条件对象
    let rootCondition = null;

    if (this.conditionsList.length === 1) {
      // 单个条件
      const row = this.conditionsList[0];
      rootCondition = new FieldCondition({
        field: row.field,
        operator: row.operator,
        value: row.value
      });
    } else {
      // 多个条件，需要组合
      rootCondition = this._buildCompositeCondition();
    }

    // 添加到管理器
    this.filterManager.addCondition(rootCondition);

    this.hide();
  }

  /**
   * 构建组合条件
   */
  _buildCompositeCondition() {
    // 简单实现：按顺序组合
    // v002+ 可以支持更复杂的分组和优先级

    let currentComposite = null;
    let currentOperator = 'AND';

    this.conditionsList.forEach((row, index) => {
      const fieldCond = new FieldCondition({
        field: row.field,
        operator: row.operator,
        value: row.value
      });

      if (index === 0) {
        currentComposite = fieldCond;
      } else {
        const newComposite = new CompositeCondition({
          operator: row.logic,
          conditions: [currentComposite, fieldCond]
        });
        currentComposite = newComposite;
      }
    });

    return currentComposite;
  }

  /**
   * 加载当前条件
   */
  _loadCurrentConditions() {
    // 从 FilterManager 加载现有条件
    // v001 简化实现：清空重新开始
    this.conditionsList = [];
    this._renderConditions();
  }

  /**
   * 设置事件监听
   */
  _setupEventListeners() {
    const closeBtn = this.container.querySelector('.btn-close');
    const resetBtn = this.container.querySelector('.btn-reset');
    const applyBtn = this.container.querySelector('.btn-apply');
    const addConditionBtn = this.container.querySelector('.btn-add-condition');
    const overlay = this.container.querySelector('.filter-builder-overlay');

    // 关闭
    closeBtn.addEventListener('click', () => this.hide());
    overlay.addEventListener('click', () => this.hide());

    // 重置
    resetBtn.addEventListener('click', () => {
      this.conditionsList = [];
      this._renderConditions();
      this._updatePreview();
    });

    // 应用
    applyBtn.addEventListener('click', () => {
      this.applyFilter();
    });

    // 添加条件
    addConditionBtn.addEventListener('click', () => {
      this.addConditionRow();
    });

    // 监听显示事件
    this.eventBus.on('filter:show-advanced-builder', () => {
      this.show();
    });
  }
}
```

### WebSocket 协议扩展（可选，v002+）

#### 后端筛选支持
```json
// 前端 → 后端：筛选请求（服务端分页场景）
{
  "type": "pdf:filter:request",
  "request_id": "req_filter_12345",
  "timestamp": "2025-10-02T00:56:35Z",
  "data": {
    "conditions": [
      {
        "type": "field",
        "field": "rating",
        "operator": "gte",
        "value": 4
      }
    ],
    "page": 1,
    "pageSize": 50
  }
}

// 后端 → 前端：筛选响应
{
  "type": "pdf:filter:response",
  "request_id": "req_filter_12345",
  "timestamp": "2025-10-02T00:56:36Z",
  "data": {
    "items": [...],  // 筛选后的数据
    "total": 150,    // 总记录数
    "filtered": 45,  // 筛选后数量
    "page": 1,
    "pageSize": 50
  }
}
```

## 约束条件

### 仅修改 pdf-home 模块代码
仅在 `src/frontend/pdf-home/` 目录下添加新代码，不修改其他模块。

允许的新增文件：
- `src/frontend/pdf-home/filter/filter-manager.js` - 筛选管理器
- `src/frontend/pdf-home/filter/filter-conditions.js` - 筛选条件实现
- `src/frontend/pdf-home/filter/filter-condition-factory.js` - 条件工厂
- `src/frontend/pdf-home/ui/filter-search-bar.js` - 搜索框组件
- `src/frontend/pdf-home/ui/filter-builder.js` - 高级构建器
- `src/frontend/pdf-home/__tests__/filter-manager.test.js` - 单元测试
- `src/frontend/pdf-home/__tests__/filter-conditions.test.js` - 单元测试

### 严格遵循代码规范和标准
必须优先阅读和理解：
1. `src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json`
2. `docs/SPEC/FRONTEND-EVENT-BUS-001.md`
3. `docs/SPEC/JAVASCRIPT-CLASS-STRUCTURE-001.md`
4. `docs/SPEC/JAVASCRIPT-FUNCTION-DESIGN-001.md`

### 架构设计原则
1. **策略模式**: 所有筛选逻辑通过条件接口实现
2. **开闭原则**: 新增筛选类型不修改现有代码
3. **单一职责**: Manager 负责协调，Condition 负责匹配逻辑，UI 负责展示
4. **依赖注入**: 所有组件通过构造函数注入依赖
5. **事件驱动**: 组件间通过 EventBus 解耦

### 性能要求
- 筛选响应时间 < 500ms（1000条记录）
- 输入防抖延迟: 300ms
- 支持大数据量（10000+条）的高效筛选
- 使用 Web Worker 处理大数据量筛选（v002+）

### 向后兼容性
- 保持 Tabulator 原有的列头筛选功能
- 新筛选系统作为增强功能
- 不破坏现有的表格交互

## 可行验收标准

### 单元测试

#### 1. FilterCondition 测试覆盖率 ≥ 95%
- FieldCondition 各操作符测试
- FuzzySearchCondition 关键词匹配测试
- CompositeCondition 逻辑组合测试
- 边界情况测试（null、undefined、空字符串）

#### 2. FilterManager 测试覆盖率 ≥ 90%
- 条件添加/移除/清除测试
- 筛选执行测试
- 数据源更新测试
- 配置导入/导出测试

#### 3. UI 组件测试覆盖率 ≥ 80%
- 搜索框输入测试
- 条件显示测试
- 构建器交互测试

### 端到端测试

#### 测试场景1: 简单模糊搜索
- **前置条件**: PDF列表显示至少20条记录
- **操作步骤**:
  1. 在搜索框输入"Python"
  2. 等待300ms（防抖）
- **预期结果**:
  - 表格只显示文件名或标签包含"Python"的记录
  - 活跃条件区域显示"模糊搜索: Python"
  - 统计显示正确的筛选数量

#### 测试场景2: 多关键词搜索
- **前置条件**: PDF列表显示正常
- **操作步骤**:
  1. 输入"Python 教程"（空格分隔）
  2. 等待300ms
- **预期结果**:
  - 显示包含"Python"或"教程"的记录
  - 匹配任一关键词即可

#### 测试场景3: 高级筛选 - 单条件
- **前置条件**: 点击"高级"按钮
- **操作步骤**:
  1. 添加条件：评分 ≥ 4
  2. 点击"应用筛选"
- **预期结果**:
  - 只显示评分≥4星的PDF
  - 搜索框下方显示条件"rating ≥ 4"

#### 测试场景4: 高级筛选 - 组合条件
- **前置条件**: 打开高级筛选
- **操作步骤**:
  1. 添加条件1：评分 ≥ 4
  2. 添加条件2：逻辑选"且"，复习次数 > 10
  3. 点击"应用筛选"
- **预期结果**:
  - 只显示评分≥4且复习次数>10的PDF
  - 条件描述："(评分 ≥ 4 且 复习次数 > 10)"

#### 测试场景5: 清除筛选
- **前置条件**: 已应用筛选条件
- **操作步骤**:
  1. 点击某个条件chip的"×"按钮
  2. 观察表格变化
- **预期结果**:
  - 该条件被移除
  - 表格重新筛选
  - 如果所有条件都被移除，显示全部记录

#### 测试场景6: 一键清除全部
- **前置条件**: 已应用多个筛选条件
- **操作步骤**:
  1. 点击"清除全部"按钮
- **预期结果**:
  - 所有条件被清除
  - 表格显示全部记录
  - 搜索框清空
  - 统计消失

#### 测试场景7: 字符串字段筛选
- **前置条件**: 打开高级筛选
- **操作步骤**:
  1. 字段选"文件名"
  2. 操作符选"包含"
  3. 值输入"tutorial"
  4. 应用筛选
- **预期结果**:
  - 只显示文件名包含"tutorial"的PDF（不区分大小写）

#### 测试场景8: 数字字段筛选
- **前置条件**: 打开高级筛选
- **操作步骤**:
  1. 字段选"复习次数"
  2. 操作符选"大于"
  3. 值输入"5"
  4. 应用筛选
- **预期结果**:
  - 只显示复习次数>5的PDF
  - 数字正确比较（不是字符串比较）

#### 测试场景9: 逻辑组合 - OR
- **前置条件**: 打开高级筛选
- **操作步骤**:
  1. 条件1：评分 ≥ 4
  2. 条件2：逻辑选"或"，复习次数 > 20
  3. 应用筛选
- **预期结果**:
  - 显示评分≥4或复习次数>20的PDF（满足任一条件即可）

#### 测试场景10: 性能测试
- **前置条件**: 加载1000条PDF记录
- **操作步骤**:
  1. 在搜索框输入关键词
  2. 测量响应时间
- **预期结果**:
  - 筛选完成时间 < 500ms
  - UI不卡顿，流畅响应

### 接口实现

#### 接口1: IFilterCondition.match()
- **函数**: `match(record)`
- **描述**: 判断记录是否匹配条件
- **参数**:
  - `record`: Object - PDF记录对象
- **返回值**: boolean - 是否匹配
- **异常**: 若记录格式错误，返回false

#### 接口2: FilterManager.addCondition()
- **函数**: `addCondition(condition)`
- **描述**: 添加筛选条件并应用
- **参数**:
  - `condition`: IFilterCondition - 条件实例
- **返回值**: void
- **事件触发**: `filter:condition-added`

#### 接口3: FilterManager.applyFilters()
- **函数**: `applyFilters()`
- **描述**: 应用所有活跃条件进行筛选
- **参数**: 无
- **返回值**: Array - 筛选后的数据
- **事件触发**: `filter:applied`

#### 接口4: FilterBuilder.applyFilter()
- **函数**: `applyFilter()`
- **描述**: 应用构建器中配置的筛选条件
- **参数**: 无
- **返回值**: void
- **副作用**: 更新FilterManager，关闭构建器

### 类实现

#### 类1: IFilterCondition
- **类**: `IFilterCondition`
- **描述**: 筛选条件抽象接口
- **方法**:
  - `getConditionId()`: 获取唯一标识
  - `getConditionType()`: 获取条件类型
  - `getDescription()`: 获取可读描述
  - `match(record)`: 执行匹配
  - `validate()`: 验证条件
  - `serialize()`: 序列化
  - `deserialize(config)`: 反序列化
  - `clone()`: 克隆条件

#### 类2: FieldCondition
- **类**: `FieldCondition extends IFilterCondition`
- **描述**: 字段筛选条件
- **属性**:
  - `field`: string - 字段名
  - `operator`: string - 操作符
  - `value`: any - 筛选值
  - `dataType`: string - 数据类型
- **方法**: 实现所有接口方法

#### 类3: FuzzySearchCondition
- **类**: `FuzzySearchCondition extends IFilterCondition`
- **描述**: 模糊搜索条件
- **属性**:
  - `keywords`: string[] - 关键词数组
  - `searchFields`: string[] - 搜索字段
  - `matchMode`: 'any' | 'all' - 匹配模式
- **方法**: 实现所有接口方法
- **静态方法**: `parseKeywords(text)` - 解析关键词

#### 类4: CompositeCondition
- **类**: `CompositeCondition extends IFilterCondition`
- **描述**: 组合条件（支持逻辑运算）
- **属性**:
  - `operator`: 'AND' | 'OR' | 'NOT' - 逻辑操作符
  - `conditions`: IFilterCondition[] - 子条件数组
- **方法**:
  - 实现所有接口方法
  - `addCondition(condition)`: 添加子条件
  - `removeCondition(index)`: 移除子条件

#### 类5: FilterManager
- **类**: `FilterManager`
- **描述**: 筛选功能的业务协调器
- **属性**:
  - `eventBus`: EventBus
  - `logger`: Logger
  - `activeConditions`: IFilterCondition[] - 活跃条件
  - `filterMode`: 'simple' | 'advanced'
  - `filteredData`: Array - 筛选结果
  - `originalData`: Array - 原始数据
- **方法**:
  - `setDataSource(data)`: 设置数据源
  - `addCondition(condition)`: 添加条件
  - `removeCondition(id)`: 移除条件
  - `clearAllConditions()`: 清除所有条件
  - `applyFilters()`: 应用筛选
  - `getFilteredData()`: 获取结果
  - `exportFilterConfig()`: 导出配置
  - `importFilterConfig(config)`: 导入配置

#### 类6: FilterSearchBar
- **类**: `FilterSearchBar`
- **描述**: 筛选搜索框UI组件（简单模式）
- **属性**:
  - `container`: HTMLElement
  - `searchInput`: HTMLInputElement
  - `searchTimeout`: number
- **方法**:
  - `_createUI()`: 创建UI
  - `_performSearch(text)`: 执行搜索
  - `_updateActiveConditionsDisplay()`: 更新条件显示
  - `_updateStatsDisplay()`: 更新统计显示

#### 类7: FilterBuilder
- **类**: `FilterBuilder`
- **描述**: 高级筛选构建器UI组件
- **属性**:
  - `container`: HTMLElement
  - `conditionsList`: Array - 条件列表
- **方法**:
  - `show()`: 显示构建器
  - `hide()`: 隐藏构建器
  - `addConditionRow(config)`: 添加条件行
  - `removeConditionRow(id)`: 移除条件行
  - `applyFilter()`: 应用筛选
  - `_renderConditions()`: 渲染条件
  - `_buildCompositeCondition()`: 构建组合条件
  - `_updatePreview()`: 更新预览

### 事件规范

#### 事件1: filter:condition-added
- **描述**: 添加筛选条件时触发
- **触发时机**: FilterManager.addCondition() 成功后
- **参数**:
  ```javascript
  {
    condition: {...},  // 条件序列化对象
    totalConditions: 2
  }
  ```
- **监听者**: FilterSearchBar（更新UI）

#### 事件2: filter:condition-removed
- **描述**: 移除筛选条件时触发
- **触发时机**: FilterManager.removeCondition() 成功后
- **参数**:
  ```javascript
  {
    conditionId: 'field_filename_123',
    totalConditions: 1
  }
  ```
- **监听者**: FilterSearchBar（更新UI）

#### 事件3: filter:all-cleared
- **描述**: 清除所有筛选条件时触发
- **触发时机**: FilterManager.clearAllConditions() 执行后
- **参数**: 无
- **监听者**: FilterSearchBar, FilterBuilder

#### 事件4: filter:applied
- **描述**: 筛选执行完成时触发
- **触发时机**: FilterManager.applyFilters() 完成后
- **参数**:
  ```javascript
  {
    totalRecords: 1000,
    filteredRecords: 45,
    conditions: [...]
  }
  ```
- **监听者**: FilterSearchBar, TableWrapper

#### 事件5: filter:show-advanced-builder
- **描述**: 请求显示高级筛选构建器
- **触发时机**: 用户点击"高级"按钮
- **参数**: 无
- **监听者**: FilterBuilder

#### 事件6: filter:mode-changed
- **描述**: 筛选模式切换时触发
- **触发时机**: FilterManager.setFilterMode() 执行后
- **参数**:
  ```javascript
  {
    mode: 'simple' | 'advanced'
  }
  ```
- **监听者**: UI组件（调整显示）

## 技术细节

### CSS 样式要求
```css
/* 筛选搜索框 */
.filter-search-bar {
  padding: 16px;
  background: var(--bg-color, #fff);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.search-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.search-input-group:focus-within {
  border-color: #1976D2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
}

.btn-advanced {
  padding: 6px 12px;
  background: #F5F5F5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.btn-advanced:hover {
  background: #E0E0E0;
}

/* 活跃条件显示 */
.active-conditions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px;
  background: #F5F5F5;
  border-radius: 4px;
}

.condition-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #E3F2FD;
  border-radius: 12px;
  font-size: 13px;
}

.condition-chip .btn-remove {
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

/* 筛选结果统计 */
.filter-stats {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

/* 高级筛选构建器 */
.filter-builder {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

.filter-builder-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.filter-builder-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  max-height: 80vh;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.filter-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.filter-builder-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.condition-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: #F9F9F9;
  border-radius: 4px;
}

.condition-editor {
  display: flex;
  gap: 8px;
  align-items: center;
}

.field-select,
.operator-select {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.value-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filter-builder-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
}

.preview {
  font-size: 13px;
  color: #666;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 性能优化

#### 1. 防抖处理
```javascript
// 搜索输入防抖，避免频繁筛选
const DEBOUNCE_DELAY = 300;

let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(e.target.value);
  }, DEBOUNCE_DELAY);
});
```

#### 2. 大数据量优化
```javascript
// 超过10000条记录时，使用 Web Worker
if (data.length > 10000) {
  // 创建 Worker
  const worker = new Worker('filter-worker.js');

  worker.postMessage({
    data: data,
    conditions: conditions.map(c => c.serialize())
  });

  worker.onmessage = (e) => {
    const filteredData = e.data;
    updateTable(filteredData);
  };
} else {
  // 直接在主线程筛选
  const filteredData = applyFilters(data, conditions);
  updateTable(filteredData);
}
```

#### 3. 结果缓存
```javascript
// 缓存最近的筛选结果
class FilterCache {
  constructor(maxSize = 10) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  generateKey(conditions) {
    return JSON.stringify(conditions.map(c => c.serialize()));
  }
}
```

### 错误处理

#### 1. 条件验证错误
```javascript
try {
  filterManager.addCondition(condition);
} catch (error) {
  showErrorToast(`筛选条件无效: ${error.message}`);
  logger.error('[Filter] 条件验证失败', error);
}
```

#### 2. 数据格式错误
```javascript
// 容错处理：如果记录缺少字段，返回false而不是报错
match(record) {
  try {
    const value = record[this.field];
    if (value === undefined) {
      return false;  // 字段不存在，不匹配
    }
    // ... 执行匹配逻辑
  } catch (error) {
    logger.warn('[Filter] 匹配过程出错', error);
    return false;
  }
}
```

## 未来扩展点 (v002+)

### 1. 查询语言支持
```javascript
// 支持类似 SQL 的查询语法
const query = 'filename:Python AND rating:>=4 OR tags:教程';
const conditions = FilterQueryParser.parse(query);
filterManager.importFilterConfig({ conditions });
```

### 2. 正则表达式支持
```javascript
// 字段条件支持正则
const regexCondition = new FieldCondition({
  field: 'filename',
  operator: 'regex',
  value: /^test_.*\.pdf$/i
});
```

### 3. 筛选模板管理
```javascript
// 保存常用筛选配置
class FilterTemplateManager {
  saveTemplate(name, config) {
    localStorage.setItem(`filter-template-${name}`, JSON.stringify(config));
  }

  loadTemplate(name) {
    const json = localStorage.getItem(`filter-template-${name}`);
    return json ? JSON.parse(json) : null;
  }

  listTemplates() {
    // 返回所有模板
  }
}
```

### 4. 智能筛选建议
```javascript
// 基于历史筛选，推荐常用条件
class FilterSuggestionEngine {
  analyzeHistory() {
    // 分析用户的筛选历史
  }

  suggestConditions() {
    // 推荐可能有用的筛选条件
    return [
      '评分 ≥ 4',
      '最近7天添加',
      '标签包含 Python'
    ];
  }
}
```

### 5. 后端筛选支持
```javascript
// 服务端分页场景，在后端执行筛选
class BackendFilterExecutor {
  async applyFilters(conditions, page, pageSize) {
    const response = await fetch('/api/pdf/filter', {
      method: 'POST',
      body: JSON.stringify({
        conditions: conditions.map(c => c.serialize()),
        page,
        pageSize
      })
    });

    return response.json();
  }
}
```

## 开发顺序建议

### Phase 1: 核心架构 (1.5天)
1. 实现 `IFilterCondition` 接口
2. 实现 `FieldCondition`、`FuzzySearchCondition`、`CompositeCondition`
3. 实现 `FilterConditionFactory`
4. 实现 `FilterManager` 核心逻辑
5. 编写单元测试

### Phase 2: 简单搜索 UI (1天)
1. 实现 `FilterSearchBar` 组件
2. 实现模糊搜索功能
3. 实现条件chip显示
4. 实现统计显示
5. 测试搜索交互

### Phase 3: 高级筛选 UI (2天)
1. 实现 `FilterBuilder` 组件
2. 实现条件行动态添加/删除
3. 实现字段/操作符/值的联动
4. 实现预览和应用功能
5. 测试复杂场景

### Phase 4: 集成和优化 (1天)
1. 集成到 pdf-home 主应用
2. 与 Tabulator 表格对接
3. 性能优化（防抖、缓存）
4. 端到端测试

### Phase 5: 文档和完善 (0.5天)
1. 编写使用文档
2. 添加示例和教程
3. 代码审查
4. 最终验收

## 风险评估

### 高风险项
1. **复杂逻辑组合的正确性**:
   - 风险: AND、OR、NOT 组合可能出现逻辑错误
   - 缓解: 充分的单元测试，覆盖各种组合

2. **大数据量性能**:
   - 风险: 10000+条记录筛选可能卡顿
   - 缓解: Web Worker、缓存、优化算法

### 中风险项
1. **UI复杂度**:
   - 风险: 高级筛选构建器交互复杂
   - 缓解: 渐进式实现，先简单后复杂

2. **用户学习成本**:
   - 风险: 用户不会使用高级功能
   - 缓解: 提供示例、提示、教程

## 成功度量标准
- 简单搜索响应时间 < 300ms（1000条记录）
- 高级筛选构建器易用性评分 ≥ 8/10
- 筛选正确率 100%（单元测试验证）
- 支持至少10种操作符
- 支持至少3层逻辑嵌套
- 单元测试覆盖率 ≥ 90%
- 用户满意度 ≥ 8/10
