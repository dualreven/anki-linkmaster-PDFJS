# PDF-Viewer架构重构规格说明

**功能ID**: 20251002040217-pdf-viewer-architecture-refactoring
**优先级**: 高
**版本**: v002
**创建时间**: 2025-10-02 04:02:17
**更新时间**: 2025-10-02 12:32:17
**预计完成**: 2025-10-09
**状态**: 设计中

## 文档导航

本规格说明由于内容较多，采用主文档 + 附属文档的结构：

- **v002-spec.md** (本文档) - 主规格说明，包含核心架构设计
- **v002-appendix-collaboration.md** - 协作开发详细指南
- **v002-appendix-implementation.md** - 详细实施步骤和代码示例
- **v002-appendix-testing.md** - 测试清单和验收标准细节

---

## 版本变更说明 (v001 → v002)

### 新增内容
1. **分层架构设计原则** - 明确 5 层架构和依赖规则
2. **协作开发隔离机制** - 4 人小团队协作规范
3. **TypeScript 类型定义要求** - 接口稳定性保证
4. **依赖检查工具配置** - dependency-cruiser 集成
5. **Handler 抽象机制** - 统一事件处理器基类

### 调整内容
1. **分层顺序调整** - 从 "应用→协调→功能→基础→适配" 调整为 "功能→核心→基础→适配→应用"
2. **Handler 职责拆分** - 从独立目录改为分散到各层子模块
3. **接口兼容性策略** - 废弃接口无需保留，直接删除并更新文档

---

## 现状说明

### PDF-Viewer模块当前状态
- **整体架构**: 事件驱动的分层架构，已经过多次重构
- **分层设计**: 应用层(App/AppCore) → 协调层(PDFManager/UIManager) → 功能层(Handler/Component) → 基础层(EventBus/WSClient)
- **依赖注入**: 使用容器模式管理依赖(app-container.js)
- **模块化**: PDF功能已拆分为5个子模块，UI功能拆分为6个子组件
- **事件系统**: 89处事件发射/监听，分布在20个文件中

### 已有功能基础
- ✅ 事件总线架构 (EventBus)
- ✅ 依赖注入容器 (AppContainer)
- ✅ 模块化拆分 (pdf/, ui/, handlers/)
- ✅ 规范文档体系 (docs/SPEC/)
- ✅ 测试框架 (Jest + __tests__/)

---

## 存在问题

### 问题分类体系

#### 【严重】P0 - 必须立即修复
影响代码库可维护性和可理解性的核心问题

#### 【重要】P1 - 应该尽快修复
影响开发效率和代码质量的问题

#### 【次要】P2 - 可以计划优化
影响代码整洁度和一致性的问题

---

### P0-1: 文件组织混乱 【严重】

**问题描述**:
根目录堆积19个文件，包含JS、Python、HTML、备份文件混杂在一起

**具体表现**:
```
src/frontend/pdf-viewer/
├── main.js, app.js, app-core.js           # 入口文件
├── pdf-manager.js, ui-manager.js          # 导出桥接文件
├── event-handlers.js, eventbus.js         # 事件相关
├── websocket-handler.js                   # WebSocket
├── page-transfer-*.js                     # 页面传输
├── ui-*.js (5个文件)                       # UI组件
├── launcher.py, main_window.py            # Python文件
├── pdf_viewer_bridge.py                   # Qt桥接
├── js_console_logger*.py                  # 日志处理
├── index.html, style.css                  # 静态资源
├── ui-manager.js.backup                   # 备份文件
├── index.backup2.html                     # 备份文件
└── index.temp.html                        # 临时文件
```

**影响范围**:
- 代码定位困难，新人上手成本高
- 文件关系不清晰，维护成本增加
- 备份和临时文件污染代码库

**期望状态**:
根目录只保留入口文件(main.js, index.html)和少量配置文件，其他文件按功能分类到子目录

---

### P0-2: 重构遗留冗余 【严重】

**问题描述**:
多次重构后留下大量过渡性文件和命名混乱

**具体表现**:

1. **导出桥接文件** (无实际功能):
   - `pdf-manager.js` → `pdf/pdf-manager-refactored.js`
   - `event-handlers.js` → `handlers/event-handlers-refactored.js`
   - `ui-manager.js` → `ui/ui-manager-core-refactored.js`

2. **-refactored 后缀混乱**:
   - `pdf-manager-refactored.js` (使用后缀)
   - `pdf-loader.js` (不使用后缀)
   - `ui-manager-core-refactored.js` (使用后缀)
   - `event-handlers-refactored.js` (使用后缀)

3. **备份文件残留**:
   - `ui-manager.js.backup`
   - `index.backup2.html`

**影响范围**:
- 混淆视听，增加理解成本
- 导入路径冗余，需要多层跳转
- 命名不一致，降低代码质量

**期望状态**:
- 删除所有桥接文件，直接导入实际模块
- 统一移除 `-refactored` 后缀
- 清理所有备份文件

---

### P0-3: 继承设计不合理 【严重】

**问题描述**:
PDFViewerApp 继承 PDFViewerAppCore，违反"组合优于继承"原则

**具体代码**:
```javascript
// app.js
export class PDFViewerApp extends PDFViewerAppCore {
  #eventHandlers;

  constructor(options = {}) {
    super(options);
    this.#eventHandlers = new EventHandlers(this);
  }
}

// app-core.js (340行)
export class PDFViewerAppCore {
  #logger; #eventBus; #errorHandler;
  #pdfManager; #uiManager; #bookmarkManager;
  #wsClient; #messageQueue; #consoleBridge;
  #appContainer;
  // ... 包含完整的应用功能
}
```

**问题分析**:
- AppCore 已经是完整应用，App 只是添加了 EventHandlers
- 职责划分不清晰，继承关系无意义
- 违反单一职责原则，AppCore 职责过重(340行)
- 难以单独测试和复用

**影响范围**:
- 架构设计不清晰
- 增加理解和维护难度
- 不符合现代前端最佳实践

**期望状态**:
使用组合模式重构，将 AppCore 拆分为多个独立的协调器和管理器

---

### P1-1: app-core.js 职责过重 【重要】

**问题描述**:
app-core.js 340行代码承担过多职责

**职责清单**:
1. 容器管理 (创建和管理 AppContainer)
2. 依赖管理 (管理 logger, eventBus, wsClient)
3. 模块协调 (协调 PDFManager, UIManager, BookmarkManager)
4. WebSocket消息处理 (handleWebSocketMessage, handleLoadPdfFileMessage)
5. 状态管理 (currentFile, currentPage, totalPages, zoomLevel)
6. 生命周期管理 (initialize, destroy, onInitialized)
7. 全局错误处理 (setupGlobalErrorHandling)
8. Console桥接管理 (consoleBridge)
9. 消息队列管理 (messageQueue)
10. PDF渲染协调 (renderToViewer)

**问题分析**:
- 单个文件承担10+项职责，严重违反单一职责原则
- 难以单独测试每个功能
- 修改任一功能都可能影响其他功能
- 代码耦合度高，复用困难

**影响范围**:
- 维护困难，修改成本高
- 测试覆盖度低
- 代码可读性差

