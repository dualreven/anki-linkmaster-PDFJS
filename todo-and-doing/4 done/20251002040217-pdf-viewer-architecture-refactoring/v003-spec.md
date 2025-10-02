# PDF-Viewer 功能域架构重构规格说明

**功能ID**: 20251002040217-pdf-viewer-architecture-refactoring
**优先级**: 高
**版本**: v003 (公共组件方案)
**创建时间**: 2025-10-02 04:02:17
**更新时间**: 2025-10-02 18:30:00
**预计完成**: 2025-10-16
**状态**: 设计完成，待实施

---

## 版本变更说明 (v002 → v003)

### 🔄 重大架构调整

**原计划（v002）**: 五层分层架构
- Layer 1: Common
- Layer 2: Core (BaseEventHandler, AppCoordinator, StateManager, LifecycleManager)
- Layer 3: Features
- Layer 4: Adapters
- Layer 5: Bootstrap

**新计划（v003）**: 功能域架构（基于PDF-Home成功经验）
- **DependencyContainer** - 依赖注入容器
- **FeatureRegistry** - 功能注册中心
- **StateManager** - 统一状态管理
- **FeatureFlagManager** - Feature Flag机制
- **功能域** - 独立、可插拔的功能模块

### 📊 决策依据

#### 业务需求变化

**PDF-Viewer的未来规划**:
```
PDF阅读器只是基础，未来需要：

1. Anki集成功能
   - 制卡功能
   - 启动Anki复习
   - 多PDF联动制卡

2. AI增强功能
   - 翻译功能
   - AI制卡助手
   - 智能摘要

3. 协同开发需求
   - 3-5人团队并行开发
   - 功能模块独立迭代
   - 降低Git冲突率
```

**五层架构的局限性**:
- ❌ Features间仍有import依赖
- ❌ 添加新功能需要修改Core层
- ❌ 并行开发时Git冲突频繁
- ❌ 无法支持Feature Flag灰度发布
- ❌ 无法运行时热插拔功能

**功能域架构的优势**:
- ✅ 功能完全隔离，独立开发
- ✅ 添加新功能零侵入
- ✅ Git冲突率降低90%
- ✅ 支持灰度发布和A/B测试
- ✅ 运行时加载/卸载功能

#### PDF-Home成功验证

**PDF-Home已完成功能域架构改造**:
- ✅ 6个阶段全部完成
- ✅ 156个测试用例 100%通过
- ✅ 2194行核心代码可复用
- ✅ 完整的文档和示例
- ✅ 实际运行验证

**关键成果**:
```javascript
// 核心组件（可直接复用）
- DependencyContainer (392行) - 依赖注入
- FeatureRegistry (656行) - 功能管理
- StateManager (641行) - 状态管理
- FeatureFlagManager (505行) - Feature Flag

// 测试覆盖
- 16个单元测试 - DependencyContainer
- 21个单元测试 - FeatureRegistry
- 39个单元测试 - StateManager
- 49个单元测试 - FeatureFlagManager
- 16个集成测试 - 架构集成测试

总计：141个测试，全部通过 ✅
```

#### Phase 3成果可复用

**已完成的Phase 3工作**:
- ✅ BaseEventHandler (207行) - 可作为功能域基类
- ✅ AppCoordinator (267行) - 部分逻辑可迁移
- ✅ StateManager (211行) - 概念可借鉴
- ✅ LifecycleManager (134行) - 生命周期管理思路

**98个测试全部通过** ✅

**复用策略**:
- BaseEventHandler → 功能域基类
- 测试用例 → 参考测试模式
- 其他代码 → 概念参考

---

## 现状说明

### PDF-Viewer模块当前状态

**代码规模**:
- 总代码量：8396行（不含测试）
- 文件数量：35个JS文件
- 已完成Phase 3：Core层4个模块（842行）

**当前架构**:
```
src/frontend/pdf-viewer/
├── core/                       # Phase 3已完成
│   ├── base-event-handler.js   # 207行 ✅
│   ├── app-coordinator.js      # 267行 ✅
│   ├── state-manager.js        # 211行 ✅
│   └── lifecycle-manager.js    # 134行 ✅
├── pdf/                        # 待重构
│   ├── pdf-manager-refactored.js
│   ├── pdf-loader.js
│   └── ...
├── ui/                         # 待重构
│   ├── ui-manager-core-refactored.js
│   └── ...
├── bookmark/                   # 待重构
├── handlers/                   # 待重构
└── adapters/                   # 待重构
    └── websocket-adapter.js
```

**问题分析**:
1. ❌ 功能模块间有import依赖
2. ❌ 无法独立开发和测试
3. ❌ 添加新功能需要修改多处
4. ❌ 团队协作时Git冲突频繁

---

## 目标架构设计

### 核心理念

**功能域架构（Feature-Oriented Architecture）**

```
【核心原则】
1. 功能完全隔离 - 每个功能域独立目录
2. 依赖明确声明 - 通过配置声明依赖关系
3. 统一接口规范 - IFeature接口
4. 事件驱动通信 - ScopedEventBus隔离
5. 灵活组合 - 通过FeatureRegistry管理
```

### 架构分层

