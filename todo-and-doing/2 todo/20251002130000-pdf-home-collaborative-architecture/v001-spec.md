# PDF-Home 协同开发架构重构规格说明

**功能ID**: 20251002130000-pdf-home-collaborative-architecture
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 13:00:00
**预计完成**: 2025-10-08
**状态**: 设计中

## 现状说明

### 当前架构特点

PDF-Home 模块已初步实现模块化架构：

**核心组件**：
- `PDFHomeApp`: 应用主类，使用组合模式管理各个管理器
- `EventBus`: 全局单例事件总线，所有模块共享
- `PDFManager`: PDF 业务逻辑管理器（来自 common 模块）
- `UIManager`: UI 状态管理器
- `WSClient`: WebSocket 客户端（来自 common 模块）
- 专门的管理器：
  - `AppInitializationManager`: 应用初始化管理
  - `TableConfigurationManager`: 表格配置管理
  - `WebSocketEventManager`: WebSocket 事件管理

**目录结构**：
```
src/frontend/pdf-home/
├── index.js                 # 应用入口
├── core/
│   ├── pdf-home-app.js     # 核心应用类
│   └── managers/           # 专门的管理器
├── bootstrap/              # 启动引导
├── container/              # 依赖容器
├── table/                  # 表格相关
├── ui/                     # UI 相关
└── utils/                  # 工具函数
```

**依赖关系**：
```
PDFHomeApp
  ↓ 依赖
EventBus (全局单例) ← 所有模块共享
  ↓ 依赖
common/pdf/PDFManager
common/ws/WSClient
common/utils/Logger
```

### 技术架构亮点

1. **组合优于继承**：PDFHomeApp 通过组合管理器实现功能
2. **事件驱动**：模块间通过 EventBus 通信，避免直接依赖
3. **单一职责**：每个管理器专注于特定职责
4. **依赖注入**：通过 AppContainer 注入依赖

## 存在问题

### 1. 全局单例导致命名空间冲突

**问题描述**：
- EventBus 是全局单例（`eventBusSingleton`），所有模块共享
- 事件命名格式：`{module}:{action}:{status}`
- 多人协同开发时，事件名称容易冲突
- 例如：开发者 A 定义 `pdf:edit:requested`，开发者 B 也定义同名事件，导致相互干扰

**影响**：
- 必须人工协调事件命名，效率低
- 一个功能的事件监听器可能被另一个功能意外触发
- 难以追踪事件的来源和目标

### 2. 共享依赖导致紧耦合

**问题描述**：
- PDFManager、UIManager、WSClient 等都在 `common` 模块
- 所有功能直接依赖 common 模块的具体实现
- 修改 common 模块影响所有使用方

**影响**：
- 修改 common 模块需要回归测试所有功能
- 无法针对特定功能定制行为
- 版本升级困难（一改全改）

### 3. 缺少功能隔离机制

**问题描述**：
- 没有清晰的功能域（Feature Domain）划分
- 新功能的代码散落在多个目录（managers、ui、table 等）
- 难以定位某个功能的所有相关代码

**影响**：
- 协同开发时容易修改同一个文件，产生 Git 冲突
- 功能之间的边界模糊，容易引入意外依赖
- 无法单独测试某个功能

### 4. 缺少插件化架构

**问题描述**：
- 新功能必须修改核心代码（PDFHomeApp、managers 等）
- 功能无法独立开发、独立测试、独立部署
- 没有插件注册和生命周期管理机制

**影响**：
- 开发新功能时必须了解核心架构，学习成本高
- 无法实现功能的热插拔（动态加载/卸载）
- 测试时必须启动整个应用，无法单元测试插件

### 5. 状态管理分散

**问题描述**：
- 各个管理器维护自己的状态（`#isInitialized`、`#tableWrapper` 等）
- 没有统一的状态管理机制
- 状态变更难以追踪和调试

**影响**：
- 状态不一致问题难以排查
- 无法实现状态快照和回放（用于调试）
- 多个功能修改同一状态时容易冲突

### 6. 缺少版本和 Feature Flag 管理

**问题描述**：
- 功能之间没有版本隔离
- 无法通过配置开关功能（Feature Flag）
- 升级某个功能可能影响其他功能

**影响**：
- 无法实现灰度发布（部分用户启用新功能）
- 回滚困难（必须回滚整个应用）
- A/B 测试无法实施

## 提出需求

实现 **协同开发友好的插件化架构**，满足以下核心目标：

### 核心目标

1. **功能隔离**：每个功能作为独立的"功能域（Feature Domain）"开发
2. **命名空间隔离**：事件、状态、依赖都有独立的命名空间
3. **插件化**：新功能作为插件注册，无需修改核心代码
4. **依赖注入**：通过容器注入依赖，而非全局单例
5. **版本管理**：支持功能版本和 Feature Flag
6. **协同友好**：多人可并行开发不同功能，互不干扰

### 具体需求

#### 需求 1: 功能域（Feature Domain）机制

