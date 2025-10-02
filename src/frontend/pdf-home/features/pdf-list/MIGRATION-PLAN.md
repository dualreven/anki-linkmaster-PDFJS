# PDFListFeature 迁移计划

## 现有代码分析

### 代码分布统计
| 文件 | 行数 | 职责 | 迁移目标 |
|------|------|------|----------|
| `table-wrapper.js` | 34 | 简单封装 | `components/pdf-table.js` |
| `table-wrapper-core.js` | 259 | 核心类，组合各模块 | `components/pdf-table.js` (整合) |
| `table-utils.js` | 218 | Tabulator工具函数 | `services/table-utils.js` |
| `table/table-core-initializer.js` | 288 | Tabulator初始化 | `services/table-initializer.js` |
| `table/table-data-handler.js` | 420 | 数据处理、更新 | `services/list-data-service.js` |
| `table/table-lifecycle-manager.js` | 339 | 生命周期管理 | `services/list-lifecycle-service.js` |
| `core/managers/table-configuration-manager.js` | 417 | 表格配置管理 | `state/list-state.js` + `services/config-service.js` |
| `ui/handlers/table-event-handler.js` | 118 | UI事件处理 | `components/pdf-table.js` (整合) |
| **总计** | **2,093** | | |

---

## 目标目录结构

```
features/pdf-list/
├── index.js                          # 功能域入口（已存在框架）
├── feature.config.js                 # 功能配置（已存在）
├── components/                       # UI 组件层
│   ├── pdf-table.js                  # PDF 表格组件（整合 wrapper + core + event-handler）
│   └── table-toolbar.js              # 表格工具栏（未来扩展）
├── services/                         # 业务逻辑层
│   ├── list-data-service.js          # 数据服务（table-data-handler 迁移）
│   ├── list-lifecycle-service.js     # 生命周期服务（table-lifecycle-manager 迁移）
│   ├── table-initializer.js          # Tabulator 初始化服务（table-core-initializer 迁移）
│   ├── config-service.js             # 配置服务（table-configuration-manager 部分）
│   └── table-utils.js                # 表格工具函数（table-utils 迁移）
├── state/                            # 状态管理层
│   └── list-state.js                 # 列表状态定义（使用 StateManager）
└── __tests__/                        # 测试文件
    ├── pdf-table.test.js
    ├── list-data-service.test.js
    └── integration.test.js
```

---

## 分层架构设计

### 1. 组件层 (Components)
**职责**: UI 渲染和用户交互

```javascript
// components/pdf-table.js
class PDFTable {
  #container;
  #tabulator;
  #eventBus;      // ScopedEventBus (@pdf-list namespace)
  #state;         // StateManager state
  #dataService;
  #lifecycleService;

  constructor(container, { eventBus, state, dataService, lifecycleService }) {
    this.#container = container;
    this.#eventBus = eventBus;
    this.#state = state;
    this.#dataService = dataService;
    this.#lifecycleService = lifecycleService;
  }

  async initialize() {
    // 初始化 Tabulator
    // 设置事件监听
    // 订阅状态变化
  }

  // UI 交互方法
  selectRow(index) { }
  highlightRow(index) { }
  scrollToRow(index) { }
}
```

**来源整合**:
- `table-wrapper.js` (34行)
- `table-wrapper-core.js` (259行) - 组合逻辑
- `ui/handlers/table-event-handler.js` (118行) - 事件处理
- **总计**: ~411行 → 整合后预计 ~350行

---

### 2. 服务层 (Services)
**职责**: 业务逻辑、数据处理、外部通信

#### 2.1 list-data-service.js
**职责**: PDF 列表数据的 CRUD 操作

```javascript
// services/list-data-service.js
class ListDataService {
  #eventBus;
  #state;

  constructor({ eventBus, state }) {
    this.#eventBus = eventBus;
    this.#state = state;
  }

  // 数据操作
  async loadList() { }
  async addPDF(pdfData) { }
  async removePDF(filename) { }
  async updatePDF(filename, updates) { }

  // 状态同步
  syncWithTable(tableData) { }
}
```

**来源**: `table/table-data-handler.js` (420行)
**预计**: ~400行

---

#### 2.2 list-lifecycle-service.js
**职责**: 表格生命周期管理（初始化、销毁、刷新）

```javascript
// services/list-lifecycle-service.js
class ListLifecycleService {
  #eventBus;
  #state;

  constructor({ eventBus, state }) {
    this.#eventBus = eventBus;
    this.#state = state;
  }

  async initialize() { }
  async refresh() { }
  async destroy() { }

  // 生命周期钩子
  onBeforeLoad() { }
  onAfterLoad() { }
}
```

**来源**: `table/table-lifecycle-manager.js` (339行)
**预计**: ~350行

---

#### 2.3 table-initializer.js
**职责**: Tabulator 实例创建和配置

```javascript
// services/table-initializer.js
class TableInitializer {
  static createTabulator(container, config) {
    // Tabulator 初始化逻辑
  }

  static getDefaultConfig() {
    // 默认配置
  }
}
```

**来源**: `table/table-core-initializer.js` (288行)
**预计**: ~300行

---

#### 2.4 config-service.js
**职责**: 表格配置管理

```javascript
// services/config-service.js
class ConfigService {
  #state;

  constructor({ state }) {
    this.#state = state;
  }

  getTableConfig() { }
  updateColumnConfig(columnName, config) { }
  resetConfig() { }
}
```

**来源**: `core/managers/table-configuration-manager.js` (417行，部分)
**预计**: ~200行

---

#### 2.5 table-utils.js
**职责**: Tabulator 工具函数