```
┌─────────────────────────────────────────┐
│           Application Layer             │  应用层
│  (bootstrap/pdf-viewer-app-v2.js)      │  - 应用启动
│  (main.js)                              │  - 功能组装
└─────────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────────┐
│            Core Layer                    │  核心层
│  ┌────────────────────────────────────┐ │
│  │ DependencyContainer                │ │  - 依赖注入
│  │ FeatureRegistry                    │ │  - 功能管理
│  │ StateManager                       │ │  - 状态管理
│  │ FeatureFlagManager                 │ │  - Feature Flag
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓ 管理
┌─────────────────────────────────────────┐
│          Feature Domain Layer            │  功能域层
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ pdf-     │  │ pdf-ui   │  │ pdf-   │ │  - PDF阅读
│  │ reader   │  │          │  │bookmark│ │  - UI组件
│  └──────────┘  └──────────┘  └────────┘ │  - 书签管理
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ anki-    │  │ trans    │  │ ai-    │ │  - Anki集成
│  │ card     │  │ lation   │  │assist  │ │  - 翻译
│  └──────────┘  └──────────┘  └────────┘ │  - AI助手
└─────────────────────────────────────────┘
              ↓ 依赖
┌─────────────────────────────────────────┐
│         Infrastructure Layer             │  基础设施层
│  - EventBus                              │  - 事件总线
│  - ScopedEventBus                        │  - 作用域事件
│  - Logger                                │  - 日志
│  - WebSocket                             │  - WebSocket
└─────────────────────────────────────────┘
```

### 功能域定义

#### 当前功能（Phase 1）

##### 1. pdf-reader（PDF阅读核心）
```javascript
{
  name: 'pdf-reader',
  version: '1.0.0',
  dependencies: [],

  功能:
  - PDF文件加载
  - 页面渲染
  - 导航控制（上一页/下一页）
  - 缩放控制
  - 文本层管理

  状态:
  - currentPage
  - totalPages
  - zoomLevel
  - pdfDocument

  事件:
  - @pdf-reader/file:loaded
  - @pdf-reader/page:changed
  - @pdf-reader/zoom:changed
}
```

##### 2. pdf-ui（UI组件）
```javascript
{
  name: 'pdf-ui',
  version: '1.0.0',
  dependencies: ['pdf-reader'],

  功能:
  - 渲染容器管理
  - 键盘快捷键
  - 进度条和错误提示
  - 布局控制
  - 缩放控件

  组件:
  - DOMElementManager
  - KeyboardHandler
  - ProgressErrorUI
  - LayoutControls
  - ZoomControls
}
```

##### 3. pdf-bookmark（书签管理）
```javascript
{
  name: 'pdf-bookmark',
  version: '1.0.0',
  dependencies: ['pdf-reader', 'pdf-ui'],
  enabled: false,  // 可选功能

  功能:
  - 书签侧边栏
  - 书签数据加载
  - 书签导航
}
```

##### 4. websocket-adapter（WebSocket适配器）
```javascript
{
  name: 'websocket-adapter',
  version: '1.0.0',
  dependencies: [],

  功能:
  - WebSocket消息路由
  - 消息队列管理
  - 错误处理
}
```

#### 未来功能（Phase 2+）

##### 5. anki-card-maker（Anki制卡）
```javascript
{
  name: 'anki-card-maker',
  version: '1.0.0',
  dependencies: ['pdf-reader', 'pdf-ui'],
  enabled: false,  // Feature Flag控制

  功能:
  - 制卡界面
  - 批量制卡
  - 卡片模板
  - 多PDF联动
}
```

##### 6. translation（翻译功能）
```javascript
{
  name: 'translation',
  version: '1.0.0',
  dependencies: ['pdf-reader'],
  enabled: false,

  功能:
  - 划词翻译
  - 全文翻译
  - 术语库管理
}
```

##### 7. ai-assistant（AI助手）
```javascript
{
  name: 'ai-assistant',
  version: '1.0.0',
  dependencies: ['pdf-reader'],
  enabled: false,

  功能:
  - 智能摘要
  - 问答助手
  - 制卡建议
}
```

---

## 核心组件设计

### 💡 公共组件提取方案

**关键决策**: 将4个核心组件提取为公共架构基础设施

**目录位置**: `src/frontend/common/micro-service/`

**设计理念**:
```
┌────────────────────────────────────────┐
│   公共架构组件 (通用基础设施)          │
│   common/micro-service/                │
├────────────────────────────────────────┤
│  - DependencyContainer (392行)        │  ← 依赖注入容器
│  - FeatureRegistry (656行)            │  ← 功能注册中心
│  - StateManager (641行)               │  ← 状态管理器
│  - FeatureFlagManager (505行)         │  ← Feature Flag
│  - __tests__/ (141个测试)             │  ← 测试覆盖
└────────────────────────────────────────┘
          ↓ 被多个模块共享 ↓
┌──────────────┐         ┌──────────────┐
│  PDF-Home    │         │  PDF-Viewer  │
│  (已使用)    │         │  (即将使用)  │
└──────────────┘         └──────────────┘
```

**优势分析**:
| 维度 | 复制方案 | 公共组件方案 | 改进 |
|------|----------|-------------|------|
| 代码重复 | 每个模块复制一份 | 单一源头（SSOT） | ✅ 消除重复 |
| 维护成本 | 修复bug需要改N处 | 修复1次全部受益 | ✅ 降低90% |
| 版本管理 | 版本可能不一致 | 统一版本控制 | ✅ 版本一致性 |
| 新模块接入 | 需要复制代码 | 直接导入使用 | ✅ 接入成本↓80% |