- 每个大功能独立为一个功能域（如 `pdf-list`、`pdf-editor`、`pdf-sorter`）
- 功能域拥有独立的目录结构：
  ```
  features/
  ├── pdf-list/
  │   ├── index.js          # 功能入口
  │   ├── feature.config.js # 功能配置
  │   ├── components/       # UI 组件
  │   ├── services/         # 业务逻辑
  │   ├── state/            # 状态管理
  │   └── events/           # 事件定义
  ```
- 功能域之间通过事件通信，禁止直接依赖

#### 需求 2: 命名空间事件系统

- EventBus 支持命名空间（scoped EventBus）
- 事件命名格式：`@{feature}/{module}:{action}:{status}`
  - 例如：`@pdf-list/table:row:selected`
- 功能域内部事件不会泄漏到全局
- 跨功能通信通过全局事件总线，使用明确的协议

#### 需求 3: 插件注册机制

- 提供 `FeatureRegistry` 类，管理功能的注册和生命周期
- 功能实现标准接口：
  ```javascript
  class Feature {
    get name() { return 'pdf-list'; }
    get version() { return '1.0.0'; }
    get dependencies() { return ['core', 'websocket']; }
    async install(context) { /* 安装逻辑 */ }
    async uninstall(context) { /* 卸载逻辑 */ }
  }
  ```
- 支持功能的安装、卸载、启用、禁用

#### 需求 4: 依赖注入容器增强

- 增强现有的 `AppContainer`，支持：
  - 服务注册（单例、工厂、值）
  - 作用域隔离（全局作用域、功能作用域）
  - 依赖解析和注入
- 废弃全局单例，改用容器管理

#### 需求 5: 统一状态管理

- 提供 `StateManager` 类，基于 Proxy 实现响应式状态
- 功能域拥有独立的状态命名空间
- 支持状态订阅、状态快照、状态回放

#### 需求 6: Feature Flag 机制

- 提供 `FeatureFlagManager` 类，管理功能开关
- 支持运行时启用/禁用功能
- 支持基于用户、环境的条件启用

## 解决方案

### 技术方案：渐进式重构

采用 **渐进式重构** 策略，分 6 个阶段实施，每个阶段保持向后兼容。

### 总体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       PDFHomeApp (Core)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Feature    │  │    State     │  │  Feature     │      │
│  │   Registry   │  │   Manager    │  │  Flag Mgr    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │ 管理
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Feature  │      │ Feature  │      │ Feature  │
    │ Domain 1 │      │ Domain 2 │      │ Domain 3 │
    │(pdf-list)│      │(editor)  │      │(sorter)  │
    └──────────┘      └──────────┘      └──────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │ 依赖注入
                ┌──────────▼──────────┐
                │   AppContainer      │
                │  (DI Container)     │
                └─────────────────────┘
                           │ 提供
                ┌──────────▼──────────┐
                │ EventBus (Scoped)   │
                │ WSClient            │
                │ Logger              │
                │ ...                 │
                └─────────────────────┘
```

### 核心设计

#### 1. 功能域（Feature Domain）

**定义**：
- 功能域是独立的功能单元，拥有完整的 UI、业务逻辑、状态管理
- 功能域通过标准接口与核心应用交互
- 功能域之间禁止直接依赖，只能通过事件通信

**目录结构**：
```
src/frontend/pdf-home/
├── core/                    # 核心架构（不变）
│   ├── app.js              # 核心应用
│   ├── feature-registry.js # 功能注册中心
│   ├── state-manager.js    # 状态管理器
│   └── container.js        # 依赖注入容器
├── features/               # 功能域目录（新增）
│   ├── pdf-list/          # PDF 列表功能域
│   │   ├── index.js       # 功能入口
│   │   ├── feature.config.js  # 功能配置
│   │   ├── components/    # UI 组件
│   │   │   ├── table.js
│   │   │   └── toolbar.js
│   │   ├── services/      # 业务逻辑
│   │   │   └── list-service.js
│   │   ├── state/         # 状态管理
│   │   │   └── list-state.js
│   │   ├── events/        # 事件定义
│   │   │   └── list-events.js
│   │   └── __tests__/     # 单元测试
│   ├── pdf-editor/        # PDF 编辑功能域
│   │   ├── index.js
│   │   ├── feature.config.js
│   │   ├── components/
│   │   │   ├── edit-modal.js
│   │   │   └── form-builder.js
│   │   ├── services/
│   │   │   └── edit-service.js
│   │   └── state/
│   └── pdf-sorter/        # PDF 排序功能域
│       └── ...
├── shared/                 # 共享工具（仅工具函数，无状态）
│   ├── utils/
│   └── constants/
└── plugins/                # 第三方插件（可选）
```

#### 2. 命名空间事件系统

**设计**：
- EventBus 支持作用域（Scoped EventBus）
- 功能域创建时自动分配命名空间
- 事件自动添加命名空间前缀

**示例**：
```javascript
// 功能域内部事件（私有）
eventBus.emit('table:row:selected', data);
// 实际事件名：@pdf-list/table:row:selected