```javascript
// services/table-utils.js
export class TableUtils {
  static runTabulatorSmokeTest() { }
  static validateTabulatorInstance(tabulator) { }
  // ... 其他工具函数
}
```

**来源**: `table-utils.js` (218行)
**预计**: ~220行

---

### 3. 状态层 (State)
**职责**: 状态定义和管理

```javascript
// state/list-state.js
export const LIST_STATE_SCHEMA = {
  // 列表数据
  items: [],
  selectedItems: [],

  // UI 状态
  isLoading: false,
  sortColumn: null,
  sortDirection: 'asc',
  filters: {},

  // 表格配置
  columnConfig: {
    // 列配置
  },

  // 分页
  pagination: {
    page: 1,
    pageSize: 50,
    total: 0
  }
};

export function createListState(stateManager) {
  return stateManager.createState('pdf-list', LIST_STATE_SCHEMA);
}
```

**来源**: `core/managers/table-configuration-manager.js` (417行，部分)
**预计**: ~150行

---

## 架构集成点

### 1. 依赖注入（DependencyContainer）

```javascript
// index.js - install() 方法
async install() {
  const container = this.container;

  // 注册服务
  container.register('listDataService', () => new ListDataService({
    eventBus: this.eventBus,
    state: this.state
  }));

  container.register('listLifecycleService', () => new ListLifecycleService({
    eventBus: this.eventBus,
    state: this.state
  }));

  // 注册组件
  container.register('pdfTable', () => new PDFTable(
    document.querySelector('#pdf-table-container'),
    {
      eventBus: this.eventBus,
      state: this.state,
      dataService: container.resolve('listDataService'),
      lifecycleService: container.resolve('listLifecycleService')
    }
  ));
}
```

---

### 2. 状态管理（StateManager）

```javascript
// index.js - install() 方法
async install() {
  const stateManager = this.container.resolve('stateManager');

  // 创建功能域状态
  this.state = createListState(stateManager);

  // 监听状态变化
  this.state.watch('items', (newItems, oldItems) => {
    this.eventBus.emit('data:changed', { newItems, oldItems });
  });
}
```

---

### 3. 事件通信（ScopedEventBus）

**命名规范**: `@pdf-list/{category}:{action}:{status}`

```javascript
// 事件定义
const PDF_LIST_EVENTS = {
  // 数据事件
  DATA_LOAD_REQUESTED: 'data:load:requested',
  DATA_LOAD_COMPLETED: 'data:load:completed',
  DATA_LOAD_FAILED: 'data:load:failed',

  // 选择事件
  ROW_SELECTED: 'row:selected',
  ROW_DESELECTED: 'row:deselected',

  // 操作事件
  PDF_ADD_REQUESTED: 'pdf:add:requested',
  PDF_REMOVE_REQUESTED: 'pdf:remove:requested',
  PDF_UPDATE_REQUESTED: 'pdf:update:requested',
};

// 使用
this.eventBus.emit('data:load:requested');
// 实际发出: @pdf-list/data:load:requested
```

---

## 迁移步骤

### 阶段 1: 创建目录和基础框架 (1h)
- [x] 创建目录结构
- [ ] 创建空的服务类和组件类
- [ ] 定义状态 schema
- [ ] 定义事件常量

### 阶段 2: 迁移核心服务 (3h)
- [ ] 迁移 `table-utils.js` → `services/table-utils.js`
- [ ] 迁移 `table-core-initializer.js` → `services/table-initializer.js`
- [ ] 迁移 `table-data-handler.js` → `services/list-data-service.js`
- [ ] 迁移 `table-lifecycle-manager.js` → `services/list-lifecycle-service.js`

### 阶段 3: 迁移配置和状态 (2h)
- [ ] 迁移 `table-configuration-manager.js` → `state/list-state.js` + `services/config-service.js`
- [ ] 集成 StateManager

### 阶段 4: 整合组件 (2h)
- [ ] 整合 `table-wrapper.js` + `table-wrapper-core.js` + `table-event-handler.js` → `components/pdf-table.js`
- [ ] 集成 ScopedEventBus

### 阶段 5: 更新功能域入口 (1h)
- [ ] 实现 `install()` 方法
- [ ] 实现 `uninstall()` 方法
- [ ] 配置依赖注入

### 阶段 6: 测试和调试 (2h)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 浏览器测试

**总计预估**: 11小时

---

## 向后兼容策略

在迁移过程中，保留旧代码，通过 Feature Flag 控制：

```javascript
// pdf-home-app-v2.js
if (this.#flagManager.isEnabled('pdf-list')) {
  // 使用新的 PDFListFeature
  await this.#registry.install('pdf-list');
} else {
  // 使用旧的 table-wrapper
  // (保持 V1 架构的代码路径)
}
```

---

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 迁移过程中破坏现有功能 | 高 | 保留旧代码，Feature Flag 控制，充分测试 |
| 性能下降 | 中 | 性能基准测试，优化关键路径 |
| 状态同步问题 | 高 | 详细的状态变更日志，集成测试覆盖 |
| 事件命名冲突 | 低 | 使用 ScopedEventBus 自动命名空间隔离 |

---

## 测试策略

### 单元测试
- 每个服务类独立测试
- 使用 Mock 隔离依赖

### 集成测试
- PDFListFeature 完整生命周期测试
- 状态管理集成测试
- 事件通信集成测试

### E2E 测试
- 加载 PDF 列表
- 添加/删除 PDF
- 排序/筛选
- 选择/双击操作

---

**创建时间**: 2025-10-02
**状态**: 📋 设计完成，待执行