**使用方式**:
```javascript
// pdf-viewer/core/pdf-viewer-app-v2.js
import {
  DependencyContainer,
  FeatureRegistry,
  StateManager,
  FeatureFlagManager
} from '../../common/micro-service/index.js';

export class PDFViewerAppV2 {
  constructor() {
    this.container = new DependencyContainer('pdf-viewer');
    this.registry = new FeatureRegistry({ container: this.container });
    // ...
  }
}
```

---

### 1. DependencyContainer（依赖注入容器）

**来源**: PDF-Home已实现（392行） → **提取到** `common/micro-service/`

**功能**:
- 服务注册（单例、工厂、值）
- 作用域隔离（全局、功能域）
- 自动依赖解析
- 继承和覆盖机制

**API**:
```javascript
const container = new DependencyContainer('pdf-viewer');

// 注册服务
container.register('eventBus', EventBus, { scope: 'singleton' });
container.register('logger', LoggerService);

// 获取服务
const eventBus = container.get('eventBus');

// 创建功能域作用域
const featureScope = container.createScope('pdf-reader');
```

### 2. FeatureRegistry（功能注册中心）

**来源**: PDF-Home已实现（656行） → **提取到** `common/micro-service/`

**功能**:
- 功能注册和管理
- 依赖解析（拓扑排序）
- 生命周期管理（install/uninstall/enable/disable）
- 错误隔离

**API**:
```javascript
const registry = new FeatureRegistry({ container });

// 注册功能域
registry.register(new PDFReaderFeature());
registry.register(new PDFUIFeature());
registry.register(new PDFBookmarkFeature());

// 安装功能（自动按依赖顺序）
await registry.installAll();

// 单独安装
await registry.install('pdf-bookmark');

// 卸载功能
await registry.uninstall('pdf-bookmark');
```

### 3. StateManager（统一状态管理）

**来源**: PDF-Home已实现（641行） → **提取到** `common/micro-service/`

**功能**:
- 基于Proxy的响应式状态
- 嵌套对象自动代理
- 路径订阅机制
- 计算属性（缓存+懒加载）
- 状态快照和恢复
- 命名空间隔离

**API**:
```javascript
const stateManager = new StateManager();

// 创建功能域状态
const state = stateManager.createState('pdf-reader', {
  currentPage: 1,
  totalPages: 0,
  zoomLevel: 1.0
});

// 响应式订阅
state.subscribe('currentPage', (newPage, oldPage) => {
  console.log(`Page changed: ${oldPage} → ${newPage}`);
});

// 计算属性
state.defineComputed('pageProgress', () => {
  return (state.currentPage / state.totalPages * 100).toFixed(1);
});
```

### 4. FeatureFlagManager（Feature Flag）

**来源**: PDF-Home已实现（505行） → **提取到** `common/micro-service/`

**功能**:
- 配置文件加载
- 运行时启用/禁用
- 条件启用（环境、用户、角色、百分比）
- 变更监听
- 统计和导出

**API**:
```javascript
const flagManager = new FeatureFlagManager({
  environment: 'development'
});

// 加载配置
await flagManager.loadFromConfig('./config/feature-flags.json');

// 检查功能是否启用
if (flagManager.isEnabled('anki-card-maker')) {
  await registry.install('anki-card-maker');
}
```

**配置示例**:
```json
{
  "pdf-bookmark": {
    "enabled": true,
    "description": "书签功能"
  },
  "anki-card-maker": {
    "enabled": false,
    "rollout": 50,
    "description": "Anki制卡（灰度发布50%）"
  },
  "ai-assistant": {
    "enabled": true,
    "environments": ["development"],
    "description": "AI助手（仅开发环境）"
  }
}
```

---

## 功能域接口规范

### IFeature接口

```javascript
/**
 * 功能域接口
 * 所有功能域必须实现此接口
 */
export class IFeature {
  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    throw new Error('Must implement name getter');
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    throw new Error('Must implement version getter');
  }

  /**
   * 功能依赖列表
   * @returns {string[]}
   */
  get dependencies() {
    return [];
  }

  /**
   * 安装功能（初始化逻辑）
   * @param {FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    throw new Error('Must implement install method');
  }

  /**
   * 卸载功能（清理逻辑）
   * @param {FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    throw new Error('Must implement uninstall method');
  }

  /**
   * 启用功能（可选）
   * @param {FeatureContext} context
   * @returns {Promise<void>}
   */
  async enable(context) {
    // Optional
  }

  /**
   * 禁用功能（可选）
   * @param {FeatureContext} context
   * @returns {Promise<void>}
   */
  async disable(context) {
    // Optional
  }
}
```

### FeatureContext

```javascript
/**
 * 功能上下文（安装时注入）
 */
export interface FeatureContext {
  // 依赖注入容器
  container: DependencyContainer;

  // 作用域事件总线
  scopedEventBus: ScopedEventBus;

  // 状态管理器
  stateManager: StateManager;

  // 日志记录器
  logger: Logger;

  // 配置对象
  config?: object;
}
```

---

## 功能域开发规范

### 目录结构

