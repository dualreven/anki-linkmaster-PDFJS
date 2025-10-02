# PDF列表排序系统规格说明

**功能ID**: 20251002001902-pdf-list-sorting-system
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 00:19:02
**预计完成**: 2025-10-05
**状态**: 设计中

## 现状说明
- PDF-Home 模块已实现基于 Tabulator 的表格展示
- 当前表格支持点击列头排序，但仅限于前端本地排序
- 缺少统一的排序架构，无法支持后端排序、多级排序、自定义排序等高级功能
- 排序逻辑与 UI 组件耦合，难以扩展和维护
- 没有排序状态反馈，用户不知道排序是否在进行中

## 存在问题
- **架构问题**:
  - 排序逻辑分散在 Tabulator 配置中，缺少统一管理
  - 前后端排序逻辑不一致，可能导致数据不同步
  - 无法支持复杂的排序需求（多级排序、自定义规则）

- **用户体验问题**:
  - 排序操作没有视觉反馈，用户不知道是否正在处理
  - 大数据量排序时可能造成界面卡顿
  - 没有排序历史和状态保存

- **扩展性问题**:
  - 硬编码的排序逻辑难以扩展
  - 无法支持自定义排序策略
  - 缺少排序策略的插件化机制

## 提出需求

### 核心功能（v001 基础版）
1. **底层排序架构**:
   - 设计可扩展的排序策略接口（Strategy Pattern）
   - 支持按任意字段排序（数字、字符串、日期）
   - 支持升序/降序切换
   - 前后端排序协议统一

2. **排序 UI 组件**:
   - 排序控制面板（字段选择 + 升序/降序 + 确定/取消）
   - 排序状态指示器（显示"排序中..."）
   - 当前排序规则显示

3. **排序流程管理**:
   - 排序请求发起 → 显示状态条
   - 前端排序完成 + 后端确认 → 关闭状态条
   - 支持排序取消和重置

### 未来扩展预留（v002+）
- 多级排序（先按字段A排序，再按字段B排序）
- 自定义排序规则（用户定义的复杂排序逻辑）
- 排序模板保存和加载
- 拖拽式排序规则配置
- 智能排序（基于用户行为的自动排序）

## 解决方案

### 技术架构设计

#### 1. 分层架构
```
┌─────────────────────────────────────────────────┐
│  UI Layer (SortControlPanel + SortStatusBar)   │  ← 用户交互层
├─────────────────────────────────────────────────┤
│  Manager Layer (SortManager)                    │  ← 业务协调层
├─────────────────────────────────────────────────┤
│  Strategy Layer (SortStrategy Interface)        │  ← 策略抽象层
│  ├── FieldSortStrategy (v001)                   │
│  ├── MultiLevelSortStrategy (v002+)             │
│  └── CustomSortStrategy (v002+)                 │
├─────────────────────────────────────────────────┤
│  Executor Layer (FrontendSorter/BackendSorter)  │  ← 执行层
├─────────────────────────────────────────────────┤
│  Event Layer (EventBus)                         │  ← 事件通信层
└─────────────────────────────────────────────────┘
```

#### 2. 排序策略接口设计
```javascript
/**
 * 排序策略基类接口
 * 所有排序策略必须实现此接口
 */
class ISortStrategy {
  /**
   * 策略唯一标识
   * @returns {string}
   */
  getStrategyId() {
    throw new Error('Must implement getStrategyId()');
  }

  /**
   * 策略显示名称
   * @returns {string}
   */
  getStrategyName() {
    throw new Error('Must implement getStrategyName()');
  }

  /**
   * 生成排序配置对象（用于前端排序和后端通信）
   * @returns {Object} 排序配置
   */
  generateSortConfig() {
    throw new Error('Must implement generateSortConfig()');
  }

  /**
   * 执行前端排序
   * @param {Array} data - 待排序数据
   * @returns {Array} 排序后的数据
   */
  sortLocally(data) {
    throw new Error('Must implement sortLocally()');
  }

  /**
   * 验证策略参数是否有效
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate() {
    throw new Error('Must implement validate()');
  }

  /**
   * 序列化策略配置（用于保存和传输）
   * @returns {Object}
   */
  serialize() {
    throw new Error('Must implement serialize()');
  }

  /**
   * 反序列化策略配置（从保存的配置恢复）
   * @param {Object} config
   */
  deserialize(config) {
    throw new Error('Must implement deserialize()');
  }
}
```