// 跨功能通信（公共协议）
eventBus.emitGlobal('pdf:list:updated', data);
// 实际事件名：pdf:list:updated（无命名空间）
```

#### 3. 插件注册机制

**流程**：
```
1. 功能域定义 Feature 类
2. 调用 FeatureRegistry.register(feature)
3. FeatureRegistry 验证依赖
4. 解析依赖，按依赖顺序安装
5. 调用 feature.install(context)
6. 功能域初始化（事件监听、状态初始化等）
```

**Feature 接口**：
```javascript
interface IFeature {
  name: string;              // 功能名称（唯一）
  version: string;           // 版本号（SemVer）
  dependencies: string[];    // 依赖的功能或服务

  install(context: FeatureContext): Promise<void>;
  uninstall(context: FeatureContext): Promise<void>;
  enable?(): Promise<void>;
  disable?(): Promise<void>;
}
```

#### 4. 依赖注入容器增强

**功能**：
- 服务注册：`container.register('logger', LoggerService, { scope: 'singleton' })`
- 服务获取：`const logger = container.get('logger')`
- 作用域隔离：全局作用域、功能作用域
- 自动依赖解析

**示例**：
```javascript
// 注册服务
container.register('eventBus', EventBus, { scope: 'singleton' });
container.register('wsClient', WSClient, { scope: 'singleton', factory: true });

// 创建功能域作用域
const featureScope = container.createScope('pdf-list');

// 在功能域作用域内注册服务
featureScope.register('listService', ListService);

// 自动解析依赖
const listService = featureScope.get('listService');
// ListService 的构造函数依赖 eventBus，自动注入
```

#### 5. 统一状态管理

**设计**：
- 基于 Proxy 实现响应式状态
- 功能域拥有独立的状态命名空间
- 支持状态订阅、计算属性、状态快照

**示例**：
```javascript
// 创建功能域状态
const state = stateManager.createState('pdf-list', {
  records: [],
  selectedIds: [],
  filters: {}
});

// 响应式订阅
state.subscribe('records', (newRecords, oldRecords) => {
  console.log('Records changed:', newRecords);
});

// 修改状态（自动触发订阅）
state.records = [...state.records, newRecord];

// 计算属性
state.defineComputed('selectedRecords', () => {
  return state.records.filter(r => state.selectedIds.includes(r.id));
});

// 状态快照（用于调试）
const snapshot = state.snapshot();
state.restore(snapshot);
```

#### 6. Feature Flag 机制

**设计**：
- 配置文件定义功能开关
- 运行时查询功能是否启用
- 支持条件启用（用户、环境等）

**示例**：
```javascript
// feature-flags.config.js
export default {
  'pdf-editor': {
    enabled: true,
    conditions: {
      environments: ['development', 'staging']
    }
  },
  'pdf-sorter': {
    enabled: false  // 功能关闭，不会加载
  }
};