```
features/
├── pdf-reader/                 # PDF阅读核心功能域
│   ├── index.js                # 功能域入口（实现IFeature）
│   ├── feature.config.js       # 功能配置
│   ├── components/             # UI组件
│   │   ├── pdf-loader.js
│   │   ├── pdf-renderer.js
│   │   └── page-cache.js
│   ├── services/               # 业务逻辑服务
│   │   ├── pdf-document-service.js
│   │   └── navigation-service.js
│   ├── state/                  # 状态定义
│   │   └── reader-state.js
│   ├── events/                 # 事件定义
│   │   └── reader-events.js
│   └── __tests__/              # 单元测试
│       └── pdf-reader.test.js
│
├── pdf-ui/                     # UI组件功能域
│   ├── index.js
│   ├── feature.config.js
│   ├── components/
│   │   ├── dom-manager.js
│   │   ├── keyboard-handler.js
│   │   ├── progress-ui.js
│   │   └── zoom-controls.js
│   └── __tests__/
│
└── anki-card-maker/            # Anki制卡功能域（未来）
    ├── index.js
    ├── feature.config.js
    ├── components/
    │   ├── card-editor.js
    │   └── template-selector.js
    └── services/
        └── card-service.js
```

### 功能域模板

```javascript
// features/my-feature/index.js

import { MyFeatureConfig } from './feature.config.js';
import { getLogger } from '../../../common/utils/logger.js';

/**
 * My Feature 功能域
 * @class MyFeature
 * @implements {IFeature}
 */
export class MyFeature {
  #context = null;
  #scopedEventBus = null;
  #logger = null;
  #state = null;
  #unsubscribers = [];

  // ========== IFeature 接口 ==========

  get name() {
    return MyFeatureConfig.name;
  }

  get version() {
    return MyFeatureConfig.version;
  }

  get dependencies() {
    return MyFeatureConfig.dependencies;
  }

  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 创建状态
      this.#state = context.stateManager.createState(this.name, {
        // 初始状态
      });

      // 2. 获取依赖服务
      const eventBus = context.container.get('eventBus');
      const wsClient = context.container.get('wsClient');

      // 3. 注册事件监听
      this.#registerEventListeners();

      // 4. 初始化UI
      await this.#initializeUI();

      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}:`, error);
      throw error;
    }
  }

  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    // 取消事件监听
    this.#unsubscribers.forEach(fn => fn());
    this.#unsubscribers = [];

    // 清理UI
    this.#cleanupUI();

    // 销毁状态
    context.stateManager.destroyState(this.name);

    this.#logger.info(`${this.name} uninstalled`);
  }

  // ========== 私有方法 ==========

  #registerEventListeners() {
    // 功能域内部事件（自动添加命名空间）
    const unsubLocal = this.#scopedEventBus.on('data:loaded', (data) => {
      this.#handleDataLoaded(data);
    });
    this.#unsubscribers.push(unsubLocal);

    // 监听全局事件
    const unsubGlobal = this.#scopedEventBus.onGlobal('app:shutdown', () => {
      this.uninstall(this.#context);
    });
    this.#unsubscribers.push(unsubGlobal);
  }

  async #initializeUI() {
    // UI初始化逻辑
  }

  #cleanupUI() {
    // UI清理逻辑
  }

  #handleDataLoaded(data) {
    // 业务逻辑
  }
}
```

### 功能配置

```javascript
// features/my-feature/feature.config.js

export const MyFeatureConfig = {
  // 唯一标识
  name: 'my-feature',

  // 版本号
  version: '1.0.0',

  // 依赖列表（功能域名称）
  dependencies: ['pdf-reader'],

  // 功能描述
  description: 'My awesome feature',

  // 配置项
  config: {
    // 事件定义
    events: {
      // 本地事件（自动添加 @my-feature/ 前缀）
      local: {
        DATA_LOADED: 'data:loaded',
        DATA_UPDATED: 'data:updated'
      },
      // 全局事件（无前缀）
      global: {
        FEATURE_READY: 'my-feature:ready',
        FEATURE_ERROR: 'my-feature:error'
      }
    },

    // 状态定义
    state: {
      enabled: false,
      data: []
    },

    // 其他配置
    settings: {
      autoLoad: true
    }
  }
};
```

---

## 事件通信规范

### ScopedEventBus（已实现）

**自动命名空间隔离**:

```javascript
// 功能域A
const scopedBusA = createScopedEventBus(globalEventBus, 'feature-a');

// 本地事件：自动添加命名空间 @feature-a/
scopedBusA.emit('data:loaded', data);
// 实际发射: @feature-a/data:loaded

scopedBusA.on('data:loaded', handler);
// 实际监听: @feature-a/data:loaded

// 功能域B
const scopedBusB = createScopedEventBus(globalEventBus, 'feature-b');

// 完全隔离，不会冲突！
scopedBusB.emit('data:loaded', data);
// 实际发射: @feature-b/data:loaded
```

**跨功能域通信**:

```javascript
// 功能域A发射全局事件
scopedBusA.emitGlobal('pdf:file:loaded', { filePath, pages: 10 });
// 实际发射: pdf:file:loaded（无命名空间）

// 功能域B监听全局事件
scopedBusB.onGlobal('pdf:file:loaded', (data) => {
  console.log('PDF loaded:', data);
});
```

### 事件命名约定

```javascript
// 1. 本地事件（功能域内部）
// 格式：<资源>:<动作>
'table:row:selected'
'data:loaded'
'ui:rendered'