#### 3. v001 基础排序策略实现
```javascript
/**
 * 字段排序策略（v001 基础实现）
 * 支持按单一字段排序，自动识别数字/字符串类型
 */
class FieldSortStrategy extends ISortStrategy {
  constructor(config = {}) {
    super();
    this.field = config.field || null;        // 排序字段名
    this.order = config.order || 'asc';       // 'asc' 或 'desc'
    this.dataType = config.dataType || 'auto'; // 'number', 'string', 'date', 'auto'
  }

  getStrategyId() {
    return 'field-sort';
  }

  getStrategyName() {
    return '字段排序';
  }

  generateSortConfig() {
    return {
      strategy: 'field-sort',
      field: this.field,
      order: this.order,
      dataType: this.dataType,
      version: '1.0'
    };
  }

  sortLocally(data) {
    if (!this.field || data.length === 0) return data;

    const sortedData = [...data];
    const multiplier = this.order === 'asc' ? 1 : -1;

    // 自动检测数据类型
    const actualType = this._detectDataType(data, this.field);

    sortedData.sort((a, b) => {
      const valA = a[this.field];
      const valB = b[this.field];

      // 处理 null/undefined
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      let result = 0;
      switch (actualType) {
        case 'number':
          result = (parseFloat(valA) - parseFloat(valB));
          break;
        case 'date':
          result = (new Date(valA) - new Date(valB));
          break;
        case 'string':
        default:
          result = String(valA).localeCompare(String(valB), 'zh-CN');
          break;
      }

      return result * multiplier;
    });

    return sortedData;
  }

  validate() {
    const errors = [];
    if (!this.field) {
      errors.push('排序字段不能为空');
    }
    if (!['asc', 'desc'].includes(this.order)) {
      errors.push('排序方向必须是 asc 或 desc');
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  serialize() {
    return {
      strategy: 'field-sort',
      field: this.field,
      order: this.order,
      dataType: this.dataType
    };
  }

  deserialize(config) {
    this.field = config.field;
    this.order = config.order;
    this.dataType = config.dataType || 'auto';
  }

  /**
   * 自动检测字段数据类型
   * @private
   */
  _detectDataType(data, field) {
    if (this.dataType !== 'auto') return this.dataType;

    // 取前几条非空数据检测类型
    const samples = data
      .slice(0, 10)
      .map(item => item[field])
      .filter(val => val != null);

    if (samples.length === 0) return 'string';

    // 检测是否为数字
    const isNumber = samples.every(val => !isNaN(parseFloat(val)));
    if (isNumber) return 'number';

    // 检测是否为日期
    const isDate = samples.every(val => !isNaN(Date.parse(val)));
    if (isDate) return 'date';

    return 'string';
  }
}
```

#### 4. 排序管理器
```javascript
/**
 * 排序管理器
 * 负责协调排序策略、执行排序、管理排序状态
 */
class SortManager {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;

    // 当前排序策略
    this.currentStrategy = null;

    // 排序状态
    this.sortingState = {
      isSorting: false,
      pendingSort: null,
      lastSortConfig: null
    };

    // 注册的排序策略
    this.strategies = new Map();

    // 初始化事件监听
    this._setupEventListeners();
  }

  /**
   * 注册排序策略
   * @param {ISortStrategy} strategy
   */
  registerStrategy(strategyClass) {
    const instance = new strategyClass();
    this.strategies.set(instance.getStrategyId(), strategyClass);
    this.logger.info(`[SortManager] 注册排序策略: ${instance.getStrategyName()}`);
  }

  /**
   * 应用排序策略
   * @param {ISortStrategy} strategy
   * @returns {Promise<void>}
   */
  async applySort(strategy) {
    // 验证策略
    const validation = strategy.validate();
    if (!validation.valid) {
      throw new Error(`排序策略验证失败: ${validation.errors.join(', ')}`);
    }

    // 保存当前策略
    this.currentStrategy = strategy;
    const sortConfig = strategy.generateSortConfig();

    // 标记排序开始
    this.sortingState.isSorting = true;
    this.sortingState.pendingSort = sortConfig;

    this.logger.info('[SortManager] 开始排序', sortConfig);

    // 触发排序开始事件（显示状态条）
    this.eventBus.emit('pdf:sort:started', {
      config: sortConfig,
      timestamp: Date.now()
    });

    try {
      // 发送排序请求到后端
      this.eventBus.emit('pdf:sort:request', {
        config: sortConfig
      });

      // 同时执行前端本地排序（立即反馈）
      this.eventBus.emit('pdf:sort:local-execute', {
        strategy: strategy
      });

    } catch (error) {
      this.logger.error('[SortManager] 排序失败', error);
      this._handleSortComplete(false, error.message);
      throw error;
    }
  }

  /**
   * 取消排序
   */
  cancelSort() {
    if (!this.sortingState.isSorting) return;

    this.logger.info('[SortManager] 取消排序');

    this.sortingState.isSorting = false;
    this.sortingState.pendingSort = null;

    this.eventBus.emit('pdf:sort:cancelled', {
      timestamp: Date.now()
    });
  }

  /**
   * 重置排序（恢复默认顺序）
   */
  resetSort() {
    this.logger.info('[SortManager] 重置排序');

    this.currentStrategy = null;
    this.sortingState.lastSortConfig = null;

    this.eventBus.emit('pdf:sort:reset', {
      timestamp: Date.now()
    });
  }

  /**
   * 获取当前排序状态
   */
  getCurrentSortState() {
    return {
      isSorting: this.sortingState.isSorting,
      currentConfig: this.currentStrategy?.serialize() || null,
      lastConfig: this.sortingState.lastSortConfig
    };
  }

  /**
   * 处理排序完成
   * @private
   */
  _handleSortComplete(success, message = '') {
    this.sortingState.isSorting = false;

    if (success) {
      this.sortingState.lastSortConfig = this.sortingState.pendingSort;
      this.eventBus.emit('pdf:sort:completed', {
        config: this.sortingState.pendingSort,
        timestamp: Date.now()
      });
    } else {
      this.eventBus.emit('pdf:sort:failed', {
        config: this.sortingState.pendingSort,
        error: message,
        timestamp: Date.now()
      });
    }

    this.sortingState.pendingSort = null;
  }

  /**
   * 设置事件监听
   * @private
   */
  _setupEventListeners() {
    // 监听后端排序响应
    this.eventBus.on('pdf:sort:response', (data) => {
      this.logger.info('[SortManager] 收到后端排序响应', data);
      this._handleSortComplete(data.success, data.message);
    });

    // 监听本地排序完成
    this.eventBus.on('pdf:sort:local-completed', (data) => {
      this.logger.info('[SortManager] 前端本地排序完成');
    });
  }
}
```