**期望状态**:
拆分为多个独立模块:
- `core/coordinator.js` - 模块协调
- `core/state-manager.js` - 状态管理
- `core/lifecycle-manager.js` - 生命周期
- `adapters/websocket-adapter.js` - WebSocket适配

---

### P1-2: 事件总线封装无价值 【重要】

**问题描述**:
eventbus.js 对 common/event/event-bus.js 做了一层无意义的封装

**具体代码**:
```javascript
// eventbus.js (80行)
export class PDFViewerEventBus {
  #eventBus;
  #logger;

  constructor(options = {}) {
    this.#eventBus = new EventBus({ enableValidation: true, ...options });
    this.#logger = getLogger("PDFViewer");
  }

  on(event, callback, options = {}) {
    this.#validateEventName(event);  // 只是警告，不强制
    return this.#eventBus.on(event, callback, options);
  }

  // 其他方法都是简单代理
}
```

**问题分析**:
- 封装层只做了名称验证(且只是警告)，没有实际价值
- 增加了不必要的抽象层
- 所有模块都在用 common 的 EventBus 单例，这个封装没有被使用
- 浪费代码行数和维护成本

**影响范围**:
- 代码冗余
- 增加理解成本
- 维护额外的封装代码

**期望状态**:
- 删除 eventbus.js
- 所有模块直接使用 `common/event/event-bus.js` 的单例
- 事件验证逻辑移到事件常量定义或 linter 规则

---

### P1-3: WebSocket处理分散 【重要】

**问题描述**:
WebSocket消息处理逻辑分散在3个地方，职责不清晰

**代码分布**:

1. **app-core.js** (处理业务消息):
```javascript
handleWebSocketMessage(message) {
  switch (type) {
    case 'load_pdf_file':
      this.handleLoadPdfFileMessage(data);
      break;
  }
}

handleLoadPdfFileMessage(data) {
  // 解析并发射事件
  this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, ...);
}
```

2. **container/app-container.js** (设置消息监听):
```javascript
function setupMessageHandlers() {
  wsClient.onMessage((message) => {
    eventBus.emit(WEBSOCKET_MESSAGE_EVENTS[message.type], message);
  });
}
```

3. **websocket-handler.js** (文件存在但作用不明):
```javascript
// 这个文件的职责不清晰，与上述两处有重叠
```

**问题分析**:
- 消息处理流程: WSClient → Container转发 → AppCore解析 → 发射事件
- 流程过长，增加追踪难度
- websocket-handler.js 的作用不明确
- 缺少统一的消息路由机制

**影响范围**:
- 难以理解WebSocket消息流
- 添加新消息类型需要修改多处
- 错误处理不统一

**期望状态**:
创建统一的 `adapters/websocket-adapter.js`:
- 统一处理所有WebSocket消息
- 消息路由到对应的事件
- 集中的错误处理和日志

---

### P1-4: Handler 目录职责不清 【重要】(v002新增)

**问题描述**:
当前 `handlers/` 目录作为独立层级存在，但其职责与各功能模块高度耦合

**具体表现**:
```
handlers/
├── event-handlers-refactored.js    # 协调所有handler
├── file-handler.js                  # PDF文件处理
├── navigation-handler.js            # PDF导航处理
└── zoom-handler.js                  # PDF缩放处理
```

**问题分析**:
- file-handler、navigation-handler、zoom-handler 都是 PDF 功能的一部分
- 与 `features/pdf/` 的职责边界不清晰
- 跨目录依赖增加理解成本
- 不利于功能模块的独立开发

**期望状态**:
- 抽象统一的 `BaseEventHandler` 基类
- 各功能模块内部实现自己的 handler
- 删除独立的 `handlers/` 目录

---

### P2-1: Python与JS混杂 【次要】

**问题描述**:
Python文件散落在前端JS模块目录中

**文件列表**:
- `launcher.py` - Python启动器
- `main_window.py` - Qt主窗口
- `pdf_viewer_bridge.py` - Qt桥接器
- `js_console_logger.py` - 日志处理
- `js_console_logger_qt.py` - Qt日志处理

**问题分析**:
- 违反前端/后端分离原则
- 目录结构不清晰
- 不利于独立部署和测试

**影响范围**:
- 轻微影响代码组织清晰度
- 对功能无实际影响

**期望状态**:
将Python文件移到独立的 `qt-integration/` 目录

---

### P2-2: 临时文件污染 【次要】

**问题描述**:
临时文件和日志目录在版本控制中

**文件列表**:
- `index.temp.html`
- `logs/` 目录

**问题分析**:
- 应该在 .gitignore 中排除
- 污染代码库

**影响范围**:
- 轻微影响代码库整洁度

**期望状态**:
- 添加到 .gitignore
- 清理现有临时文件

---

### P2-3: 测试文件组织 【次要】

**问题描述**:
测试文件集中在 `__tests__/` 目录，与源码分离

**当前结构**:
```
src/frontend/pdf-viewer/
├── __tests__/
│   ├── main.test.js
│   ├── pdf-manager.test.js
│   └── ui-manager.test.js
├── pdf/
│   └── pdf-loader.js
└── ui/
    └── ui-manager-core.js
```

**问题分析**:
- 不符合就近原则
- 修改源码时不容易同步更新测试
- 不是最佳实践(现代前端推荐 `*.test.js` 模式)

**影响范围**:
- 轻微影响开发体验

**期望状态** (可选):
考虑采用 `模块.test.js` 模式:
```
pdf/
├── pdf-loader.js
├── pdf-loader.test.js
└── pdf-manager.js
```

---

## 分层架构设计原则 (v002新增)

### 核心理念

**单向依赖 + 事件解耦 + 接口契约**

- **单向依赖**: 上层可以依赖下层，下层不能依赖上层
- **事件解耦**: 同层模块之间通过事件总线通信
- **接口契约**: 模块间通过 TypeScript 类型定义和 JSDoc 约束接口

### 五层架构定义

```
Layer 3: 功能特性层 (features/)
    ↓ 依赖
Layer 2: 核心领域层 (core/)
    ↓ 依赖
Layer 1: 基础设施层 (shared/, common/)
    ↑ 被依赖
Layer 4: 适配器层 (adapters/)
    ↑ 被依赖
Layer 5: 应用入口层 (bootstrap/, main.js)
```

#### Layer 1: 基础设施层 (shared/, common/)
**职责**: 提供通用工具、事件总线、日志系统等基础能力

**内容**:
- `common/event/event-bus.js` - 事件总线单例
- `common/logger/logger.js` - 日志工具
- `common/utils/` - 通用工具函数

**依赖规则**:
- ✅ 可以依赖: 无（最底层）
- ❌ 不能依赖: 任何上层模块
- 📢 通信方式: 被上层直接导入使用

**示例**:
```javascript
// common/event/event-bus.js
export class EventBus {
  on(event, callback) { /* ... */ }
  emit(event, data) { /* ... */ }
}
export const globalEventBus = new EventBus();
```

---

#### Layer 2: 核心领域层 (core/)
**职责**: 应用协调、状态管理、生命周期管理

**内容**:
- `core/coordinator.js` - 模块协调器
- `core/state-manager.js` - 应用状态管理
- `core/lifecycle-manager.js` - 生命周期管理
- `core/base-event-handler.js` - 事件处理器基类 (v002新增)