// 使用
if (featureFlagManager.isEnabled('pdf-editor')) {
  await featureRegistry.install('pdf-editor');
}
```

### 分阶段实施

#### Phase 1: 依赖注入容器增强（3 天）

**目标**：
- 增强 AppContainer，支持服务注册、作用域、依赖解析
- 迁移现有的全局单例到容器管理
- 保持向后兼容

**任务**：
1. 实现 `DependencyContainer` 类（增强版 AppContainer）
2. 实现服务注册 API（`register`, `get`, `has`）
3. 实现作用域管理（`createScope`, `getScope`）
4. 实现自动依赖解析
5. 迁移 EventBus、Logger、WSClient 到容器
6. 编写单元测试

**验收标准**：
- 所有现有功能正常运行
- 容器能管理至少 5 个服务
- 支持全局作用域和功能作用域
- 单元测试覆盖率 > 80%

---

#### Phase 2: 命名空间事件系统（3 天）

**目标**：
- EventBus 支持命名空间
- 功能域事件自动隔离
- 保持向后兼容（全局事件仍可用）

**任务**：
1. 实现 `ScopedEventBus` 类
2. 事件自动添加命名空间前缀
3. 实现 `emitGlobal` API（跨功能通信）
4. 迁移现有事件到命名空间系统
5. 编写单元测试

**验收标准**：
- 功能域事件不会泄漏到全局
- 全局事件仍能正常工作
- 事件名称符合规范：`@{feature}/{module}:{action}:{status}`
- 单元测试覆盖率 > 80%

---

#### Phase 3: 功能注册中心（4 天）

**目标**：
- 实现 `FeatureRegistry` 类
- 定义 `IFeature` 接口
- 实现功能的注册、安装、卸载

**任务**：
1. 定义 `IFeature` 接口和 `FeatureContext` 类型
2. 实现 `FeatureRegistry` 类
3. 实现依赖解析和安装顺序计算
4. 实现功能生命周期管理（install、uninstall、enable、disable）
5. 编写单元测试

**验收标准**：
- 能注册至少 3 个功能
- 依赖解析正确（按依赖顺序安装）
- 功能安装/卸载不影响其他功能
- 单元测试覆盖率 > 80%

---

#### Phase 4: 功能域重构（6 天）

**目标**：
- 将现有功能重构为功能域
- 创建 `pdf-list`、`pdf-editor`、`pdf-sorter` 三个功能域
- 验证功能域独立性

**任务**：
1. 创建功能域目录结构
2. 重构 PDF 列表功能为 `pdf-list` 功能域
3. 重构 PDF 编辑功能为 `pdf-editor` 功能域（新功能）
4. 重构 PDF 排序功能为 `pdf-sorter` 功能域（新功能）
5. 每个功能域实现 `IFeature` 接口
6. 编写功能域的单元测试

**验收标准**：
- 三个功能域独立运行
- 功能域之间通过事件通信
- 每个功能域有完整的单元测试
- 可以单独禁用某个功能域，其他功能正常运行

---

#### Phase 5: 统一状态管理（4 天）

**目标**：
- 实现 `StateManager` 类
- 功能域迁移到统一状态管理
- 支持状态快照和回放

**任务**：
1. 实现 `StateManager` 类（基于 Proxy）
2. 实现响应式状态订阅
3. 实现计算属性
4. 实现状态快照和恢复
5. 迁移功能域状态到 StateManager
6. 编写单元测试

**验收标准**：
- 状态变更自动触发订阅
- 功能域状态相互隔离
- 可以生成状态快照并恢复
- 单元测试覆盖率 > 80%

---

#### Phase 6: Feature Flag 机制（2 天）

**目标**：
- 实现 `FeatureFlagManager` 类
- 支持配置文件定义功能开关
- 运行时启用/禁用功能

**任务**：
1. 实现 `FeatureFlagManager` 类
2. 实现配置文件加载
3. 实现条件启用逻辑
4. 集成到 FeatureRegistry
5. 编写单元测试

**验收标准**：
- 可以通过配置文件控制功能启用
- 禁用的功能不会加载
- 支持条件启用（环境、用户等）
- 单元测试覆盖率 > 80%

---

**预计总时间**：22 天（约 4-5 周）

## 约束条件

### 向后兼容性

**严格要求**：
- 每个阶段完成后，所有现有功能必须正常运行
- 不能破坏现有的 API 和事件
- 保留现有的目录结构（仅新增，不删除）
- 提供迁移指南，逐步废弃旧 API

### 仅修改 pdf-home 模块

**允许修改的文件**：
- `src/frontend/pdf-home/**/*` - pdf-home 模块的所有文件
- `src/frontend/common/event/event-bus.js` - 增强 EventBus（需向后兼容）
- `src/frontend/common/utils/logger.js` - 增强 Logger（需向后兼容）

**允许新建的目录和文件**：
- `src/frontend/pdf-home/core/feature-registry.js` - 功能注册中心
- `src/frontend/pdf-home/core/state-manager.js` - 状态管理器
- `src/frontend/pdf-home/core/dependency-container.js` - 依赖注入容器
- `src/frontend/pdf-home/core/feature-flag-manager.js` - Feature Flag 管理器
- `src/frontend/pdf-home/features/` - 功能域目录
- `src/frontend/pdf-home/shared/` - 共享工具目录

**不可修改**：
- `src/backend/**/*` - 后端代码（本次重构不涉及）
- `src/frontend/pdf-viewer/**/*` - pdf-viewer 模块（独立模块）
- 其他前端模块

### 遵循代码规范

- 必须先阅读 `src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json`
- 使用 ES6+ 语法（const/let、箭头函数、解构）
- 类的私有方法使用 `#` 前缀
- 所有函数必须有 JSDoc 注释
- 异步操作使用 async/await
- 单元测试覆盖率 > 80%

### 性能要求

- 功能域加载时间 < 100ms
- 事件分发延迟 < 10ms
- 状态更新延迟 < 5ms
- 内存占用增长 < 20%（相比重构前）

## 可行验收标准

### 逐段验证（按 Phase）

#### 验证 1: 依赖注入容器（Phase 1）

**测试方法**：
运行单元测试：`npm test -- dependency-container.test.js`

**验收标准**：
- 容器能注册和获取服务
- 单例服务只创建一次
- 工厂服务每次获取都创建新实例
- 作用域隔离生效（功能域作用域独立）
- 自动依赖解析正确
- 所有现有功能正常运行

---

#### 验证 2: 命名空间事件系统（Phase 2）

**测试方法**：
1. 运行单元测试：`npm test -- scoped-event-bus.test.js`
2. 手动测试：在控制台监听事件

**验收标准**：
- 功能域事件自动添加命名空间前缀
- 功能域内部事件不会泄漏到全局
- `emitGlobal` 可以跨功能通信
- 事件名称符合规范：`@{feature}/{module}:{action}:{status}`
- 向后兼容：全局事件仍能正常工作

---

#### 验证 3: 功能注册中心（Phase 3）

**测试方法**：
运行单元测试：`npm test -- feature-registry.test.js`

**验收标准**：
- 功能注册成功
- 依赖解析正确（有依赖的功能后安装）
- 功能安装顺序符合依赖关系
- 功能卸载不影响其他功能
- 重复注册同名功能会报错

---

#### 验证 4: 功能域重构（Phase 4）

**测试方法**：
1. 运行所有功能域的单元测试
2. 启动应用，测试各功能域
3. 禁用某个功能域，测试其他功能