#### 5. 排序 UI 组件
```javascript
/**
 * 排序控制面板 UI 组件
 */
class SortControlPanel {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;
    this.container = null;
    this.isActive = false;

    this._createUI();
    this._setupEventListeners();
  }

  /**
   * 创建 UI 结构
   * @private
   */
  _createUI() {
    const html = `
      <div id="sort-control-panel" class="sort-control-panel" hidden>
        <div class="sort-control-header">
          <h4>排序设置</h4>
          <button class="close-btn" aria-label="关闭">&times;</button>
        </div>

        <div class="sort-control-body">
          <!-- 字段选择 -->
          <div class="form-group">
            <label for="sort-field">排序字段</label>
            <select id="sort-field" class="form-control">
              <option value="">-- 请选择字段 --</option>
              <option value="filename">文件名</option>
              <option value="created_at">创建时间</option>
              <option value="updated_at">修改时间</option>
              <option value="file_size">文件大小</option>
              <option value="page_count">页数</option>
            </select>
          </div>

          <!-- 排序方向 -->
          <div class="form-group">
            <label>排序方向</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="sort-order" value="asc" checked>
                <span>升序 (A→Z, 小→大)</span>
              </label>
              <label>
                <input type="radio" name="sort-order" value="desc">
                <span>降序 (Z→A, 大→小)</span>
              </label>
            </div>
          </div>

          <!-- 数据类型提示 -->
          <div class="form-group">
            <label>数据类型</label>
            <div class="data-type-hint">
              <span id="data-type-display">自动检测</span>
            </div>
          </div>

          <!-- 当前排序规则显示 -->
          <div class="current-sort-info" id="current-sort-info" hidden>
            <div class="info-label">当前排序:</div>
            <div class="info-content" id="current-sort-display"></div>
          </div>
        </div>

        <div class="sort-control-footer">
          <button id="sort-apply-btn" class="btn btn-primary" disabled>
            <span class="btn-text">应用排序</span>
          </button>
          <button id="sort-cancel-btn" class="btn btn-secondary" hidden>
            取消排序
          </button>
          <button id="sort-reset-btn" class="btn btn-secondary">
            重置排序
          </button>
        </div>
      </div>
    `;

    // 插入 DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim();
    this.container = tempDiv.firstChild;
    document.body.appendChild(this.container);
  }

  /**
   * 显示面板
   */
  show() {
    this.container.hidden = false;
    this.eventBus.emit('sort-panel:shown');
  }

  /**
   * 隐藏面板
   */
  hide() {
    this.container.hidden = true;
    this.eventBus.emit('sort-panel:hidden');
  }

  /**
   * 切换面板显示
   */
  toggle() {
    if (this.container.hidden) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 更新当前排序信息显示
   */
  updateCurrentSortDisplay(config) {
    const infoDiv = this.container.querySelector('#current-sort-info');
    const displayDiv = this.container.querySelector('#current-sort-display');

    if (!config) {
      infoDiv.hidden = true;
      return;
    }

    infoDiv.hidden = false;
    displayDiv.textContent = `${config.field} (${config.order === 'asc' ? '升序' : '降序'})`;
  }

  /**
   * 设置事件监听
   * @private
   */
  _setupEventListeners() {
    const fieldSelect = this.container.querySelector('#sort-field');
    const applyBtn = this.container.querySelector('#sort-apply-btn');
    const cancelBtn = this.container.querySelector('#sort-cancel-btn');
    const resetBtn = this.container.querySelector('#sort-reset-btn');
    const closeBtn = this.container.querySelector('.close-btn');

    // 字段选择变化
    fieldSelect.addEventListener('change', () => {
      const isSelected = fieldSelect.value !== '';
      applyBtn.disabled = !isSelected;
    });

    // 应用排序按钮
    applyBtn.addEventListener('click', () => {
      const field = fieldSelect.value;
      const order = this.container.querySelector('input[name="sort-order"]:checked').value;

      if (!field) return;

      // 创建排序策略
      const strategy = new FieldSortStrategy({ field, order });

      // 触发排序事件
      this.eventBus.emit('sort:apply-requested', { strategy });

      // 切换按钮状态
      this.isActive = true;
      applyBtn.hidden = true;
      cancelBtn.hidden = false;
      applyBtn.querySelector('.btn-text').textContent = '排序中...';
    });

    // 取消排序按钮
    cancelBtn.addEventListener('click', () => {
      this.eventBus.emit('sort:cancel-requested');

      // 恢复按钮状态
      this.isActive = false;
      applyBtn.hidden = false;
      cancelBtn.hidden = true;
      applyBtn.querySelector('.btn-text').textContent = '应用排序';
    });

    // 重置排序按钮
    resetBtn.addEventListener('click', () => {
      this.eventBus.emit('sort:reset-requested');
      fieldSelect.value = '';
      applyBtn.disabled = true;
      this.updateCurrentSortDisplay(null);
    });

    // 关闭按钮
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    // 监听排序完成事件
    this.eventBus.on('pdf:sort:completed', (data) => {
      this.isActive = false;
      applyBtn.hidden = false;
      cancelBtn.hidden = true;
      applyBtn.querySelector('.btn-text').textContent = '应用排序';
      this.updateCurrentSortDisplay(data.config);
    });

    // 监听排序失败事件
    this.eventBus.on('pdf:sort:failed', () => {
      this.isActive = false;
      applyBtn.hidden = false;
      cancelBtn.hidden = true;
      applyBtn.querySelector('.btn-text').textContent = '应用排序';
    });
  }
}

/**
 * 排序状态指示器组件
 */
class SortStatusBar {
  constructor(dependencies) {
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger;
    this.container = null;

    this._createUI();
    this._setupEventListeners();
  }

  /**
   * 创建 UI 结构
   * @private
   */
  _createUI() {
    const html = `
      <div id="sort-status-bar" class="sort-status-bar" hidden>
        <div class="status-content">
          <div class="spinner"></div>
          <span class="status-text">正在排序...</span>
          <span class="status-detail" id="sort-status-detail"></span>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim();
    this.container = tempDiv.firstChild;
    document.body.appendChild(this.container);
  }

  /**
   * 显示状态条
   */
  show(message = '正在排序...') {
    this.container.hidden = false;
    this.container.querySelector('.status-text').textContent = message;
  }

  /**
   * 隐藏状态条
   */
  hide() {
    this.container.hidden = true;
  }

  /**
   * 更新详细信息
   */
  updateDetail(detail) {
    this.container.querySelector('#sort-status-detail').textContent = detail;
  }

  /**
   * 设置事件监听
   * @private
   */
  _setupEventListeners() {
    // 监听排序开始
    this.eventBus.on('pdf:sort:started', (data) => {
      const field = data.config.field || '未知字段';
      const order = data.config.order === 'asc' ? '升序' : '降序';
      this.show(`正在排序: ${field} (${order})`);
    });

    // 监听本地排序完成
    this.eventBus.on('pdf:sort:local-completed', () => {
      this.updateDetail('前端排序完成，等待后端确认...');
    });

    // 监听排序完成
    this.eventBus.on('pdf:sort:completed', () => {
      this.updateDetail('排序完成');
      setTimeout(() => this.hide(), 1000);
    });

    // 监听排序失败
    this.eventBus.on('pdf:sort:failed', (data) => {
      this.updateDetail(`排序失败: ${data.error}`);
      setTimeout(() => this.hide(), 3000);
    });

    // 监听排序取消
    this.eventBus.on('pdf:sort:cancelled', () => {
      this.updateDetail('排序已取消');
      setTimeout(() => this.hide(), 1000);
    });
  }
}
```

### 后端协议设计

#### WebSocket 消息格式
```json
// 前端 → 后端：排序请求
{
  "type": "pdf:sort:request",
  "request_id": "req_sort_12345",
  "timestamp": "2025-10-02T00:19:02Z",
  "data": {
    "config": {
      "strategy": "field-sort",
      "field": "created_at",
      "order": "desc",
      "dataType": "date",
      "version": "1.0"
    }
  }
}