**依赖规则**:
- ✅ 可以依赖: Layer 1 (shared/, common/)
- ❌ 不能依赖: Layer 3 (features/), Layer 4 (adapters/), Layer 5 (bootstrap/)
- 📢 通信方式: 通过事件总线与 features 通信

**示例**:
```javascript
// core/coordinator.js
import { globalEventBus } from '../common/event/event-bus.js';
import { PDF_EVENTS } from '../common/event/constants.js';

export class AppCoordinator {
  constructor() {
    this.eventBus = globalEventBus;
  }

  initialize() {
    // 发射初始化事件，features 自行监听
    this.eventBus.emit(PDF_EVENTS.APP.INIT);
  }
}
```

---

#### Layer 3: 功能特性层 (features/)
**职责**: 独立的业务功能模块（PDF、UI、书签等）

**内容**:
- `features/pdf/` - PDF 功能模块
  - `manager.js` - PDF 管理器
  - `loader.js` - PDF 加载器
  - `handlers/` - PDF 相关事件处理器
- `features/ui/` - UI 功能模块
  - `manager.js` - UI 管理器
  - `components/` - UI 组件
  - `handlers/` - UI 相关事件处理器
- `features/bookmark/` - 书签功能模块

**依赖规则**:
- ✅ 可以依赖: Layer 1 (common/), Layer 2 (core/)
- ❌ 不能依赖: 其他 feature 模块、Layer 4 (adapters/)、Layer 5 (bootstrap/)
- 📢 通信方式:
  - 监听 core 发出的事件
  - 发射自己的事件供其他模块监听
  - 跨 feature 通信必须通过事件总线

**示例**:
```javascript
// features/pdf/manager.js
import { globalEventBus } from '../../common/event/event-bus.js';
import { BaseEventHandler } from '../../core/base-event-handler.js';
import { PDF_EVENTS } from '../../common/event/constants.js';

export class PDFManager {
  constructor() {
    this.eventBus = globalEventBus;
    this.handler = new PDFEventHandler(this);
  }

  initialize() {
    // 监听来自 core 的初始化事件
    this.eventBus.on(PDF_EVENTS.APP.INIT, () => {
      this.handler.setup();
    });
  }
}
```

---

#### Layer 4: 适配器层 (adapters/)
**职责**: 外部系统接口适配（WebSocket、Qt桥接等）

**内容**:
- `adapters/websocket-adapter.js` - WebSocket 消息适配
- `adapters/qt-bridge.js` - Qt 桥接适配

**依赖规则**:
- ✅ 可以依赖: Layer 1 (common/)
- ❌ 不能依赖: Layer 2 (core/), Layer 3 (features/), Layer 5 (bootstrap/)
- 📢 通信方式:
  - 接收外部消息，转换为事件发射
  - 监听内部事件，转换为外部消息发送

**示例**:
```javascript
// adapters/websocket-adapter.js
import { globalEventBus } from '../common/event/event-bus.js';
import { WS_EVENTS, PDF_EVENTS } from '../common/event/constants.js';

export class WebSocketAdapter {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.eventBus = globalEventBus;
  }

  setup() {
    // 外部 → 内部: WebSocket消息转为事件
    this.wsClient.onMessage((msg) => {
      if (msg.type === 'load_pdf') {
        this.eventBus.emit(PDF_EVENTS.FILE.LOAD.REQUESTED, msg.data);
      }
    });

    // 内部 → 外部: 监听事件转为WebSocket消息
    this.eventBus.on(PDF_EVENTS.FILE.LOADED, (data) => {
      this.wsClient.send({ type: 'pdf_loaded', data });
    });
  }
}
```

---

#### Layer 5: 应用入口层 (bootstrap/, main.js)
**职责**: 应用启动引导和依赖组装

**内容**:
- `bootstrap/app-bootstrap.js` - 应用启动器
- `main.js` - 入口文件

**依赖规则**:
- ✅ 可以依赖: 所有层（负责组装）
- ❌ 不能依赖: 无
- 📢 通信方式: 创建实例并调用初始化方法

**示例**:
```javascript
// bootstrap/app-bootstrap.js
import { AppCoordinator } from '../core/coordinator.js';
import { PDFManager } from '../features/pdf/manager.js';
import { UIManager } from '../features/ui/manager.js';
import { WebSocketAdapter } from '../adapters/websocket-adapter.js';

export async function bootstrap(options) {
  // 1. 创建核心层实例
  const coordinator = new AppCoordinator();

  // 2. 创建功能层实例
  const pdfManager = new PDFManager();
  const uiManager = new UIManager();

  // 3. 创建适配器层实例
  const wsAdapter = new WebSocketAdapter(options.wsClient);

  // 4. 初始化顺序: 适配器 → 功能 → 核心
  await wsAdapter.setup();
  await pdfManager.initialize();
  await uiManager.initialize();
  await coordinator.initialize();

  return { coordinator, pdfManager, uiManager };
}
```

---

### 依赖检查配置 (v002新增)

使用 `dependency-cruiser` 工具进行依赖检查：

```javascript
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    // 禁止循环依赖
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },

    // Layer 1 (common) 不能依赖任何上层
    {
      name: 'common-no-upper-deps',
      severity: 'error',
      from: { path: '^src/frontend/pdf-viewer/common' },
      to: {
        path: '^src/frontend/pdf-viewer/(core|features|adapters|bootstrap)'
      }
    },

    // Layer 2 (core) 不能依赖 features/adapters/bootstrap
    {
      name: 'core-no-feature-deps',
      severity: 'error',
      from: { path: '^src/frontend/pdf-viewer/core' },
      to: {
        path: '^src/frontend/pdf-viewer/(features|adapters|bootstrap)'
      }
    },

    // Layer 3 (features) 不能互相依赖
    {
      name: 'features-no-cross-deps',
      severity: 'error',
      from: { path: '^src/frontend/pdf-viewer/features/([^/]+)' },
      to: {
        path: '^src/frontend/pdf-viewer/features/(?!\\1)([^/]+)',
        pathNot: '^src/frontend/pdf-viewer/features/\\1'
      }
    },

    // Layer 3 (features) 不能依赖 adapters/bootstrap
    {
      name: 'features-no-adapter-deps',
      severity: 'error',
      from: { path: '^src/frontend/pdf-viewer/features' },
      to: {
        path: '^src/frontend/pdf-viewer/(adapters|bootstrap)'
      }
    },

    // Layer 4 (adapters) 不能依赖 core/features/bootstrap
    {
      name: 'adapters-only-common',
      severity: 'error',
      from: { path: '^src/frontend/pdf-viewer/adapters' },
      to: {
        path: '^src/frontend/pdf-viewer/(core|features|bootstrap)'
      }
    }
  ]
};
```

**CI 集成**:
```json
// package.json
{
  "scripts": {
    "check:deps": "depcruise --config .dependency-cruiser.js src/frontend/pdf-viewer",
    "test:pre-commit": "npm run check:deps && npm run test"
  }
}
```

> **📖 延伸阅读**: 依赖检查的详细配置和 CI 集成请参见 `v002-appendix-collaboration.md` - "CI/CD 集成"

---

## Handler 抽象机制 (v002新增)

### 设计理念

将原本独立的 `handlers/` 目录拆分到各功能模块内部，通过抽象基类统一接口。

### BaseEventHandler 基类