**验收标准**：
- 三个功能域独立运行
- 禁用 `pdf-editor` 功能，`pdf-list` 仍正常
- 功能域之间通过事件通信（无直接依赖）
- 每个功能域有完整的单元测试（覆盖率 > 80%）
- 功能域目录结构规范

---

#### 验证 5: 统一状态管理（Phase 5）

**测试方法**：
运行单元测试：`npm test -- state-manager.test.js`

**验收标准**：
- 状态变更自动触发订阅
- 订阅器收到正确的新值和旧值
- 计算属性自动更新
- 状态快照和恢复正确
- 功能域状态相互隔离（修改 A 不影响 B）

---

#### 验证 6: Feature Flag 机制（Phase 6）

**测试方法**：
1. 修改配置文件，禁用某个功能
2. 启动应用，验证功能未加载
3. 运行单元测试：`npm test -- feature-flag-manager.test.js`

**验收标准**：
- 配置文件正确加载
- 禁用的功能不会加载（不会调用 `install`）
- 条件启用生效（如仅在开发环境启用）
- 运行时可以查询功能状态

### 端到端测试

#### 测试 1: 协同开发模拟

**场景**：
两个开发者并行开发两个功能：
- 开发者 A 开发 `pdf-editor` 功能
- 开发者 B 开发 `pdf-sorter` 功能

**步骤**：
1. 开发者 A 创建 `features/pdf-editor/` 目录
2. 开发者 B 创建 `features/pdf-sorter/` 目录
3. 双方独立开发，不修改核心代码
4. 双方完成后，分别注册功能到 FeatureRegistry
5. 启动应用，两个功能同时运行

**验收标准**：
- 双方开发过程中无 Git 冲突
- 两个功能独立运行，互不干扰
- 功能之间通过事件通信正常

---

#### 测试 2: 功能隔离验证

**场景**：
`pdf-editor` 功能崩溃，验证其他功能是否受影响

**步骤**：
1. 在 `pdf-editor` 功能中故意抛出错误
2. 触发 `pdf-editor` 功能的某个操作
3. 观察其他功能（如 `pdf-list`）是否正常

**验收标准**：
- `pdf-editor` 崩溃时，显示错误提示
- `pdf-list` 功能正常运行（表格刷新、添加删除等）
- 应用不会整体崩溃

---

#### 测试 3: 功能热插拔

**场景**：
运行时动态加载和卸载功能

**步骤**：
1. 启动应用时，`pdf-editor` 功能禁用
2. 在控制台执行：`featureRegistry.install('pdf-editor')`
3. 验证编辑按钮出现，可以打开编辑模态框
4. 执行：`featureRegistry.uninstall('pdf-editor')`
5. 验证编辑按钮消失

**验收标准**：
- 动态安装功能后，功能立即可用
- 动态卸载功能后，功能立即失效
- 其他功能不受影响

---

#### 测试 4: 状态隔离验证

**场景**：
验证功能域状态相互隔离

**步骤**：
1. `pdf-list` 功能修改 `state.records`
2. `pdf-editor` 功能修改 `state.currentRecord`
3. 在控制台查看状态：
   - `stateManager.getState('pdf-list')`
   - `stateManager.getState('pdf-editor')`

**验收标准**：
- 两个功能域的状态完全独立
- 修改 `pdf-list` 状态不影响 `pdf-editor` 状态
- 状态快照只包含对应功能域的数据

---

#### 测试 5: Feature Flag 灰度发布

**场景**：
通过 Feature Flag 实现灰度发布

**步骤**：
1. 配置文件设置 `pdf-sorter` 仅在开发环境启用：
   ```javascript
   'pdf-sorter': {
     enabled: true,
     conditions: {
       environments: ['development']
     }
   }
   ```
2. 以开发模式启动：`npm run dev`
3. 验证排序按钮出现
4. 以生产模式启动：`npm run build && npm run preview`
5. 验证排序按钮不出现

**验收标准**：
- 开发环境功能启用
- 生产环境功能禁用
- 功能启用状态可以在控制台查询

## 接口实现

### 接口 1: DependencyContainer.register

**函数**: `DependencyContainer.register(name: string, target: any, options: RegisterOptions) -> void`

**描述**: 注册服务到容器

**参数**:
- `name` (string): 服务名称（唯一）
- `target` (any): 服务类或值
- `options` (RegisterOptions): 注册选项
  - `scope` ('singleton' | 'transient'): 作用域，默认 'singleton'
  - `factory` (boolean): 是否为工厂函数，默认 false

**返回值**: 无

**异常**:
- `Error`: 如果服务名称已存在

**示例**:
```javascript
container.register('logger', Logger, { scope: 'singleton' });
container.register('wsClient', createWSClient, { scope: 'singleton', factory: true });
```

---

### 接口 2: DependencyContainer.get

**函数**: `DependencyContainer.get<T>(name: string) -> T`

**描述**: 获取服务实例

**参数**:
- `name` (string): 服务名称

**返回值**:
- `T`: 服务实例

**异常**:
- `Error`: 如果服务未注册

**示例**:
```javascript
const logger = container.get('logger');
logger.info('Hello');
```

---

### 接口 3: DependencyContainer.createScope

**函数**: `DependencyContainer.createScope(name: string) -> DependencyContainer`