// 后端 → 前端：排序响应
{
  "type": "pdf:sort:response",
  "request_id": "req_sort_12345",
  "timestamp": "2025-10-02T00:19:03Z",
  "data": {
    "success": true,
    "message": "排序完成",
    "sorted_count": 150
  }
}

// 后端 → 前端：更新后的列表（带排序字段）
{
  "type": "pdf:list:updated",
  "timestamp": "2025-10-02T00:19:03Z",
  "data": {
    "items": [
      {
        "id": "pdf_001",
        "filename": "示例.pdf",
        "created_at": "2025-10-01 10:00:00",
        "sort_order": 1  // ← 新增：后端计算的排序顺序
      },
      // ...
    ],
    "sort_config": {  // ← 新增：当前生效的排序配置
      "strategy": "field-sort",
      "field": "created_at",
      "order": "desc"
    }
  }
}
```

## 约束条件

### 仅修改 pdf-home 模块代码
仅在 `src/frontend/pdf-home/` 目录下添加新代码，不修改其他模块。

允许的新增文件：
- `src/frontend/pdf-home/sort/sort-manager.js` - 排序管理器
- `src/frontend/pdf-home/sort/sort-strategy.js` - 排序策略接口和实现
- `src/frontend/pdf-home/ui/sort-control-panel.js` - 排序控制面板
- `src/frontend/pdf-home/ui/sort-status-bar.js` - 排序状态指示器
- `src/frontend/pdf-home/__tests__/sort-manager.test.js` - 单元测试
- `src/frontend/pdf-home/__tests__/sort-strategy.test.js` - 单元测试

### 严格遵循代码规范和标准
必须优先阅读和理解以下规范：
1. `src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json`
2. `docs/SPEC/FRONTEND-EVENT-BUS-001.md`
3. `docs/SPEC/FRONTEND-EVENT-NAMING-001.md`
4. `docs/SPEC/JAVASCRIPT-CLASS-STRUCTURE-001.md`
5. `docs/SPEC/JAVASCRIPT-FUNCTION-DESIGN-001.md`

### 架构设计原则
1. **策略模式**：所有排序逻辑必须通过策略接口实现，不可硬编码
2. **开闭原则**：对扩展开放，对修改关闭，新增排序策略不应修改现有代码
3. **单一职责**：Manager 负责协调，Strategy 负责算法，UI 负责展示
4. **依赖注入**：所有组件通过构造函数注入依赖，便于测试
5. **事件驱动**：组件间通过 EventBus 解耦，不直接调用

### 向后兼容性
- 保持现有 Tabulator 表格的点击列头排序功能
- 新排序系统作为增强功能，不破坏现有交互
- 支持从旧排序方式平滑迁移到新系统

## 可行验收标准

### 单元测试
1. **SortStrategy 测试覆盖率 ≥ 95%**
   - 测试 FieldSortStrategy 的数字/字符串/日期排序
   - 测试 null/undefined 值处理
   - 测试排序方向（升序/降序）
   - 测试数据类型自动检测
   - 测试策略序列化/反序列化

2. **SortManager 测试覆盖率 ≥ 90%**
   - 测试策略注册和应用
   - 测试排序状态管理
   - 测试事件触发流程
   - 测试错误处理
   - 测试取消和重置功能

3. **UI 组件测试覆盖率 ≥ 80%**
   - 测试控制面板显示/隐藏
   - 测试用户输入验证
   - 测试按钮状态切换
   - 测试状态条显示时机

### 端到端测试

#### 测试场景1: 基础字段排序
- **前置条件**: PDF-Home 显示包含至少 10 条记录的列表
- **操作步骤**:
  1. 点击排序按钮打开控制面板
  2. 选择"文件名"字段
  3. 选择"升序"
  4. 点击"应用排序"按钮
- **预期结果**:
  - 显示"正在排序..."状态条
  - 表格立即按文件名升序重新排列（前端排序）
  - 收到后端确认后，状态条显示"排序完成"并在 1 秒后消失
  - 控制面板显示当前排序规则
  - "应用排序"按钮变为"取消排序"

#### 测试场景2: 数字字段排序
- **前置条件**: PDF-Home 显示列表
- **操作步骤**:
  1. 打开排序控制面板
  2. 选择"文件大小"字段
  3. 选择"降序"
  4. 点击"应用排序"
- **预期结果**:
  - 文件按大小从大到小排列
  - 数字正确比较（不是字符串比较）
  - 例如: 100KB > 20KB > 5KB（而不是 5KB > 20KB > 100KB）

#### 测试场景3: 日期字段排序
- **前置条件**: PDF-Home 显示列表
- **操作步骤**:
  1. 打开排序控制面板
  2. 选择"创建时间"字段
  3. 选择"降序"（最新的在前）
  4. 点击"应用排序"
- **预期结果**:
  - 文件按创建时间从新到旧排列
  - 日期正确解析和比较
  - 状态条显示完整流程

#### 测试场景4: 取消排序
- **前置条件**: 已应用排序
- **操作步骤**:
  1. 点击"取消排序"按钮
- **预期结果**:
  - 发送取消请求到后端
  - 状态条显示"排序已取消"
  - 按钮恢复为"应用排序"状态
  - 表格恢复到排序前的顺序（或默认顺序）

#### 测试场景5: 重置排序
- **前置条件**: 已应用排序
- **操作步骤**:
  1. 点击"重置排序"按钮
- **预期结果**:
  - 清空字段选择
  - 清空当前排序规则显示
  - 表格恢复默认顺序
  - 禁用"应用排序"按钮

#### 测试场景6: 状态条关闭条件
- **前置条件**: 点击"应用排序"
- **操作步骤**:
  1. 观察状态条变化
- **预期结果**:
  - 排序开始时立即显示
  - 前端排序完成后更新为"等待后端确认..."
  - 收到后端 `pdf:sort:response` 成功响应后显示"排序完成"
  - 1 秒后自动关闭

#### 测试场景7: 后端排序字段应用
- **前置条件**: 后端返回带 `sort_order` 字段的列表
- **操作步骤**:
  1. 应用排序
  2. 等待后端响应
- **预期结果**:
  - 后端返回的 `items` 数组包含 `sort_order` 字段
  - 前端按 `sort_order` 重新排列表格
  - 即使前端本地排序结果不同，也以后端为准

### 接口实现

#### 接口1: ISortStrategy.sortLocally()
- **函数**: `sortLocally(data)`
- **描述**: 执行前端本地排序，返回排序后的新数组
- **参数**:
  - `data`: Array<Object> - 待排序的 PDF 记录数组
- **返回值**: Array<Object> - 排序后的新数组（不修改原数组）
- **异常**:
  - 若策略参数无效，抛出 `ValidationError`
  - 若数据格式错误，抛出 `DataFormatError`

#### 接口2: SortManager.applySort()
- **函数**: `async applySort(strategy)`
- **描述**: 应用指定的排序策略
- **参数**:
  - `strategy`: ISortStrategy - 排序策略实例
- **返回值**: Promise<void>
- **事件触发**:
  - 开始: `pdf:sort:started`
  - 本地完成: `pdf:sort:local-completed`
  - 后端确认: `pdf:sort:completed`
  - 失败: `pdf:sort:failed`

#### 接口3: SortManager.registerStrategy()
- **函数**: `registerStrategy(strategyClass)`
- **描述**: 注册新的排序策略类
- **参数**:
  - `strategyClass`: Class - 实现 ISortStrategy 接口的类
- **返回值**: void
- **异常**: 若类未实现必需接口，抛出 `InterfaceError`

#### 接口4: SortControlPanel.updateCurrentSortDisplay()
- **函数**: `updateCurrentSortDisplay(config)`
- **描述**: 更新当前排序规则的显示
- **参数**:
  - `config`: Object | null - 排序配置对象
- **返回值**: void

### 类实现

#### 类1: ISortStrategy
- **类**: `ISortStrategy`
- **描述**: 排序策略抽象接口（所有策略的基类）
- **属性**: 无（接口类）
- **方法**:
  - `getStrategyId()`: 返回策略唯一标识
  - `getStrategyName()`: 返回策略显示名称
  - `generateSortConfig()`: 生成排序配置对象
  - `sortLocally(data)`: 执行前端排序
  - `validate()`: 验证策略参数
  - `serialize()`: 序列化配置
  - `deserialize(config)`: 反序列化配置

#### 类2: FieldSortStrategy
- **类**: `FieldSortStrategy extends ISortStrategy`
- **描述**: 字段排序策略（v001 基础实现）
- **属性**:
  - `field`: string - 排序字段名
  - `order`: 'asc' | 'desc' - 排序方向
  - `dataType`: 'number' | 'string' | 'date' | 'auto' - 数据类型
- **方法**:
  - `sortLocally(data)`: 按字段排序，自动检测数据类型
  - `_detectDataType(data, field)`: 私有方法，自动检测字段类型

#### 类3: SortManager
- **类**: `SortManager`
- **描述**: 排序功能的业务协调器
- **属性**:
  - `eventBus`: EventBus - 事件总线实例
  - `logger`: Logger - 日志记录器
  - `currentStrategy`: ISortStrategy - 当前排序策略
  - `sortingState`: Object - 排序状态对象
  - `strategies`: Map - 注册的策略类映射
- **方法**:
  - `registerStrategy(strategyClass)`: 注册排序策略
  - `applySort(strategy)`: 应用排序
  - `cancelSort()`: 取消排序
  - `resetSort()`: 重置排序
  - `getCurrentSortState()`: 获取当前状态
  - `_handleSortComplete(success, message)`: 处理排序完成
  - `_setupEventListeners()`: 设置事件监听

#### 类4: SortControlPanel
- **类**: `SortControlPanel`
- **描述**: 排序控制面板 UI 组件
- **属性**:
  - `eventBus`: EventBus - 事件总线
  - `logger`: Logger - 日志记录器
  - `container`: HTMLElement - 容器元素
  - `isActive`: boolean - 是否正在排序
- **方法**:
  - `show()`: 显示面板
  - `hide()`: 隐藏面板
  - `toggle()`: 切换显示
  - `updateCurrentSortDisplay(config)`: 更新当前排序显示
  - `_createUI()`: 创建 UI 结构
  - `_setupEventListeners()`: 设置事件监听

#### 类5: SortStatusBar
- **类**: `SortStatusBar`
- **描述**: 排序状态指示器组件
- **属性**:
  - `eventBus`: EventBus - 事件总线
  - `logger`: Logger - 日志记录器
  - `container`: HTMLElement - 容器元素
- **方法**:
  - `show(message)`: 显示状态条
  - `hide()`: 隐藏状态条
  - `updateDetail(detail)`: 更新详细信息
  - `_createUI()`: 创建 UI 结构
  - `_setupEventListeners()`: 设置事件监听

### 事件规范

#### 事件1: pdf:sort:started
- **描述**: 排序开始时触发
- **触发时机**: SortManager.applySort() 调用后立即触发
- **参数**:
  ```javascript
  {
    config: {
      strategy: 'field-sort',
      field: 'created_at',
      order: 'desc',
      dataType: 'date'
    },
    timestamp: 1696204742000
  }
  ```
- **监听者**: SortStatusBar（显示状态条）

#### 事件2: pdf:sort:request
- **描述**: 向后端发送排序请求
- **触发时机**: 排序开始后，发送到 WebSocket 服务器
- **参数**:
  ```javascript
  {
    config: {
      strategy: 'field-sort',
      field: 'created_at',
      order: 'desc',
      dataType: 'date',
      version: '1.0'
    }
  }
  ```
- **监听者**: WebSocket 客户端（WSClient）

#### 事件3: pdf:sort:local-execute
- **描述**: 请求执行前端本地排序
- **触发时机**: 与后端请求同时触发
- **参数**:
  ```javascript
  {
    strategy: FieldSortStrategy实例
  }
  ```
- **监听者**: TableWrapper 或 PDFManager（执行本地排序）

#### 事件4: pdf:sort:local-completed
- **描述**: 前端本地排序完成
- **触发时机**: 本地数据排序并更新表格后
- **参数**:
  ```javascript
  {
    count: 150,  // 排序的记录数
    timestamp: 1696204743000
  }
  ```
- **监听者**: SortStatusBar（更新状态为"等待后端确认"）

#### 事件5: pdf:sort:response
- **描述**: 后端排序响应
- **触发时机**: 后端处理完排序请求后通过 WebSocket 返回
- **参数**:
  ```javascript
  {
    success: true,
    message: '排序完成',
    sorted_count: 150
  }
  ```
- **监听者**: SortManager（处理排序完成）

#### 事件6: pdf:sort:completed
- **描述**: 排序完全完成（前端+后端都确认）
- **触发时机**: 收到后端成功响应后
- **参数**:
  ```javascript
  {
    config: {...},  // 生效的排序配置
    timestamp: 1696204744000
  }
  ```
- **监听者**:
  - SortStatusBar（显示"排序完成"并关闭）
  - SortControlPanel（恢复按钮状态）

#### 事件7: pdf:sort:failed
- **描述**: 排序失败
- **触发时机**: 验证失败或后端返回错误
- **参数**:
  ```javascript
  {
    config: {...},
    error: '后端处理失败: 无效字段',
    timestamp: 1696204744000
  }
  ```
- **监听者**:
  - SortStatusBar（显示错误信息）
  - SortControlPanel（恢复按钮状态）

#### 事件8: pdf:sort:cancelled
- **描述**: 用户取消排序
- **触发时机**: 用户点击"取消排序"按钮
- **参数**:
  ```javascript
  {
    timestamp: 1696204745000
  }
  ```
- **监听者**:
  - SortStatusBar（显示"已取消"并关闭）
  - 后端（停止排序处理）

#### 事件9: pdf:sort:reset
- **描述**: 重置排序到默认状态
- **触发时机**: 用户点击"重置排序"按钮
- **参数**:
  ```javascript
  {
    timestamp: 1696204746000
  }
  ```
- **监听者**:
  - TableWrapper（恢复默认顺序）
  - SortControlPanel（清空选择）

#### 事件10: sort:apply-requested (UI 层事件)
- **描述**: 用户请求应用排序
- **触发时机**: 用户点击"应用排序"按钮
- **参数**:
  ```javascript
  {
    strategy: FieldSortStrategy实例
  }
  ```
- **监听者**: SortManager（调用 applySort）

## 技术细节

### CSS 样式要求
```css
/* 排序控制面板 */
.sort-control-panel {
  position: fixed;
  right: 20px;
  top: 80px;
  width: 320px;
  background: var(--panel-bg, #fff);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 16px;
}

.sort-control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.sort-control-body .form-group {
  margin-bottom: 16px;
}

.sort-control-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 排序状态条 */
.sort-status-bar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--info-bg, #2196F3);
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sort-status-bar .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .sort-control-panel {
    --panel-bg: #2d2d2d;
    --border-color: #555;
  }
}
```

### 性能优化
1. **大数据量排序优化**:
   - 超过 1000 条记录时，使用 Web Worker 进行后台排序
   - 使用虚拟滚动技术，仅渲染可见区域

2. **防抖处理**:
   - 用户快速切换排序字段时，延迟 300ms 再触发排序

3. **缓存策略**:
   - 缓存最近 5 次排序结果，快速恢复

4. **增量更新**:
   - 如果数据变化小于 10%，使用增量排序而非全量

### 错误处理策略
1. **前端验证失败**:
   - 显示友好提示："请选择排序字段"
   - 禁用"应用排序"按钮

2. **后端排序失败**:
   - 保持前端排序结果，显示警告
   - 提供"重试"按钮

3. **网络超时**:
   - 10 秒超时后自动取消
   - 显示"网络超时，已应用本地排序"

### 日志记录
- 所有排序操作记录到 `logs/pdf-home-js.log`
- 格式: `[SortManager] 应用排序: field=created_at, order=desc`
- 包含排序耗时统计

## 未来扩展点 (v002+)

### 多级排序
```javascript
class MultiLevelSortStrategy extends ISortStrategy {
  constructor(levels = []) {
    super();
    // levels: [{field, order}, {field, order}, ...]
    this.levels = levels;
  }