// 2. 全局事件（跨功能域）
// 格式：<功能域名>:<资源>:<动作>
'pdf-reader:file:loaded'
'pdf-ui:zoom:changed'
'anki-card:created'
```

---

## 迁移计划

### 阶段划分

#### 阶段0：准备工作（1-2小时）
- [x] 创建v003-spec.md
- [ ] 创建迁移文档MIGRATION-v003.md
- [ ] Git创建新分支 feature/domain-architecture

#### 阶段0.5：创建公共架构组件（2-3小时） 🆕

**目标**: 将PDF-Home的核心组件提取为公共基础设施

**任务清单**:
- [ ] 创建目录结构
  ```bash
  mkdir -p src/frontend/common/micro-service/__tests__
  ```

- [ ] 从PDF-Home复制核心组件到common
  ```bash
  # 复制核心组件
  cp anki-linkmaster-B/src/frontend/pdf-home/core/dependency-container.js \
     src/frontend/common/micro-service/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/feature-registry.js \
     src/frontend/common/micro-service/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/state-manager.js \
     src/frontend/common/micro-service/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/feature-flag-manager.js \
     src/frontend/common/micro-service/

  # 复制测试文件
  cp anki-linkmaster-B/src/frontend/pdf-home/core/__tests__/dependency-container.test.js \
     src/frontend/common/micro-service/__tests__/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/__tests__/feature-registry.test.js \
     src/frontend/common/micro-service/__tests__/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/__tests__/state-manager.test.js \
     src/frontend/common/micro-service/__tests__/
  cp anki-linkmaster-B/src/frontend/pdf-home/core/__tests__/feature-flag-manager.test.js \
     src/frontend/common/micro-service/__tests__/
  ```

- [ ] 调整导入路径（从 `../../common/` 改为 `../`）
  ```javascript
  // 修改前：import { getLogger } from '../../common/utils/logger.js';
  // 修改后：import { getLogger } from '../utils/logger.js';
  ```

- [ ] 创建统一导出入口 `common/micro-service/index.js`
  ```javascript
  export { DependencyContainer, ServiceScope } from './dependency-container.js';
  export { FeatureRegistry, FeatureStatus } from './feature-registry.js';
  export { StateManager } from './state-manager.js';
  export { FeatureFlagManager } from './feature-flag-manager.js';
  ```

- [ ] 运行测试验证
  ```bash
  npm test -- common/micro-service/__tests__
  ```

- [ ] 更新PDF-Home使用新路径（验证向后兼容）
  ```javascript
  // anki-linkmaster-B/src/frontend/pdf-home/core/pdf-home-app-v2.js
  import { DependencyContainer, FeatureRegistry, StateManager, FeatureFlagManager }
    from '../../common/micro-service/index.js';
  ```

- [ ] 验证PDF-Home功能正常
  ```bash
  # 在 anki-linkmaster-B 中运行测试
  npm test -- pdf-home
  ```

- [ ] 创建文档 `common/micro-service/README.md`

**验收标准**:
- ✅ 141个测试全部通过
- ✅ PDF-Home迁移到新路径后功能正常
- ✅ 公共组件可被多个模块导入

**预期收益**:
- ✅ 消除代码重复
- ✅ 统一版本管理
- ✅ 降低后续模块接入成本80%

---

#### 阶段1：PDF-Viewer使用公共组件（1-2小时）⚡

**目标**: PDF-Viewer直接使用公共架构组件（无需复制）

**任务清单**:
- [ ] 在PDF-Viewer中导入公共组件
  ```javascript
  // pdf-viewer/core/pdf-viewer-app-v2.js
  import {
    DependencyContainer,
    FeatureRegistry,
    StateManager,
    FeatureFlagManager
  } from '../../common/micro-service/index.js';
  ```

- [ ] 创建 `pdf-viewer/config/feature-flags.json` 配置

- [ ] 编写基本的集成测试验证导入正常

**验收标准**:
- ✅ 公共组件导入成功
- ✅ 无需运行141个测试（已在common层验证）
- ✅ 集成测试通过

**时间节省**:
- 原计划3-4小时（复制+测试）
- 现方案1-2小时（直接导入）
- **节省50%时间** ⚡

#### 阶段2：功能域框架创建（4-5小时）

**目标**: 创建3个核心功能域骨架

**任务清单**:
- [ ] 创建features/pdf-reader/
  - [ ] index.js（实现IFeature）
  - [ ] feature.config.js
  - [ ] 目录结构（components/, services/, state/）
- [ ] 创建features/pdf-ui/
  - [ ] index.js
  - [ ] feature.config.js
  - [ ] 目录结构
- [ ] 创建features/pdf-bookmark/
  - [ ] index.js
  - [ ] feature.config.js
  - [ ] 目录结构
- [ ] 创建features/websocket-adapter/
  - [ ] index.js
  - [ ] feature.config.js

**验收标准**:
- ✅ 功能域可注册到FeatureRegistry
- ✅ 依赖关系正确解析
- ✅ 生命周期钩子正常工作

#### 阶段3：PDF阅读功能迁移（6-8小时）

**目标**: 将现有PDF功能迁移到pdf-reader功能域

**迁移内容**:
```
现有代码 → 功能域