```javascript
// core/base-event-handler.js
import { getLogger } from '../common/logger/logger.js';

/**
 * 事件处理器基类
 * 所有功能模块的 handler 都应继承此类
 *
 * @abstract
 */
export class BaseEventHandler {
  #logger;
  #eventBus;
  #listeners = [];

  /**
   * @param {Object} context - 上下文对象（通常是功能模块的 manager）
   * @param {EventBus} eventBus - 事件总线实例
   * @param {string} name - Handler 名称（用于日志）
   */
  constructor(context, eventBus, name) {
    if (new.target === BaseEventHandler) {
      throw new Error('BaseEventHandler is abstract and cannot be instantiated');
    }

    this.context = context;
    this.#eventBus = eventBus;
    this.#logger = getLogger(name || this.constructor.name);
  }

  /**
   * 设置事件监听
   * 子类必须实现此方法
   * @abstract
   */
  setup() {
    throw new Error('setup() must be implemented by subclass');
  }

  /**
   * 注册事件监听（带自动清理）
   * @protected
   */
  _on(event, callback, options = {}) {
    const wrappedCallback = (...args) => {
      try {
        callback.apply(this, args);
      } catch (error) {
        this.#logger.error(`Error in ${event} handler:`, error);
      }
    };

    const unsubscribe = this.#eventBus.on(event, wrappedCallback, options);
    this.#listeners.push({ event, unsubscribe });
    return unsubscribe;
  }

  /**
   * 发射事件
   * @protected
   */
  _emit(event, data) {
    this.#logger.debug(`Emitting event: ${event}`, data);
    this.#eventBus.emit(event, data);
  }

  /**
   * 清理所有监听器
   */
  destroy() {
    this.#listeners.forEach(({ event, unsubscribe }) => {
      unsubscribe();
      this.#logger.debug(`Unsubscribed from: ${event}`);
    });
    this.#listeners = [];
  }
}
```

### 功能模块 Handler 示例

```javascript
// features/pdf/handlers/pdf-event-handler.js
import { BaseEventHandler } from '../../../core/base-event-handler.js';
import { PDF_EVENTS } from '../../../common/event/constants.js';

/**
 * PDF 模块事件处理器
 */
export class PDFEventHandler extends BaseEventHandler {
  constructor(pdfManager, eventBus) {
    super(pdfManager, eventBus, 'PDFEventHandler');
  }

  setup() {
    // 监听文件加载请求
    this._on(PDF_EVENTS.FILE.LOAD.REQUESTED, this.handleLoadRequest);

    // 监听页面导航
    this._on(PDF_EVENTS.PAGE.NAVIGATE, this.handlePageNavigate);

    // 监听缩放
    this._on(PDF_EVENTS.ZOOM.CHANGE, this.handleZoomChange);
  }

  handleLoadRequest = async ({ filePath }) => {
    try {
      const pdfDoc = await this.context.loadPDF(filePath);
      this._emit(PDF_EVENTS.FILE.LOADED, { document: pdfDoc });
    } catch (error) {
      this._emit(PDF_EVENTS.FILE.LOAD_FAILED, { error });
    }
  }

  handlePageNavigate = ({ pageNumber }) => {
    this.context.setCurrentPage(pageNumber);
    this._emit(PDF_EVENTS.PAGE.CHANGED, { pageNumber });
  }

  handleZoomChange = ({ level }) => {
    this.context.setZoomLevel(level);
    this._emit(PDF_EVENTS.ZOOM.CHANGED, { level });
  }
}
```

### 目录结构调整

```
features/
├── pdf/
│   ├── manager.js                    # PDF管理器
│   ├── loader.js                     # PDF加载器
│   ├── handlers/                     # PDF事件处理器
│   │   ├── pdf-event-handler.js      # 主处理器
│   │   └── index.js                  # 导出入口
│   └── index.js                      # 模块导出
├── ui/
│   ├── manager.js                    # UI管理器
│   ├── components/                   # UI组件
│   ├── handlers/                     # UI事件处理器
│   │   ├── ui-event-handler.js
│   │   └── index.js
│   └── index.js
└── bookmark/
    ├── manager.js
    ├── handlers/
    │   └── bookmark-event-handler.js
    └── index.js
```

> **📖 延伸阅读**:
> - BaseEventHandler 完整实现请参见 `v002-appendix-implementation.md` - "2.1 BaseEventHandler 实现"
> - PDF/UI Handler 示例请参见 `v002-appendix-implementation.md` - "2.2/2.3 Handler 实现示例"
> - Handler 单元测试请参见 `v002-appendix-testing.md` - "1. BaseEventHandler 测试"

---

## TypeScript 类型定义要求 (v002新增)

### 目的
- 提供接口稳定性保证
- 增强 IDE 代码提示
- 减少跨模块调用错误

### 实施方式

#### 1. 类型定义文件组织

```
src/frontend/pdf-viewer/
├── types/
│   ├── common.d.ts           # 通用类型
│   ├── events.d.ts           # 事件类型
│   ├── pdf.d.ts              # PDF模块类型
│   ├── ui.d.ts               # UI模块类型
│   └── index.d.ts            # 类型导出
└── jsconfig.json             # JS项目配置
```

#### 2. 事件类型定义示例

```typescript
// types/events.d.ts

/**
 * PDF文件加载请求事件数据
 */
export interface PDFLoadRequestData {
  /** 文件路径 */
  filePath: string;
  /** 初始页码（可选） */
  initialPage?: number;
}

/**
 * PDF文件加载成功事件数据
 */
export interface PDFLoadedData {
  /** PDF文档对象 */
  document: PDFDocumentProxy;
  /** 总页数 */
  totalPages: number;
  /** 文件元数据 */
  metadata?: Record<string, any>;
}

/**
 * 事件总线类型定义
 */
export interface EventBus {
  on<T = any>(event: string, callback: (data: T) => void, options?: EventOptions): () => void;
  emit<T = any>(event: string, data: T): void;
  off(event: string, callback?: Function): void;
}

export interface EventOptions {
  once?: boolean;
  priority?: number;
}
```

#### 3. 模块接口类型定义

```typescript
// types/pdf.d.ts

import { EventBus } from './events';
import { PDFLoadRequestData, PDFLoadedData } from './events';

/**
 * PDF管理器接口
 */
export interface IPDFManager {
  /**
   * 初始化PDF管理器
   */
  initialize(): Promise<void>;

  /**
   * 加载PDF文件
   * @param filePath - 文件路径
   * @returns PDF文档对象
   */
  loadPDF(filePath: string): Promise<PDFDocumentProxy>;

  /**
   * 获取当前页码
   */
  getCurrentPage(): number;

  /**
   * 设置当前页码
   * @param pageNumber - 页码（从1开始）
   */
  setCurrentPage(pageNumber: number): void;

  /**
   * 销毁PDF管理器
   */
  destroy(): void;
}

/**
 * PDF加载器接口
 */
export interface IPDFLoader {
  load(url: string, options?: LoadOptions): Promise<PDFDocumentProxy>;
  cancel(): void;
}

export interface LoadOptions {
  cMapUrl?: string;
  cMapPacked?: boolean;
  withCredentials?: boolean;
}
```

#### 4. JSDoc 使用类型定义