  sortLocally(data) {
    return data.sort((a, b) => {
      for (const level of this.levels) {
        const result = this._compareByField(a, b, level.field, level.order);
        if (result !== 0) return result;
      }
      return 0;
    });
  }
}
```

### 自定义排序规则
```javascript
class CustomSortStrategy extends ISortStrategy {
  constructor(compareFn, name) {
    super();
    this.compareFn = compareFn;
    this.customName = name;
  }

  sortLocally(data) {
    return data.sort(this.compareFn);
  }
}

// 使用示例：按文件扩展名和大小组合排序
const customSort = new CustomSortStrategy(
  (a, b) => {
    const extA = a.filename.split('.').pop();
    const extB = b.filename.split('.').pop();
    if (extA !== extB) return extA.localeCompare(extB);
    return a.file_size - b.file_size;
  },
  '按扩展名和大小'
);
```

### 排序模板保存
```javascript
class SortTemplateManager {
  saveTemplate(name, strategy) {
    const config = strategy.serialize();
    localStorage.setItem(`sort-template-${name}`, JSON.stringify(config));
  }

  loadTemplate(name) {
    const json = localStorage.getItem(`sort-template-${name}`);
    if (!json) return null;
    const config = JSON.parse(json);
    // 根据 strategy 类型创建相应实例
    return this._createStrategyFromConfig(config);
  }