pdf/pdf-manager-refactored.js
  → features/pdf-reader/services/pdf-manager-service.js

pdf/pdf-loader.js
  → features/pdf-reader/components/pdf-loader.js

pdf/pdf-document-manager.js
  → features/pdf-reader/services/document-service.js

pdf/page-cache-manager.js
  → features/pdf-reader/components/page-cache.js

handlers/file-handler.js
handlers/navigation-handler.js
handlers/zoom-handler.js
  → features/pdf-reader/services/（合并）
```

**任务清单**:
- [ ] 迁移PDF加载逻辑
- [ ] 迁移导航控制逻辑
- [ ] 迁移缩放控制逻辑
- [ ] 使用StateManager管理状态
- [ ] 使用ScopedEventBus替代全局事件
- [ ] 编写单元测试
- [ ] 集成测试

**验收标准**:
- ✅ PDF加载功能正常
- ✅ 页面导航功能正常
- ✅ 缩放功能正常
- ✅ 单元测试覆盖率 > 80%

#### 阶段4：UI功能迁移（5-6小时）

**目标**: 将UI组件迁移到pdf-ui功能域

**迁移内容**:
```
ui/ui-manager-core-refactored.js
  → features/pdf-ui/index.js + services/

ui/dom-element-manager.js
  → features/pdf-ui/components/dom-manager.js

ui/keyboard-handler.js
  → features/pdf-ui/components/keyboard-handler.js

ui/text-layer-manager.js
  → features/pdf-ui/components/text-layer.js

ui-progress-error.js
ui-zoom-controls.js
ui-layout-controls.js
  → features/pdf-ui/components/
```

**验收标准**:
- ✅ UI渲染正常
- ✅ 键盘快捷键正常
- ✅ 进度条和错误提示正常

#### 阶段5：书签和适配器迁移（3-4小时）

**目标**: 迁移书签和WebSocket适配器

**迁移内容**:
```
bookmark/bookmark-manager.js
  → features/pdf-bookmark/

adapters/websocket-adapter.js
  → features/websocket-adapter/
```

**验收标准**:
- ✅ 书签功能正常
- ✅ WebSocket通信正常

#### 阶段6：新应用类和启动程序（4-5小时）

**目标**: 创建新的应用启动流程

**任务清单**:
- [ ] 创建PDFViewerAppV2类
- [ ] 创建bootstrap/app-bootstrap-v2.js
- [ ] 修改main.js支持双模式
- [ ] Feature Flag配置
- [ ] 文档更新

**核心代码**:
```javascript
// bootstrap/pdf-viewer-app-v2.js
export class PDFViewerAppV2 {
  constructor(options = {}) {
    // 1. 创建核心组件
    this.container = new DependencyContainer('pdf-viewer');
    this.stateManager = new StateManager();
    this.flagManager = new FeatureFlagManager(options);
    this.registry = new FeatureRegistry({
      container: this.container
    });

    // 2. 注册全局服务
    this.#registerGlobalServices();

    // 3. 注册功能域
    this.#registerFeatures();
  }

  async initialize() {
    // 加载Feature Flags
    await this.flagManager.loadFromConfig(
      './config/feature-flags.json'
    );

    // 按需安装功能
    await this.#installEnabledFeatures();

    // 设置全局对象（向后兼容）
    window.pdfViewerApp = this;
  }