```javascript
// features/pdf/manager.js

/**
 * @typedef {import('../../types/pdf').IPDFManager} IPDFManager
 * @typedef {import('../../types/events').EventBus} EventBus
 * @typedef {import('../../types/events').PDFLoadRequestData} PDFLoadRequestData
 */

/**
 * PDF管理器
 * @implements {IPDFManager}
 */
export class PDFManager {
  /** @type {EventBus} */
  #eventBus;

  /** @type {number} */
  #currentPage = 1;

  /**
   * @param {EventBus} eventBus - 事件总线实例
   */
  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  /**
   * 加载PDF文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<PDFDocumentProxy>}
   */
  async loadPDF(filePath) {
    // 实现...
  }

  /**
   * @returns {number}
   */
  getCurrentPage() {
    return this.#currentPage;
  }
}
```

#### 5. jsconfig.json 配置

```json
// jsconfig.json
{
  "compilerOptions": {
    "module": "ES6",
    "target": "ES2020",
    "checkJs": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@common/*": ["src/frontend/common/*"],
      "@pdf-viewer/*": ["src/frontend/pdf-viewer/*"]
    }
  },
  "include": [
    "src/frontend/pdf-viewer/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

> **📖 延伸阅读**:
> - 完整类型定义示例请参见 `v002-appendix-implementation.md` - "阶段5: 类型定义创建"
> - 协作开发中类型的作用请参见 `v002-appendix-collaboration.md` - "接口稳定性保证"

---

## 提出需求

### 核心目标
**系统性重构 PDF-Viewer 模块架构**，消除重构遗留问题，建立清晰的分层目录结构和职责划分，提升代码可维护性和可理解性，支持小团队协作开发。

### 具体需求

#### 需求1: 建立分层架构 【P0】
按照五层架构重组代码结构

**目标结构**:
```
src/frontend/pdf-viewer/
├── common/                   # Layer 1: 基础设施层（已存在于上级目录）
├── core/                     # Layer 2: 核心领域层
│   ├── coordinator.js
│   ├── state-manager.js
│   ├── lifecycle-manager.js
│   └── base-event-handler.js
├── features/                 # Layer 3: 功能特性层
│   ├── pdf/
│   │   ├── manager.js
│   │   ├── loader.js
│   │   ├── document-manager.js
│   │   ├── cache-manager.js
│   │   ├── config.js
│   │   ├── handlers/
│   │   │   └── pdf-event-handler.js
│   │   └── index.js
│   ├── ui/
│   │   ├── manager.js
│   │   ├── components/
│   │   │   ├── zoom-controls.js
│   │   │   ├── progress-error.js
│   │   │   ├── layout-controls.js
│   │   │   ├── keyboard-handler.js
│   │   │   └── text-layer-manager.js
│   │   ├── handlers/
│   │   │   └── ui-event-handler.js
│   │   └── index.js
│   ├── bookmark/
│   │   ├── manager.js
│   │   ├── data-provider.js
│   │   └── index.js
│   └── page-transfer/
│       ├── core.js
│       ├── manager.js
│       └── index.js
├── adapters/                 # Layer 4: 适配器层
│   ├── websocket-adapter.js
│   └── qt-bridge.js
├── bootstrap/                # Layer 5: 应用入口层
│   └── app-bootstrap.js
├── container/                # 依赖注入容器
│   └── app-container.js
├── qt-integration/           # Qt集成（Python）
│   ├── launcher.py
│   ├── main_window.py
│   ├── pdf_viewer_bridge.py
│   └── js_console_logger_qt.py
├── types/                    # TypeScript类型定义
│   ├── common.d.ts
│   ├── events.d.ts
│   ├── pdf.d.ts
│   ├── ui.d.ts
│   └── index.d.ts
├── assets/                   # 静态资源
│   ├── index.html
│   └── style.css
├── __tests__/                # 集成测试
├── main.js                   # 入口文件
├── jsconfig.json             # JS项目配置
└── .dependency-cruiser.js    # 依赖检查配置
```

**详细实施步骤**: 见 `v002-appendix-implementation.md`

---

#### 需求2: 清理冗余代码 【P0】
删除所有重构遗留的桥接文件、备份文件、临时文件

**清理清单**:
- [ ] 删除 `pdf-manager.js` (桥接文件)
- [ ] 删除 `event-handlers.js` (桥接文件)
- [ ] 删除 `ui-manager.js` (桥接文件)
- [ ] 删除 `eventbus.js` (无价值封装)
- [ ] 删除 `websocket-handler.js` (被 adapter 替代)
- [ ] 删除 `ui-manager.js.backup`
- [ ] 删除 `index.backup2.html`
- [ ] 删除 `index.temp.html`
- [ ] 删除 `handlers/` 目录（handler 已拆分到各 feature）
- [ ] 更新所有导入路径

---

#### 需求3: 统一命名规范 【P0】
移除所有 `-refactored` 后缀，统一文件命名

**重命名清单**:
- [ ] `pdf/pdf-manager-refactored.js` → `features/pdf/manager.js`
- [ ] `ui/ui-manager-core-refactored.js` → `features/ui/manager.js`
- [ ] `handlers/event-handlers-refactored.js` → 拆分到各 feature 的 handlers/

---

#### 需求4: 架构重构 【P1】
移除继承，改用组合模式，拆分 app-core.js

**重构方案**:

1. **拆分 app-core.js** → 4个独立模块:
   - `core/coordinator.js` - 模块协调逻辑
   - `core/state-manager.js` - 状态管理
   - `core/lifecycle-manager.js` - 生命周期管理
   - `adapters/websocket-adapter.js` - WebSocket消息处理

2. **删除继承关系**:
   - 删除 `app.js` 中的 `extends PDFViewerAppCore`
   - 改用组合模式创建应用实例

3. **创建新的应用入口**:
```javascript
// bootstrap/app-bootstrap.js
export async function bootstrap(options) {
  // 详细代码见实施方案
}
```

**详细代码示例**: 见 `v002-appendix-implementation.md`

---

#### 需求5: 统一WebSocket处理 【P1】
创建统一的WebSocket适配器

**功能要求**:
- 统一处理所有WebSocket消息
- 消息类型路由到对应事件
- 集中的错误处理和日志
- 清晰的消息流向

**详细实现**: 见 `v002-appendix-implementation.md`

---

#### 需求6: 建立协作开发机制 【P0】(v002新增)
建立4人小团队协作开发规范

**核心要求**:
- 模块所有权明确
- 依赖检查自动化
- 事件契约文档化
- TypeScript 类型约束

**详细规范**: 见 `v002-appendix-collaboration.md`

---

#### 需求7: 添加类型定义 【P1】(v002新增)
为所有公共接口添加 TypeScript 类型定义

**覆盖范围**:
- 所有 feature 的公共接口
- 所有事件数据格式
- core 层的接口定义

**详细要求**: 见本文档 "TypeScript 类型定义要求" 章节

---

#### 需求8: 配置依赖检查 【P1】(v002新增)
集成 dependency-cruiser 自动检查依赖规则

**检查规则**:
- 禁止循环依赖
- 禁止违反分层规则
- 禁止 feature 间直接依赖

**配置详情**: 见本文档 "依赖检查配置" 章节

---

## 约束条件

### 1. 仅修改 PDF-Viewer 模块代码
仅修改 `src/frontend/pdf-viewer/` 目录下的代码，不可修改 `common/` 等共享模块的代码

### 2. 废弃接口直接删除 (v002更新)
- ❌ 不需要保留废弃接口的兼容层
- ✅ 直接删除旧代码并更新所有引用
- ✅ 在 CHANGELOG 中记录所有破坏性变更
- ✅ 提供清晰的迁移指南

### 3. 严格遵循代码规范
必须优先阅读和理解 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的代码规范，包括:
- FRONTEND-EVENT-BUS-001: 事件总线使用规范
- FRONTEND-EVENT-NAMING-001: 事件命名规范
- JAVASCRIPT-CLASS-STRUCTURE-001: JavaScript类结构规范
- JAVASCRIPT-FUNCTION-DESIGN-001: JavaScript函数设计规范
- PDF-VIEWER-STRUCTURE-001: PDF查看器模块结构规范

### 4. 渐进式重构原则
- 每个阶段完成后必须保证功能正常
- 每次提交都是可运行的状态
- 提供详细的迁移指南和文档

### 5. 依赖规则严格执行 (v002新增)
- CI 必须集成依赖检查
- 违反依赖规则的 PR 不允许合并
- 必须通过所有自动化检查

---

## 可行验收标准

### 单元测试
#### 测试1: 拆分后的模块独立性
- AppCoordinator 可以独立初始化和销毁
- StateManager 可以独立管理状态
- LifecycleManager 可以独立处理生命周期
- WebSocketAdapter 可以独立处理消息

#### 测试2: 组合模式正确性
- PDFViewerApp 正确组合各个组件
- 各组件之间通过接口通信
- 依赖关系清晰，无循环依赖

#### 测试3: BaseEventHandler 基类测试 (v002新增)
- 子类必须实现 setup() 方法
- _on() 方法自动捕获异常
- destroy() 方法清理所有监听器

### 集成测试

#### 测试1: 目录重组后功能完整性
- 所有导入路径正确更新
- 应用可以正常启动
- 所有功能正常工作 (PDF加载、导航、缩放、书签)
- WebSocket通信正常
- 事件系统正常

#### 测试2: 架构重构后兼容性
- 外部API接口保持不变
- 事件系统向后兼容
- 配置格式兼容
- 全局对象 window.pdfViewerApp 功能不变

#### 测试3: 依赖规则检查 (v002新增)
- dependency-cruiser 检查通过
- 无循环依赖
- 无违反分层规则的依赖
- 无 feature 间直接依赖

### 端到端测试

#### 场景1: 纯浏览器环境
- 应用在纯浏览器环境下正常启动
- PDF加载、导航、缩放功能正常
- 错误提示正常显示

#### 场景2: PyQt集成环境
- 应用在PyQt环境下正常启动
- 接收PyQt注入的配置
- QWebChannel桥接正常工作
- 外部UI组件正常集成

### 代码质量标准

#### 标准1: 文件组织
- 根目录文件数量 ≤ 3个 (main.js, jsconfig.json, .dependency-cruiser.js)
- 所有模块按功能分类到子目录
- 无备份文件、临时文件
- 目录结构符合五层架构

#### 标准2: 命名一致性
- 无 `-refactored` 后缀
- 文件命名符合规范 (kebab-case)
- 类命名符合规范 (PascalCase)
- 函数命名符合规范 (camelCase)

#### 标准3: 代码质量
- 单个文件行数 ≤ 200行
- 单个函数行数 ≤ 50行
- 单个类职责单一 (≤ 5个主要职责)
- 循环复杂度 ≤ 10
- ESLint 无警告和错误

#### 标准4: 类型定义完整性 (v002新增)
- 所有公共接口有 TypeScript 类型定义
- 所有事件数据有类型定义
- JSDoc 使用类型引用

---

## 实施计划

### 总体时间表
**总工作量**: 约 22-27 小时
**建议时间**: 4-5 个工作日

### 重构策略说明

本次重构按照**五层架构**从下到上依次进行：

```
阶段顺序 (从基础到应用):
  阶段1: Layer 1 基础设施层 (types/, jsconfig, 依赖检查)
  阶段2: Layer 4 适配器层 (WebSocketAdapter)
  阶段3: Layer 2 核心领域层 (BaseEventHandler, Coordinator, StateManager)
  阶段4: Layer 3 功能特性层 (features/pdf, features/ui, handlers 拆分)
  阶段5: Layer 5 应用入口层 (bootstrap, 组合模式)