  listTemplates() {
    // 返回所有保存的模板列表
  }
}
```

### 拖拽式排序规则配置
- 使用拖拽库（如 Sortable.js）
- 可视化配置多级排序
- 实时预览排序效果

## 开发顺序建议

### Phase 1: 核心架构 (1天)
1. 实现 `ISortStrategy` 接口
2. 实现 `FieldSortStrategy` 基础策略
3. 实现 `SortManager` 核心逻辑
4. 编写单元测试

### Phase 2: UI 组件 (1天)
1. 实现 `SortControlPanel` 控制面板
2. 实现 `SortStatusBar` 状态指示器
3. 编写 CSS 样式
4. 测试 UI 交互

### Phase 3: 集成和事件流 (1天)
1. 集成到 pdf-home 主应用
2. 实现事件监听和触发
3. 对接 WebSocket 通信
4. 端到端测试

### Phase 4: 后端支持 (1天)
1. 后端实现 `pdf:sort:request` 处理器
2. 实现 `sort_order` 字段计算
3. 更新 `pdf:list:updated` 响应格式
4. 测试前后端协同

### Phase 5: 优化和文档 (0.5天)
1. 性能优化（大数据量测试）
2. 错误处理完善
3. 编写使用文档
4. 代码审查

## 风险评估

### 高风险项
1. **大数据量性能**:
   - 风险: 超过 1000 条记录时前端排序可能卡顿
   - 缓解: 使用 Web Worker 或分批处理

2. **后端排序字段设计**:
   - 风险: `sort_order` 字段可能与现有字段冲突
   - 缓解: 使用嵌套对象 `_sort: {order, field}`

### 中风险项
1. **排序策略扩展复杂度**:
   - 风险: 多级排序等复杂策略难以实现
   - 缓解: v001 先实现简单策略，逐步扩展

2. **UI 响应延迟**:
   - 风险: 排序状态条关闭时机难以精确控制
   - 缓解: 设置合理超时和降级策略

## 成功度量标准
- 排序响应时间 < 500ms（100 条记录）
- 排序正确率 100%（单元测试覆盖）
- 用户操作流畅度评分 ≥ 8/10
- 代码可扩展性评分 ≥ 9/10（支持新策略无需修改核心代码）
- 文档完整性评分 ≥ 9/10