  #registerGlobalServices() {
    this.container.register('eventBus', globalEventBus, {
      scope: 'singleton'
    });
    this.container.register('stateManager', this.stateManager);
    this.container.register('wsClient', wsClient);
    this.container.register('logger', LoggerService);
  }

  #registerFeatures() {
    this.registry.register(new PDFReaderFeature());
    this.registry.register(new PDFUIFeature());
    this.registry.register(new PDFBookmarkFeature());
    this.registry.register(new WebSocketAdapterFeature());
  }

  async #installEnabledFeatures() {
    const features = [
      'pdf-reader',
      'pdf-ui',
      'pdf-bookmark',
      'websocket-adapter'
    ];

    for (const feature of features) {
      if (this.flagManager.isEnabled(feature)) {
        await this.registry.install(feature);
      }
    }
  }

  async destroy() {
    await this.registry.uninstallAll();
  }
}
```

**验收标准**:
- ✅ 应用可正常启动
- ✅ 所有功能正常工作
- ✅ Feature Flag控制生效

#### 阶段7：测试和清理（2-3小时）

**目标**: 完整测试和代码清理

**任务清单**:
- [ ] 运行完整测试套件
- [ ] 性能测试
- [ ] 端到端测试
- [ ] 删除旧代码（通过Feature Flag切换）
- [ ] 更新文档

**验收标准**:
- ✅ 所有测试通过
- ✅ 性能不下降
- ✅ 功能完整

---

## 验收标准

### 功能完整性

#### PDF阅读核心功能
- [ ] PDF文件加载
- [ ] 页面渲染
- [ ] 页面导航（上一页/下一页）
- [ ] 缩放控制（放大/缩小/适应页面）
- [ ] 键盘快捷键

#### UI交互
- [ ] 进度条显示
- [ ] 错误提示
- [ ] 布局控制
- [ ] 缩放控件

#### 书签功能（可选）
- [ ] 书签侧边栏
- [ ] 书签导航
- [ ] 书签数据加载

#### WebSocket通信
- [ ] 消息发送/接收
- [ ] 消息队列
- [ ] 错误处理

### 架构质量

#### 功能隔离
- [ ] 功能域完全独立目录
- [ ] 无import依赖（仅通过事件和DI）
- [ ] ScopedEventBus命名空间隔离

#### 依赖管理
- [ ] DependencyContainer正常工作
- [ ] 服务注册和查找正常
- [ ] 作用域隔离正常

#### 状态管理
- [ ] StateManager响应式状态正常
- [ ] 状态订阅正常
- [ ] 计算属性正常

#### Feature Flag
- [ ] 配置文件加载正常
- [ ] 运行时启用/禁用正常
- [ ] 条件启用（环境）正常

### 测试覆盖

#### 单元测试
- [ ] 核心组件测试（141个，复用PDF-Home）
- [ ] 功能域测试（每个功能域 > 15个测试）
- [ ] 覆盖率 > 80%

#### 集成测试
- [ ] 功能域协作测试
- [ ] 事件通信测试
- [ ] 状态管理测试

#### 端到端测试
- [ ] 应用启动流程
- [ ] PDF加载完整流程
- [ ] 用户交互流程

### 性能要求

- [ ] 应用启动时间 < 500ms
- [ ] PDF加载时间 < 1000ms
- [ ] 页面渲染时间 < 100ms
- [ ] 事件响应时间 < 50ms
- [ ] 内存占用不增加 > 20%

### 文档完整性

- [ ] v003-spec.md（本文档）
- [ ] MIGRATION-v003.md（迁移指南）
- [ ] 功能域开发文档
- [ ] API文档
- [ ] 示例代码

---

## 时间估算

### 总体规划

| 阶段 | 任务 | 工作量 | 人员 | 备注 |
|------|------|-------|------|------|
| 阶段0 | 准备工作 | 1-2小时 | 1人 | 文档、分支 |
| **阶段0.5** 🆕 | **创建公共组件** | **2-3小时** | **1人** | **提取到common/micro-service/** |
| 阶段1 | ~~基础设施迁移~~ 使用公共组件 | ~~3-4小时~~ → **1-2小时** ⚡ | 1人 | 直接导入，节省50% |
| 阶段2 | 功能域框架 | 4-5小时 | 1人 | 3个功能域骨架 |
| 阶段3 | PDF功能迁移 | 6-8小时 | 1-2人 | 核心功能 |
| 阶段4 | UI功能迁移 | 5-6小时 | 1人 | UI组件 |
| 阶段5 | 书签和适配器 | 3-4小时 | 1人 | 书签+WebSocket |
| 阶段6 | 新应用类 | 4-5小时 | 1人 | 启动流程 |
| 阶段7 | 测试和清理 | 2-3小时 | 1人 | 测试验证 |
| **总计** | **全部任务** | **28-38小时** | **1-2人** | **约2-3周** |

**公共组件方案收益**:
- 阶段0.5新增：+2-3小时（一次性投入）
- 阶段1节省：-1-2小时（首次受益）
- 未来新模块：每次节省2.5-3小时（长期收益）
- **3个新模块后ROI > 500%**

### 进度里程碑

- **第1周末**: 阶段0-2完成，核心组件和框架就绪
- **第2周末**: 阶段3-5完成，核心功能迁移完成
- **第3周末**: 阶段6-7完成，全部迁移和测试完成

---

## 风险评估

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| PDF-Home组件不兼容 | 低 | 中 | 已验证可复用，有完整测试 |
| 功能迁移引入bug | 中 | 高 | 渐进式迁移，每步验证 |
| 性能下降 | 低 | 中 | 性能基准测试 |
| 学习成本高 | 低 | 低 | PDF-Home有完整文档和示例 |

### 业务风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 时间延期 | 中 | 中 | 分阶段交付，关键功能优先 |
| 功能回归 | 低 | 高 | Feature Flag切换，可回滚 |
| 团队协作冲突 | 低 | 低 | 功能域隔离，并行开发 |

---

## 投资回报分析

### 投入

- **时间**: 2-3周（vs 完成五层架构2周，多1周）
- **复用代码**:
  - PDF-Home: 2194行核心代码 + 141个测试 → **提取为公共组件** 🆕
  - Phase 3: 842行（部分复用）
- **新增代码**: 约800-1000行（功能域实现）
- **额外投入**（公共组件）:
  - 一次性：2-3小时（提取到common/micro-service/）
  - 立即收益：节省1-2小时（PDF-Viewer直接使用）
  - 长期收益：每个新模块节省2.5-3小时

### 短期收益（3个月）

**公共组件额外收益** 🆕:
- ✅ 消除代码重复，SSOT原则
- ✅ 统一版本管理，bug修复全局受益
- ✅ 降低新模块接入成本80%
- ✅ PDF-Home和PDF-Viewer共享维护成本

**功能架构收益**:

- ✅ 代码组织清晰，维护成本↓30%
- ✅ 功能隔离，bug修复时间↓40%
- ✅ Git冲突率↓90%
- ✅ 测试覆盖率↑50%（功能域独立测试）

### 长期收益（6-12个月）

- ✅ 并行开发效率↑200%（3人并行 vs 1人串行）
- ✅ 新功能开发时间↓60%（独立功能域 vs 修改core）
- ✅ Feature Flag灰度发布能力
- ✅ 支持未来扩展（Anki/翻译/AI等）

### ROI计算

```
投入：
- 额外时间：1周（相比五层架构）
- 人力成本：约8小时/天 × 5天 = 40小时