**描述**: 创建子作用域容器

**参数**:
- `name` (string): 作用域名称

**返回值**:
- `DependencyContainer`: 子容器实例

**说明**:
- 子容器继承父容器的所有服务
- 子容器注册的服务仅在子容器中可见

**示例**:
```javascript
const featureScope = container.createScope('pdf-list');
featureScope.register('listService', ListService);
const listService = featureScope.get('listService');
```

---

### 接口 4: FeatureRegistry.register

**函数**: `FeatureRegistry.register(feature: IFeature) -> void`

**描述**: 注册功能到注册中心

**参数**:
- `feature` (IFeature): 功能实例

**返回值**: 无

**异常**:
- `Error`: 如果功能名称已存在
- `Error`: 如果依赖的功能不存在

**示例**:
```javascript
const pdfListFeature = new PDFListFeature();
featureRegistry.register(pdfListFeature);
```

---

### 接口 5: FeatureRegistry.install

**函数**: `FeatureRegistry.install(name: string) -> Promise<void>`

**描述**: 安装并启用功能

**参数**:
- `name` (string): 功能名称

**返回值**: 无

**异常**:
- `Error`: 如果功能未注册
- `Error`: 如果依赖未满足

**流程**:
1. 解析依赖树
2. 按依赖顺序安装依赖功能
3. 调用 `feature.install(context)`
4. 标记为已安装

**示例**:
```javascript
await featureRegistry.install('pdf-editor');
```

---

### 接口 6: FeatureRegistry.uninstall

**函数**: `FeatureRegistry.uninstall(name: string) -> Promise<void>`

**描述**: 卸载功能

**参数**:
- `name` (string): 功能名称

**返回值**: 无

**流程**:
1. 检查是否有其他功能依赖此功能
2. 调用 `feature.uninstall(context)`
3. 清理事件监听器、状态等
4. 标记为未安装

---

### 接口 7: StateManager.createState

**函数**: `StateManager.createState<T>(namespace: string, initialState: T) -> ReactiveState<T>`

**描述**: 创建功能域状态

**参数**:
- `namespace` (string): 功能域命名空间
- `initialState` (T): 初始状态对象

**返回值**:
- `ReactiveState<T>`: 响应式状态对象

**示例**:
```javascript
const state = stateManager.createState('pdf-list', {
  records: [],
  selectedIds: []
});

// 响应式修改
state.records = [...state.records, newRecord];
```

---

### 接口 8: ReactiveState.subscribe

**函数**: `ReactiveState.subscribe(key: string, callback: Function) -> Unsubscribe`

**描述**: 订阅状态变更

**参数**:
- `key` (string): 状态属性名
- `callback` (Function): 回调函数 `(newValue, oldValue) => void`

**返回值**:
- `Unsubscribe` (Function): 取消订阅函数

**示例**:
```javascript
const unsubscribe = state.subscribe('records', (newRecords, oldRecords) => {
  console.log('Records changed:', newRecords);
});

// 取消订阅
unsubscribe();
```

---

### 接口 9: FeatureFlagManager.isEnabled

**函数**: `FeatureFlagManager.isEnabled(featureName: string) -> boolean`

**描述**: 查询功能是否启用

**参数**:
- `featureName` (string): 功能名称

**返回值**:
- `boolean`: 是否启用

**示例**:
```javascript
if (featureFlagManager.isEnabled('pdf-editor')) {
  await featureRegistry.install('pdf-editor');
}
```

## 类实现

### 类 1: DependencyContainer

**类**: `DependencyContainer`

**描述**: 依赖注入容器，管理服务的注册、获取、作用域

**文件**: `src/frontend/pdf-home/core/dependency-container.js`

**属性**:
```javascript
#services: Map<string, ServiceDefinition>  // 服务定义
#instances: Map<string, any>               // 单例实例缓存
#parent: DependencyContainer | null        // 父容器（用于作用域继承）
#name: string                              // 容器名称
```

**方法**:
- `register(name, target, options)` - 注册服务
- `get(name)` - 获取服务实例
- `has(name)` - 检查服务是否存在
- `createScope(name)` - 创建子作用域
- `#resolve(definition)` - 解析服务（私有）
- `#createInstance(target)` - 创建实例（私有）
- `#injectDependencies(instance)` - 注入依赖（私有）

---

### 类 2: ScopedEventBus

**类**: `ScopedEventBus`

**描述**: 命名空间事件总线，支持作用域隔离

**文件**: `src/frontend/common/event/scoped-event-bus.js`

**属性**:
```javascript
#namespace: string                    // 命名空间（如 '@pdf-list'）
#globalEventBus: EventBus            // 全局事件总线
#localListeners: Map<string, Set>    // 本地事件监听器
```

**方法**:
- `emit(event, data, metadata)` - 触发本地事件（自动添加命名空间）
- `on(event, callback, options)` - 监听本地事件
- `off(event, callback)` - 移除监听器
- `emitGlobal(event, data, metadata)` - 触发全局事件（无命名空间）
- `onGlobal(event, callback, options)` - 监听全局事件
- `#addNamespace(event)` - 添加命名空间前缀（私有）
- `#removeNamespace(event)` - 移除命名空间前缀（私有）