```

---

### 阶段1: Layer 1 基础设施层准备 【P0】 (3-4小时)

**重构目标**:
建立类型系统和依赖检查机制，清理项目结构，为上层重构打下坚实基础。

**核心产出**:
- ✅ TypeScript 类型定义系统
- ✅ 依赖检查配置
- ✅ 清晰的目录结构
- ✅ 统一的命名规范

**任务清单**:
- [ ] **1.1 项目清理**
  - 删除备份文件 (ui-manager.js.backup, index.backup2.html, index.temp.html)
  - 删除桥接文件 (pdf-manager.js, event-handlers.js, ui-manager.js)
  - 删除无价值封装 (eventbus.js)
  - 移除 -refactored 后缀

- [ ] **1.2 目录结构创建**
  - 创建五层架构目录: core/, features/, adapters/, bootstrap/, types/
  - 移动 Python 文件到 qt-integration/
  - 移动静态资源到 assets/

- [ ] **1.3 类型系统建立**
  - 创建 types/common.d.ts (通用类型)
  - 创建 types/events.d.ts (事件类型)
  - 创建 types/pdf.d.ts (PDF 模块类型)
  - 创建 types/ui.d.ts (UI 模块类型)
  - 创建 types/index.d.ts (类型导出)

- [ ] **1.4 依赖检查配置**
  - 安装 dependency-cruiser: `npm install --save-dev dependency-cruiser`
  - 创建 .dependency-cruiser.js 配置文件
  - 配置 jsconfig.json 支持类型检查
  - 添加 npm scripts (check:deps, test:pre-commit)

- [ ] **1.5 路径更新**
  - 使用脚本批量更新导入路径
  - 更新测试文件路径
  - 运行 ESLint 检查

**验收标准**:
- ✅ 根目录只保留 main.js, jsconfig.json, .dependency-cruiser.js
- ✅ 无备份和临时文件，无 -refactored 后缀
- ✅ 所有类型定义文件创建完成，IDE 能识别类型
- ✅ 依赖检查配置完成并通过
- ✅ ESLint 无错误，应用可以正常启动

**详细步骤**: 见 `v002-appendix-implementation.md` - "阶段1: 目录重组脚本"

---

### 阶段2: Layer 4 适配器层重构 【P0】 (4-5小时)

**重构目标**:
隔离外部依赖，建立 WebSocket 适配器层，实现外部通信与内部逻辑的解耦。

**核心产出**:
- ✅ 统一的 WebSocketAdapter
- ✅ 外部消息到内部事件的转换机制
- ✅ 内部事件到外部消息的转换机制

**任务清单**:
- [ ] **2.1 创建 WebSocketAdapter**
  - 创建 adapters/websocket-adapter.js
  - 实现 WebSocket 消息路由 (message → event)
  - 实现事件到 WebSocket 桥接 (event → message)
  - 实现消息队列机制（初始化前缓存）
  - 添加集中的错误处理和日志

- [ ] **2.2 清理旧代码**
  - 删除 websocket-handler.js
  - 从 app-core.js 中移除 WebSocket 消息处理逻辑
  - 更新 container/app-container.js 的消息处理设置

- [ ] **2.3 编写单元测试**
  - WebSocketAdapter 消息路由测试
  - 消息队列机制测试
  - 错误处理测试

**验收标准**:
- ✅ WebSocketAdapter 单元测试通过
- ✅ WebSocket 通信功能正常
- ✅ websocket-handler.js 已删除
- ✅ 消息队列机制工作正常

**详细代码**: 见 `v002-appendix-implementation.md` - "3.4 WebSocketAdapter 实现"

---

### 阶段3: Layer 2 核心领域层重构 【P1】 (6-8小时)

**重构目标**:
拆分 app-core.js，建立 BaseEventHandler 抽象，形成清晰的核心层：协调-状态-生命周期三大职责分离。

**核心产出**:
- ✅ BaseEventHandler 抽象基类
- ✅ AppCoordinator (模块协调)
- ✅ StateManager (状态管理)
- ✅ LifecycleManager (生命周期管理)

**任务清单**:
- [ ] **3.1 创建 BaseEventHandler**
  - 创建 core/base-event-handler.js
  - 实现 _on() 方法（带错误捕获）
  - 实现 _emit() 方法（带日志）
  - 实现 destroy() 方法（自动清理监听器）
  - 实现抽象 setup() 方法
  - 编写单元测试

- [ ] **3.2 拆分 app-core.js → AppCoordinator**
  - 创建 core/coordinator.js
  - 提取模块管理逻辑（PDFManager, UIManager, BookmarkManager）
  - 提取初始化和销毁逻辑
  - 编写单元测试

- [ ] **3.3 拆分 app-core.js → StateManager**
  - 创建 core/state-manager.js
  - 提取状态字段 (currentFile, currentPage, totalPages, zoomLevel, initialized)
  - 实现 getState() 方法
  - 实现状态变更事件发射
  - 编写单元测试

- [ ] **3.4 拆分 app-core.js → LifecycleManager**
  - 创建 core/lifecycle-manager.js
  - 提取全局错误处理 (setupGlobalErrorHandling)
  - 提取 onInitialized 逻辑（处理消息队列）
  - 编写单元测试

- [ ] **3.5 清理旧代码**
  - 删除 app-core.js
  - 删除 app.js (继承关系)
  - 更新所有导入引用

**验收标准**:
- ✅ BaseEventHandler 测试通过 (覆盖率 ≥ 90%)
- ✅ AppCoordinator 测试通过
- ✅ StateManager 测试通过
- ✅ LifecycleManager 测试通过
- ✅ app-core.js 和 app.js 已删除
- ✅ 应用功能不受影响

**详细代码**: 见 `v002-appendix-implementation.md` - "阶段2/3: BaseEventHandler 和核心层实现"

---

### 阶段4: Layer 3 功能特性层重构 【P1】 (5-6小时)

**重构目标**:
重组业务功能到 features/，拆分 handlers/ 到各功能模块内部，实现功能模块的独立性和完整性。

**核心产出**:
- ✅ features/pdf/ (完整的 PDF 功能模块)
- ✅ features/ui/ (完整的 UI 功能模块)
- ✅ features/bookmark/ (完整的书签功能模块)
- ✅ 各模块独立的 handlers/

**任务清单**:
- [ ] **4.1 重组 PDF 功能模块**
  - 移动 pdf/ → features/pdf/
  - 重命名 pdf-manager-refactored.js → manager.js
  - 创建 features/pdf/handlers/pdf-event-handler.js (继承 BaseEventHandler)
  - 实现 PDF 事件处理 (load, navigate, zoom)
  - 创建 features/pdf/index.js 导出公共接口
  - 编写单元测试

- [ ] **4.2 重组 UI 功能模块**
  - 移动 ui/ → features/ui/
  - 重命名 ui-manager-core-refactored.js → manager.js
  - 移动 UI 组件到 features/ui/components/
  - 创建 features/ui/handlers/ui-event-handler.js (继承 BaseEventHandler)
  - 创建 features/ui/index.js 导出公共接口
  - 编写单元测试

- [ ] **4.3 重组书签功能模块**
  - 移动 bookmark/ → features/bookmark/
  - 创建 features/bookmark/handlers/bookmark-event-handler.js
  - 创建 features/bookmark/index.js
  - 编写单元测试

- [ ] **4.4 重组页面传输模块**
  - 移动 page-transfer-*.js → features/page-transfer/
  - 创建 features/page-transfer/index.js
  - 编写单元测试

- [ ] **4.5 清理旧代码**
  - 删除原 pdf/, ui/, bookmark/ 目录
  - 删除 handlers/ 目录
  - 删除 event-handlers-refactored.js
  - 更新所有导入路径

**验收标准**:
- ✅ 所有 feature 模块有独立的 handlers/
- ✅ 所有 handler 继承 BaseEventHandler
- ✅ 所有 feature 有 index.js 导出公共接口
- ✅ 旧 handlers/ 目录已删除
- ✅ 功能测试通过 (PDF加载、UI交互、书签操作)
- ✅ 依赖检查通过（无跨 feature 依赖）

**详细代码**: 见 `v002-appendix-implementation.md` - "2.2/2.3 PDF 模块 Handler 实现"

---

### 阶段5: Layer 5 应用入口层重构 【P1】 (4-5小时)

**重构目标**:
改继承为组合，建立现代化的应用启动流程，实现依赖注入和模块组装。

**核心产出**:
- ✅ bootstrap/app-bootstrap.js (应用启动器)
- ✅ main.js (使用组合模式)
- ✅ 完整的集成测试

**任务清单**:
- [ ] **5.1 创建应用启动器**
  - 创建 bootstrap/app-bootstrap.js
  - 实现 bootstrap() 函数
  - 组合 AppCoordinator, StateManager, LifecycleManager, WebSocketAdapter
  - 实现启动流程编排 (创建实例 → 设置 → 初始化 → 连接)
  - 返回应用实例对象

- [ ] **5.2 重写主入口**
  - 重写 main.js 使用 bootstrap()
  - 保留 window.pdfViewerApp 全局对象（向后兼容）
  - 添加友好的错误提示

- [ ] **5.3 清理旧代码**
  - 删除 app.js (继承版本)
  - 确认 app-core.js 已删除
  - 清理所有旧的启动逻辑

- [ ] **5.4 编写集成测试**
  - 应用启动流程测试
  - 模块协作测试
  - 事件流测试
  - 状态管理测试

- [ ] **5.5 端到端测试**
  - 纯浏览器环境测试
  - PyQt 集成环境测试

**验收标准**:
- ✅ bootstrap() 函数正常工作
- ✅ 应用使用组合模式（无继承）
- ✅ 所有功能正常 (PDF加载、导航、缩放、书签)
- ✅ 集成测试通过
- ✅ 端到端测试通过
- ✅ window.pdfViewerApp 可用（向后兼容）

**详细代码**: 见 `v002-appendix-implementation.md` - "阶段4: 组合模式重构"

---

### 阶段6: 完善和优化 【P2】 (3-4小时)

**重构目标**:
完善文档，优化代码质量，确保所有验收标准达标。

**核心产出**:
- ✅ 完整的项目文档
- ✅ 清晰的迁移指南
- ✅ 高质量的代码库

**任务清单**:
- [ ] **6.1 更新文档**
  - 更新 README.md (目录结构、架构图、API 文档)
  - 更新 SPEC 规范文档 (分层架构、组合模式)
  - 创建 MIGRATION.md 迁移指南
  - 创建 CHANGELOG.md 记录变更

- [ ] **6.2 代码质量优化**
  - 添加 JSDoc 注释
  - 优化函数命名
  - 统一代码风格
  - 移除不必要的日志

- [ ] **6.3 完善测试**
  - 补充缺失的单元测试
  - 提升测试覆盖率到 ≥ 80%
  - 添加边界情况测试

- [ ] **6.4 最终验收**
  - 运行完整测试套件
  - 运行依赖检查
  - 运行 ESLint 检查
  - 手动功能测试

**验收标准**:
- ✅ 文档完整准确
- ✅ 测试覆盖率 ≥ 80%
- ✅ ESLint 无警告无错误
- ✅ 依赖检查通过
- ✅ 所有功能正常

**详细清单**: 见 `v002-appendix-testing.md` - "验收标准检查表"

---

## 预期收益

### 1. 代码可维护性提升 【核心收益】
- **文件组织清晰**: 根目录只保留入口文件，所有代码按功能分类
- **职责划分明确**: 每个模块单一职责，平均文件行数降低 60%
- **命名统一规范**: 无混乱的后缀和桥接文件
- **依赖关系清晰**: 无循环依赖，导入路径一目了然

**量化指标**:
- 根目录文件数: 19 → 3 (减少 84%)
- 平均文件行数: 200 → 80 (减少 60%)
- 最大文件行数: 340 → 150 (减少 56%)

### 2. 代码可理解性提升 【核心收益】
- **架构清晰**: 组合模式取代继承，职责清晰可见
- **模块独立**: 每个模块可独立理解，降低学习曲线
- **文档完善**: 完整的架构说明和API文档
- **类型提示**: TypeScript 类型定义提供 IDE 支持 (v002新增)

**量化指标**:
- 新人上手时间: 2天 → 0.5天 (减少 75%)
- 代码理解难度: 高 → 低

### 3. 测试覆盖率提升 【质量保证】
- **模块独立测试**: 每个模块可独立mock和测试
- **测试编写容易**: 组合模式便于编写单元测试

**量化指标**:
- 测试覆盖率: 50% → 80% (提升 30%)
- 单元测试数量: 12 → 30+ (提升 150%)

### 4. 开发效率提升 【长期收益】
- **定位问题快**: 清晰的模块划分，快速定位问题
- **并行开发**: 不同模块可并行开发，减少冲突
- **重构容易**: 模块独立，重构影响范围小

**量化指标**:
- 问题定位时间: 30分钟 → 10分钟 (减少 67%)
- 代码冲突率: 高 → 低

### 5. 架构扩展性提升 【未来保障】
- **添加功能容易**: 新功能只需添加新模块
- **替换模块容易**: 模块独立，易于替换和升级
- **技术债降低**: 清晰的架构减少技术债累积

### 6. 协作开发效率提升 【团队收益】(v002新增)
- **模块所有权明确**: 减少沟通成本
- **依赖冲突减少**: 自动化检查防止违规依赖
- **接口稳定**: 类型定义减少跨模块调用错误

**量化指标**:
- 代码冲突率: 减少 50%
- 跨模块调用错误: 减少 70%

---

## 风险评估

### 技术风险

#### 风险1: 大规模路径更新可能遗漏 【中风险】
**描述**: 重组目录后需要更新大量导入路径，可能遗漏部分文件

**缓解措施**:
- 使用脚本自动化路径更新
- 运行 ESLint 检查语法错误
- 运行完整的测试套件
- 手动检查关键文件

**应急预案**:
- Git 保留完整历史，可随时回滚
- 分阶段提交，每个阶段独立可回滚

#### 风险2: 组合模式重构可能引入bug 【中风险】
**描述**: 改继承为组合涉及大量代码改动，可能引入新bug

**缓解措施**:
- 编写充分的单元测试和集成测试
- 分阶段重构，每步验证功能
- TypeScript 类型检查减少错误 (v002新增)

**应急预案**:
- Git 分支保留旧代码
- 快速回滚机制

#### 风险3: 依赖检查可能发现大量问题 【中风险】(v002新增)
**描述**: 首次运行依赖检查可能发现大量违规依赖

**缓解措施**:
- 先运行检查，评估工作量
- 分批修复，优先修复严重问题
- 允许暂时忽略部分规则

**应急预案**:
- 配置规则可以灵活调整
- 可以分阶段启用规则

### 业务风险

#### 风险1: 功能回归 【中风险】
**描述**: 大规模重构可能导致部分功能失效

**缓解措施**:
- 充分的测试覆盖
- 分阶段发布，渐进式验证
- 端到端测试覆盖主要场景

**应急预案**:
- 每个阶段独立可回滚
- 保留完整的Git历史

#### 风险2: 开发周期延长 【低风险】
**描述**: 重构工作量可能超出预期

**缓解措施**:
- 详细的任务拆分和时间估算
- 优先完成P0任务，P1和P2可延后
- 并行进行文档编写

**应急预案**:
- 分阶段交付，优先交付核心功能

### 风险总结

| 风险项 | 风险等级 | 影响 | 缓解措施完备性 | 综合评估 |
|--------|----------|------|----------------|----------|
| 路径更新遗漏 | 中 | 中 | 高 | 可控 |
| 组合重构bug | 中 | 高 | 高 | 可控 |
| 依赖检查问题 | 中 | 中 | 高 | 可控 |
| 功能回归 | 中 | 高 | 高 | 可控 |
| 周期延长 | 低 | 中 | 高 | 低 |

**总体评估**: 风险可控，缓解措施完备

---

## 附录索引

由于文档内容较多，详细的实施步骤、代码示例、测试清单等内容已拆分到独立附录文档：

### 📄 v002-appendix-collaboration.md
**协作开发详细指南**
- 模块所有权制度
- 接口稳定性保证
- 事件契约机制
- 并行开发约束
- Code Review 检查点
- 冲突解决流程

### 📄 v002-appendix-implementation.md
**详细实施步骤和代码示例**
- 目录重组脚本
- app-core.js 拆分详细代码
- 组合模式重构完整示例
- WebSocket 适配器实现
- Handler 拆分示例
- 路径更新脚本

### 📄 v002-appendix-testing.md
**测试清单和验收标准细节**
- 单元测试清单
- 集成测试清单
- 端到端测试清单
- 测试用例示例
- 测试覆盖率要求

---

**文档版本**: v002
**创建时间**: 2025-10-02 04:02:17
**最后更新**: 2025-10-02 12:32:17
**作者**: AI Assistant & User
**审核状态**: 待审核

---

## 下一步行动

1. **阅读附录文档**: 查看详细的协作指南和实施步骤
2. **评审本规格**: 确认需求和方案是否符合预期
3. **制定排期**: 根据实施计划制定具体排期
4. **开始实施**: 按阶段逐步执行重构任务