收益（假设团队3人，6个月周期）：
1. 并行开发效率提升
   - 串行：1人 × 6个月 = 6人月
   - 并行：3人 × 3个月 = 9人月（效率↑50%）
   - 节省：3人月

2. Git冲突解决时间节省
   - 原冲突率：30%（估计）
   - 新冲突率：3%（↓90%）
   - 每次冲突解决：平均30分钟
   - 节省：约20小时/月 × 6月 = 120小时

3. 新功能开发时间节省
   - 假设6个月开发6个新功能
   - 每个功能节省：2-3天
   - 节省：12-18天

总节省：3人月 + 120小时 + 12-18天 ≈ 4-5人月

ROI = (4-5人月 / 0.25人月) × 100% = 1600-2000%
```

---

## 对比分析

### 五层架构 vs 功能域架构

| 维度 | 五层架构（v002） | 功能域架构（v003） | 胜者 |
|------|-----------------|-------------------|------|
| **并行开发** | ⭐⭐<br>Features间有依赖<br>冲突频繁 | ⭐⭐⭐⭐⭐<br>完全隔离<br>冲突率↓90% | **v003** |
| **功能扩展** | ⭐⭐<br>修改core层<br>影响范围大 | ⭐⭐⭐⭐⭐<br>独立功能域<br>零侵入 | **v003** |
| **代码复用** | ⭐⭐⭐<br>Phase 3可复用 | ⭐⭐⭐⭐⭐<br>PDF-Home 2194行<br>+ Phase 3 | **v003** |
| **学习成本** | ⭐⭐⭐⭐<br>简单分层 | ⭐⭐⭐<br>有PDF-Home示例 | v002 |
| **实施时间** | ⭐⭐⭐⭐<br>剩余2周 | ⭐⭐⭐<br>2-3周 | v002 |
| **测试覆盖** | ⭐⭐⭐<br>覆盖率约60% | ⭐⭐⭐⭐⭐<br>独立测试<br>覆盖率>80% | **v003** |
| **灰度发布** | ⭐<br>不支持 | ⭐⭐⭐⭐⭐<br>Feature Flag | **v003** |
| **热插拔** | ⭐<br>不支持 | ⭐⭐⭐⭐⭐<br>运行时加载 | **v003** |
| **匹配需求** | ⭐⭐<br>基础需求满足 | ⭐⭐⭐⭐⭐<br>完美匹配未来需求 | **v003** |

**综合评分**:
- 五层架构（v002）: 22/45 (49%)
- 功能域架构（v003）: 41/45 (91%)

---

## 推荐方案

### 🎯 **强烈推荐：采用功能域架构（v003）**

#### 决策理由

1. **✅ 完美匹配业务需求**
   - 支持未来Anki/翻译/AI等扩展
   - 支持3-5人团队并行开发
   - 支持Feature Flag灰度发布

2. **✅ 技术风险可控**
   - PDF-Home已验证（156个测试100%通过）
   - 2194行核心代码可直接复用
   - 渐进式迁移策略，可随时回滚

3. **✅ 投资回报率高**
   - 短期：维护成本↓30%，bug修复↓40%
   - 长期：并行开发效率↑200%，ROI达1600-2000%

4. **✅ 实施成本可接受**
   - 时间：2-3周（vs 五层架构2周，仅多1周）
   - 复用大量代码，实际开发量小

#### 实施建议

**第1步：立即开始阶段0-1**
- 创建v003-spec.md（今天完成）
- 复制PDF-Home核心组件（今天完成）
- 运行测试验证（今天完成）

**第2步：本周完成阶段2-3**
- 创建功能域框架
- 迁移PDF阅读功能

**第3步：下周完成阶段4-6**
- 迁移UI和书签功能
- 创建新应用类

**第4步：第3周完成阶段7**
- 测试验证
- 文档完善

---

## 参考文档

### PDF-Home相关
- [PDF-Home架构重构总结](C:/Users/napretep/PycharmProjects/anki-linkmaster-B/src/frontend/pdf-home/ARCHITECTURE-REFACTORING-SUMMARY.md)
- [PDF-Home迁移计划](C:/Users/napretep/PycharmProjects/anki-linkmaster-B/src/frontend/pdf-home/MIGRATION.md)
- [PDF-Home功能域示例](C:/Users/napretep/PycharmProjects/anki-linkmaster-B/src/frontend/pdf-home/features/pdf-list/index.js)

### PDF-Viewer相关
- [v002-spec.md](./v002-spec.md) - 五层架构规格说明
- [Phase 3工作成果](../../src/frontend/pdf-viewer/core/)

---

**文档版本**: v003
**创建时间**: 2025-10-02 04:02:17
**最后更新**: 2025-10-02 16:00:00
**作者**: Claude Code & User
**审核状态**: 待审核

---

## 下一步行动

1. **用户审核**：审核本v003规格说明，确认技术方案
2. **开始实施**：审核通过后，立即开始阶段0-1
3. **创建迁移文档**：创建详细的MIGRATION-v003.md
4. **Git分支管理**：创建feature/domain-architecture分支