---

### 类 3: FeatureRegistry

**类**: `FeatureRegistry`

**描述**: 功能注册中心，管理功能的注册、安装、卸载

**文件**: `src/frontend/pdf-home/core/feature-registry.js`

**属性**:
```javascript
#features: Map<string, IFeature>      // 已注册的功能
#installed: Set<string>               // 已安装的功能
#container: DependencyContainer       // 依赖容器
#logger: Logger                       // 日志记录器
```

**方法**:
- `register(feature)` - 注册功能
- `install(name)` - 安装功能
- `uninstall(name)` - 卸载功能
- `enable(name)` - 启用功能
- `disable(name)` - 禁用功能
- `isInstalled(name)` - 检查功能是否已安装
- `#resolveDependencies(feature)` - 解析依赖（私有）
- `#createFeatureContext(feature)` - 创建功能上下文（私有）

---

### 类 4: StateManager

**类**: `StateManager`

**描述**: 统一状态管理器，基于 Proxy 实现响应式

**文件**: `src/frontend/pdf-home/core/state-manager.js`

**属性**:
```javascript
#states: Map<string, ReactiveState>   // 功能域状态
#logger: Logger                       // 日志记录器
```

**方法**:
- `createState(namespace, initialState)` - 创建功能域状态
- `getState(namespace)` - 获取功能域状态
- `hasState(namespace)` - 检查状态是否存在
- `destroyState(namespace)` - 销毁功能域状态
- `snapshot()` - 生成全局状态快照
- `restore(snapshot)` - 恢复状态快照

---

### 类 5: ReactiveState

**类**: `ReactiveState`

**描述**: 响应式状态对象，基于 Proxy

**文件**: `src/frontend/pdf-home/core/state-manager.js`

**属性**:
```javascript
#data: Object                          // 实际数据（通过 Proxy 包装）
#subscribers: Map<string, Set>         // 订阅者
#computed: Map<string, Function>       // 计算属性
```

**方法**:
- `subscribe(key, callback)` - 订阅属性变更
- `unsubscribe(key, callback)` - 取消订阅
- `defineComputed(key, getter)` - 定义计算属性
- `snapshot()` - 生成状态快照
- `restore(snapshot)` - 恢复状态
- `#notify(key, newValue, oldValue)` - 通知订阅者（私有）
- `#createProxy(target)` - 创建 Proxy（私有）

---

### 类 6: FeatureFlagManager

**类**: `FeatureFlagManager`

**描述**: Feature Flag 管理器，管理功能开关

**文件**: `src/frontend/pdf-home/core/feature-flag-manager.js`

**属性**:
```javascript
#flags: Map<string, FeatureFlagConfig>  // 功能开关配置
#environment: string                    // 当前环境
#logger: Logger                         // 日志记录器
```

**方法**:
- `loadConfig(config)` - 加载配置
- `isEnabled(featureName)` - 查询功能是否启用
- `enable(featureName)` - 启用功能
- `disable(featureName)` - 禁用功能
- `#checkConditions(flag)` - 检查条件（私有）

---

### 类 7: PDFListFeature (示例功能域)

**类**: `PDFListFeature implements IFeature`

**描述**: PDF 列表功能域实现

**文件**: `src/frontend/pdf-home/features/pdf-list/index.js`

**属性**:
```javascript
name: string = 'pdf-list'
version: string = '1.0.0'
dependencies: string[] = ['core', 'websocket']
#eventBus: ScopedEventBus
#stateManager: StateManager
#uiComponents: Object
```

**方法**:
- `async install(context)` - 安装功能
- `async uninstall(context)` - 卸载功能
- `async enable()` - 启用功能
- `async disable()` - 禁用功能
- `#setupEventListeners()` - 设置事件监听（私有）
- `#initializeState()` - 初始化状态（私有）
- `#renderUI()` - 渲染 UI（私有）

## 事件规范

### 事件 1: @pdf-list/table:row:selected

**描述**: PDF 列表表格行选中事件（功能域内部事件）

**方向**: TableComponent → ListService

**命名空间**: `@pdf-list`

**触发时机**: 用户点击表格行

**事件格式**:
```javascript
{
  type: '@pdf-list/table:row:selected',
  data: {
    record: {
      id: string,
      filename: string,
      // ... 其他字段
    }
  },
  metadata: {
    timestamp: number,
    actorId: 'table-component'
  }
}
```

---

### 事件 2: pdf:list:updated (全局事件)

**描述**: PDF 列表更新事件（跨功能通信）

**方向**: PDFListFeature → 所有监听者

**命名空间**: 无（全局事件）

**触发时机**: PDF 列表数据更新后

**事件格式**:
```javascript
{
  type: 'pdf:list:updated',
  data: {
    records: [
      { id, filename, ... }
    ]
  },
  metadata: {
    timestamp: number,
    source: '@pdf-list'
  }
}
```

---

### 事件 3: feature:installed

**描述**: 功能安装完成事件

**方向**: FeatureRegistry → 所有监听者

**触发时机**: 功能 install 方法执行成功后

**事件格式**:
```javascript
{
  type: 'feature:installed',
  data: {
    name: string,      // 功能名称
    version: string    // 功能版本
  }
}
```

---

### 事件 4: state:changed

**描述**: 状态变更事件

**方向**: StateManager → 订阅者

**触发时机**: 状态属性修改后

**事件格式**:
```javascript
{
  type: 'state:changed',
  data: {
    namespace: string,  // 功能域命名空间
    key: string,        // 属性名
    newValue: any,      // 新值
    oldValue: any       // 旧值
  }
}
```

## 单元测试

### 测试 1: test_dependency_container_singleton

**描述**: 测试依赖容器的单例模式

**文件**: `src/frontend/pdf-home/core/__tests__/dependency-container.test.js`

**断言**:
- 注册单例服务后，多次获取返回同一实例
- 注册瞬时服务后，每次获取返回新实例
- 子作用域能访问父作用域的服务

---

### 测试 2: test_scoped_event_bus_namespace

**描述**: 测试命名空间事件总线

**文件**: `src/frontend/common/event/__tests__/scoped-event-bus.test.js`

**断言**:
- 本地事件自动添加命名空间前缀
- 功能域 A 的事件不会触发功能域 B 的监听器
- 全局事件可以跨功能域通信

---

### 测试 3: test_feature_registry_dependency_resolution

**描述**: 测试功能注册中心的依赖解析

**文件**: `src/frontend/pdf-home/core/__tests__/feature-registry.test.js`

**断言**:
- 功能按依赖顺序安装（依赖先安装）
- 循环依赖抛出错误
- 缺失依赖抛出错误

---

### 测试 4: test_state_manager_reactivity

**描述**: 测试状态管理器的响应式

**文件**: `src/frontend/pdf-home/core/__tests__/state-manager.test.js`

**断言**:
- 修改状态属性触发订阅回调
- 订阅回调收到正确的新值和旧值
- 取消订阅后不再收到通知
- 计算属性自动更新

---

### 测试 5: test_feature_flag_conditions

**描述**: 测试 Feature Flag 条件启用

**文件**: `src/frontend/pdf-home/core/__tests__/feature-flag-manager.test.js`

**断言**:
- 环境条件匹配时功能启用
- 环境条件不匹配时功能禁用
- 无条件的功能根据 enabled 字段决定

## 风险和注意事项

### 1. 向后兼容性风险

**风险**：
- 重构过程中可能破坏现有功能
- 事件名称变更可能导致监听失败

**缓解措施**：
- 每个 Phase 完成后进行完整回归测试
- 保留旧 API，逐步废弃（Deprecation Warnings）
- 提供迁移脚本自动转换事件名称

### 2. 性能开销

**风险**：
- 依赖注入可能增加初始化时间
- Proxy 实现响应式可能有性能损耗
- 事件命名空间增加字符串处理开销

**缓解措施**：
- 懒加载功能域（按需安装）
- 缓存依赖解析结果
- 优化 Proxy handler（仅拦截必要操作）
- 性能基准测试（重构前后对比）

### 3. 学习成本

**风险**：
- 新架构概念（功能域、依赖注入等）学习成本高
- 开发者需要适应新的开发模式

**缓解措施**：
- 编写详细的开发者文档和示例
- 提供功能域脚手架工具（CLI）
- 代码审查和培训

### 4. 调试复杂度

**风险**：
- 依赖注入和事件系统增加调试难度
- 状态变更追踪困难

**缓解措施**：
- 实现详细的日志记录
- 提供调试工具（查看容器服务、事件追踪、状态快照）
- 浏览器开发者工具集成

### 5. 测试覆盖

**风险**：
- 新增代码可能缺少测试
- 功能域交互测试复杂

**缓解措施**：
- 强制单元测试覆盖率 > 80%
- 编写集成测试（功能域之间交互）
- 端到端测试（真实用户场景）

### 6. 迁移成本

**风险**：
- 现有功能迁移到功能域需要大量重构
- 可能引入新 bug

**缓解措施**：
- 分批迁移（先迁移独立功能）
- 新旧架构并存（渐进式迁移）
- 充分测试每个迁移步骤

## 后续优化方向

### 1. 功能域热重载（HMR）

- 开发环境支持功能域代码热更新
- 无需刷新页面即可看到修改效果

### 2. 功能域 CLI 工具

- 提供脚手架命令：`npm run create:feature pdf-exporter`
- 自动生成功能域目录结构和模板代码
- 自动注册到 FeatureRegistry

### 3. 可视化调试工具

- 功能域关系图（依赖图）
- 事件流追踪（事件时序图）
- 状态快照对比工具

### 4. 远程功能域（Remote Features）

- 功能域作为独立 NPM 包发布
- 运行时从 CDN 加载功能域
- 实现真正的微前端架构

### 5. 功能域性能监控

- 统计功能域加载时间
- 监控事件处理延迟
- 状态更新性能分析

---

**文档完成时间**: 2025-10-02 14:30:00
**文档状态**: ✅ 完整自洽，可直接用于开发
**预计工作量**: 22 天（约 4-5 周）
**风险等级**: 中高（架构重构，需谨慎实施）
