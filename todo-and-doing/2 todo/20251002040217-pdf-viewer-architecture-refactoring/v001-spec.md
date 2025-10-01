# PDF-Viewer架构重构规格说明

**功能ID**: 20251002040217-pdf-viewer-architecture-refactoring
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 04:02:17
**预计完成**: 2025-10-09
**状态**: 设计中

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
将Python文件移到独立的 `python/` 或 `qt-integration/` 目录

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

## 提出需求

### 核心目标
**系统性重构 PDF-Viewer 模块架构**，消除重构遗留问题，建立清晰的目录结构和职责划分，提升代码可维护性和可理解性。

### 具体需求

#### 需求1: 目录结构重组 【P0】
建立清晰的分层目录结构，将根目录文件按功能归类

**目标结构**:
```
src/frontend/pdf-viewer/
├── core/                      # 核心模块
│   ├── app.js                 # 主应用类
│   ├── coordinator.js         # 模块协调器
│   ├── state-manager.js       # 状态管理
│   └── lifecycle-manager.js   # 生命周期管理
├── container/                 # 依赖注入容器
│   └── app-container.js
├── features/                  # 功能模块
│   ├── pdf/                   # PDF功能
│   │   ├── manager.js
│   │   ├── loader.js
│   │   ├── document-manager.js
│   │   ├── cache-manager.js
│   │   └── config.js
│   ├── ui/                    # UI功能
│   │   ├── manager.js
│   │   ├── zoom-controls.js
│   │   ├── progress-error.js
│   │   ├── layout-controls.js
│   │   ├── keyboard-handler.js
│   │   └── text-layer-manager.js
│   ├── bookmark/              # 书签功能
│   │   ├── manager.js
│   │   └── data-provider.js
│   └── page-transfer/         # 页面传输
│       ├── core.js
│       └── manager.js
├── handlers/                  # 事件处理器
│   ├── coordinator.js         # 处理器协调器
│   ├── file-handler.js
│   ├── navigation-handler.js
│   └── zoom-handler.js
├── adapters/                  # 适配器层
│   ├── websocket-adapter.js   # WebSocket适配
│   └── qt-bridge.js           # Qt桥接
├── bootstrap/                 # 启动引导
│   └── app-bootstrap.js
├── qt-integration/            # Qt集成 (Python)
│   ├── launcher.py
│   ├── main_window.py
│   ├── pdf_viewer_bridge.py
│   └── js_console_logger_qt.py
├── assets/                    # 静态资源
│   ├── index.html
│   └── style.css
├── __tests__/                 # 集成测试
└── main.js                    # 入口文件
```

#### 需求2: 清理冗余代码 【P0】
删除所有重构遗留的桥接文件、备份文件、临时文件

**清理清单**:
- [ ] 删除 `pdf-manager.js` (桥接文件)
- [ ] 删除 `event-handlers.js` (桥接文件)
- [ ] 删除 `eventbus.js` (无价值封装)
- [ ] 删除 `ui-manager.js.backup`
- [ ] 删除 `index.backup2.html`
- [ ] 删除 `index.temp.html`
- [ ] 更新所有导入路径

#### 需求3: 统一命名规范 【P0】
移除所有 `-refactored` 后缀，统一文件命名

**重命名清单**:
- [ ] `pdf-manager-refactored.js` → `manager.js`
- [ ] `pdf-document-manager.js` → `document-manager.js`
- [ ] `ui-manager-core-refactored.js` → `manager.js`
- [ ] `event-handlers-refactored.js` → `coordinator.js`

#### 需求4: 架构重构 【P1】
移除继承，改用组合模式，拆分 app-core.js

**重构方案**:

1. **拆分 app-core.js** → 4个独立模块:
   - `core/coordinator.js` - 模块协调逻辑
   - `core/state-manager.js` - 状态管理
   - `core/lifecycle-manager.js` - 生命周期管理
   - `adapters/websocket-adapter.js` - WebSocket消息处理

2. **重构 app.js** - 改继承为组合:
```javascript
export class PDFViewerApp {
  #coordinator;      // 协调器
  #stateManager;     // 状态管理器
  #lifecycleManager; // 生命周期管理器
  #eventHandlers;    // 事件处理器

  constructor(options) {
    const container = createContainer(options);
    this.#coordinator = new AppCoordinator(container);
    this.#stateManager = new StateManager();
    this.#lifecycleManager = new LifecycleManager();
    this.#eventHandlers = new EventHandlersCoordinator(this.#coordinator);
  }
}
```

#### 需求5: 统一WebSocket处理 【P1】
创建统一的WebSocket适配器

**功能要求**:
- 统一处理所有WebSocket消息
- 消息类型路由到对应事件
- 集中的错误处理和日志
- 清晰的消息流向

---

## 解决方案

### 技术方案概述

#### 方案1: 渐进式重构策略
采用渐进式重构，避免大规模改动导致的风险:
1. **阶段1 (P0)**: 文件清理和重组 (不改变代码逻辑)
2. **阶段2 (P0)**: 更新导入路径，统一命名
3. **阶段3 (P1)**: 拆分 app-core，创建适配器
4. **阶段4 (P1)**: 重构继承为组合
5. **阶段5 (P2)**: 优化细节，完善测试

#### 方案2: 保持向后兼容
重构过程中保持API接口不变:
- 外部使用的接口保持不变
- 事件系统接口保持不变
- 配置格式保持兼容
- 渐进式废弃旧接口

### 详细实施方案

#### 实施1: 目录重组脚本
使用脚本自动化目录重组过程:

```bash
#!/bin/bash
# reorganize.sh - PDF-Viewer目录重组脚本

# 1. 创建新目录结构
mkdir -p core features/pdf features/ui features/bookmark features/page-transfer
mkdir -p adapters qt-integration assets

# 2. 移动核心文件
mv app.js core/
mv app-core.js core/coordinator-old.js  # 暂时保留，待拆分

# 3. 移动功能模块
mv pdf/* features/pdf/
mv ui/* features/ui/
mv bookmark/* features/bookmark/

# 4. 移动适配器
# (新建文件，暂无移动)

# 5. 移动Python文件
mv *.py qt-integration/

# 6. 移动静态资源
mv index.html assets/
mv style.css assets/

# 7. 删除冗余文件
rm pdf-manager.js event-handlers.js eventbus.js
rm *.backup* *.temp.*

# 8. 更新路径引用
# (需要编写专门的脚本处理)
```

#### 实施2: app-core.js 拆分方案

**拆分后的模块职责**:

```javascript
// core/coordinator.js - 模块协调器 (约100行)
export class AppCoordinator {
  #container;
  #pdfManager;
  #uiManager;
  #bookmarkManager;

  constructor(container) {
    this.#container = container;
    this.#pdfManager = new PDFManager(container.getEventBus());
    this.#uiManager = new UIManager(container.getEventBus());
  }

  async initialize() {
    await this.#pdfManager.initialize();
    await this.#uiManager.initialize();
    // 初始化书签管理器
  }

  destroy() {
    this.#pdfManager.destroy();
    this.#uiManager.destroy();
  }

  getEventBus() { return this.#container.getEventBus(); }
}
```

```javascript
// core/state-manager.js - 状态管理器 (约80行)
export class StateManager {
  #currentFile = null;
  #currentPage = 1;
  #totalPages = 0;
  #zoomLevel = 1.0;
  #initialized = false;

  getState() {
    return {
      initialized: this.#initialized,
      currentFile: this.#currentFile,
      currentPage: this.#currentPage,
      totalPages: this.#totalPages,
      zoomLevel: this.#zoomLevel
    };
  }

  // getters and setters
}
```

```javascript
// core/lifecycle-manager.js - 生命周期管理器 (约60行)
export class LifecycleManager {
  #eventBus;
  #logger;

  constructor(eventBus, logger) {
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  setupGlobalErrorHandling() {
    window.addEventListener("unhandledrejection", (event) => {
      this.#logger.error("Unhandled Promise Rejection:", event.reason);
    });

    window.addEventListener("error", (event) => {
      this.#logger.error("Global Error:", event.error);
    });
  }

  onInitialized(messageQueue, handleMessage) {
    this.#logger.info('Processing queued WebSocket messages:', messageQueue.length);
    messageQueue.forEach(message => handleMessage(message));
    messageQueue.length = 0;
  }
}
```

```javascript
// adapters/websocket-adapter.js - WebSocket适配器 (约100行)
export class WebSocketAdapter {
  #eventBus;
  #logger;
  #initialized = false;
  #messageQueue = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('WebSocketAdapter');
  }

  setupMessageHandlers() {
    // 统一处理所有WebSocket消息类型
  }

  handleMessage(message) {
    if (!this.#initialized) {
      this.#messageQueue.push(message);
      return;
    }

    // 路由消息到对应事件
    this.#routeMessage(message);
  }

  #routeMessage(message) {
    switch (message.type) {
      case 'load_pdf_file':
        this.#handleLoadPdfFile(message.data);
        break;
      default:
        this.#logger.debug(`Unhandled message type: ${message.type}`);
    }
  }

  #handleLoadPdfFile(data) {
    // 解析并发射事件
    this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, ...);
  }
}
```

#### 实施3: 组合模式重构

**重构后的 PDFViewerApp**:
```javascript
// core/app.js
import { AppCoordinator } from './coordinator.js';
import { StateManager } from './state-manager.js';
import { LifecycleManager } from './lifecycle-manager.js';
import { EventHandlersCoordinator } from '../handlers/coordinator.js';
import { WebSocketAdapter } from '../adapters/websocket-adapter.js';
import { createPDFViewerContainer } from '../container/app-container.js';

export class PDFViewerApp {
  // 组合的组件
  #container;
  #coordinator;
  #stateManager;
  #lifecycleManager;
  #eventHandlers;
  #wsAdapter;
  #logger;

  constructor(options = {}) {
    // 1. 创建容器
    this.#container = options.container || createPDFViewerContainer(options);

    // 2. 获取基础依赖
    const { logger, eventBus } = this.#container.getDependencies();
    this.#logger = logger;

    // 3. 创建各个管理器 (组合)
    this.#coordinator = new AppCoordinator(this.#container);
    this.#stateManager = new StateManager();
    this.#lifecycleManager = new LifecycleManager(eventBus, logger);
    this.#wsAdapter = new WebSocketAdapter(eventBus);
    this.#eventHandlers = new EventHandlersCoordinator(this.#coordinator);

    this.#logger.info("PDFViewerApp created with composition architecture");
  }

  async initialize() {
    try {
      this.#logger.info("Initializing PDF Viewer App...");

      // 1. 设置生命周期
      this.#lifecycleManager.setupGlobalErrorHandling();

      // 2. 初始化容器
      if (!this.#container.isInitialized()) {
        await this.#container.initialize();
      }

      // 3. 连接WebSocket
      this.#container.connect();

      // 4. 设置WebSocket适配器
      this.#wsAdapter.setupMessageHandlers();

      // 5. 初始化协调器
      await this.#coordinator.initialize();

      // 6. 设置事件处理器
      this.#eventHandlers.setup();

      // 7. 更新状态
      this.#stateManager.setInitialized(true);

      this.#logger.info("PDF Viewer App initialized successfully");

    } catch (error) {
      this.#logger.error("Application initialization failed", error);
      throw error;
    }
  }

  destroy() {
    this.#coordinator.destroy();
    this.#container.dispose();
  }

  getState() {
    return this.#stateManager.getState();
  }

  getEventBus() {
    return this.#coordinator.getEventBus();
  }
}
```

**优势对比**:
- ✅ 职责清晰: 每个组件单一职责
- ✅ 易于测试: 可以独立mock各组件
- ✅ 易于复用: 各组件可独立使用
- ✅ 易于扩展: 添加新功能只需添加新组件
- ✅ 符合SOLID原则

---

## 约束条件

### 仅修改 PDF-Viewer 模块代码
仅修改 `src/frontend/pdf-viewer/` 目录下的代码，不可修改其他模块的代码

### 保持 API 向后兼容
必须保持以下接口不变:
- `window.pdfViewerApp` 全局对象及其方法
- 事件系统的事件名称和参数格式
- 配置项的格式和默认值
- 导出的主要类和函数

### 严格遵循代码规范
必须优先阅读和理解 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的代码规范，包括:
- FRONTEND-EVENT-BUS-001: 事件总线使用规范
- FRONTEND-EVENT-NAMING-001: 事件命名规范
- JAVASCRIPT-CLASS-STRUCTURE-001: JavaScript类结构规范
- JAVASCRIPT-FUNCTION-DESIGN-001: JavaScript函数设计规范
- PDF-VIEWER-STRUCTURE-001: PDF查看器模块结构规范

### 渐进式重构原则
- 每个阶段完成后必须保证功能正常
- 每次提交都是可运行的状态
- 提供详细的迁移指南和文档
- 保留必要的过渡期和兼容层

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
- 根目录文件数量 ≤ 3个 (main.js, README.md, package.json)
- 所有模块按功能分类到子目录
- 无备份文件、临时文件
- 目录结构清晰，符合规范

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

### 接口实现

#### 接口1: AppCoordinator
**类**: `AppCoordinator`
**描述**: 模块协调器，管理各功能模块的生命周期
**方法**:
- `constructor(container)`: 创建协调器
- `initialize()`: 初始化所有模块
- `destroy()`: 销毁所有模块
- `getEventBus()`: 获取事件总线
- `getState()`: 获取当前状态

#### 接口2: StateManager
**类**: `StateManager`
**描述**: 状态管理器，管理应用状态
**属性**:
- `currentFile`: 当前文件
- `currentPage`: 当前页码
- `totalPages`: 总页数
- `zoomLevel`: 缩放级别
- `initialized`: 初始化状态

**方法**:
- `getState()`: 获取状态快照
- `setCurrentFile(file)`: 设置当前文件
- `setCurrentPage(page)`: 设置当前页码
- `setInitialized(value)`: 设置初始化状态

#### 接口3: WebSocketAdapter
**类**: `WebSocketAdapter`
**描述**: WebSocket消息适配器
**方法**:
- `setupMessageHandlers()`: 设置消息处理器
- `handleMessage(message)`: 处理单个消息
- `onInitialized()`: 处理初始化完成

### 类实现

#### 类1: PDFViewerApp (重构后)
**类**: `PDFViewerApp`
**描述**: PDF查看器主应用类，使用组合模式
**组合的组件**:
- `coordinator`: AppCoordinator - 模块协调
- `stateManager`: StateManager - 状态管理
- `lifecycleManager`: LifecycleManager - 生命周期管理
- `wsAdapter`: WebSocketAdapter - WebSocket适配
- `eventHandlers`: EventHandlersCoordinator - 事件处理

**方法**:
- `initialize()`: 初始化应用
- `destroy()`: 销毁应用
- `getState()`: 获取状态
- `getEventBus()`: 获取事件总线

### 事件规范

#### 事件1: 初始化完成事件
**事件类型**: `pdf-viewer:state:initialized`
**描述**: 应用初始化完成时触发
**参数**: 无
**发射时机**: 所有模块初始化完成后

#### 事件2: 状态变更事件
**事件类型**: `pdf-viewer:state:changed`
**描述**: 应用状态变更时触发
**参数**:
- `oldState`: 旧状态
- `newState`: 新状态
- `changedFields`: 变更的字段列表

---

## 实施计划

### 总体时间表
**总工作量**: 约 20-24 小时
**建议时间**: 3-4 个工作日

### 阶段1: 文件清理和重组 【P0】 (4-6小时)
**目标**: 清理冗余文件，重组目录结构

**任务清单**:
- [x] 创建新的目录结构
- [ ] 删除备份文件 (ui-manager.js.backup, index.backup2.html)
- [ ] 删除临时文件 (index.temp.html)
- [ ] 删除桥接文件 (pdf-manager.js, event-handlers.js)
- [ ] 删除无价值封装 (eventbus.js)
- [ ] 移动Python文件到 qt-integration/
- [ ] 移动静态资源到 assets/
- [ ] 移动核心文件到 core/
- [ ] 移动功能模块到 features/
- [ ] 编写并运行目录重组脚本

**验收标准**:
- 根目录只保留 main.js
- 所有文件按功能分类到子目录
- 无备份和临时文件
- 目录结构符合新的规范

---

### 阶段2: 统一命名和路径更新 【P0】 (3-4小时)
**目标**: 统一文件命名，更新所有导入路径

**任务清单**:
- [ ] 移除 -refactored 后缀 (4个文件)
  - pdf-manager-refactored.js → manager.js
  - ui-manager-core-refactored.js → manager.js
  - event-handlers-refactored.js → coordinator.js
  - (保持其他文件名不变)
- [ ] 更新所有导入路径 (使用脚本批量替换)
  - 更新 import 语句路径
  - 更新 export 语句路径
- [ ] 更新测试文件中的导入路径
- [ ] 更新文档中的路径引用
- [ ] 运行 ESLint 检查语法错误

**验收标准**:
- 无 -refactored 后缀文件
- 所有导入路径正确
- ESLint 无错误
- 应用可以正常启动

---

### 阶段3: 拆分 app-core.js 【P1】 (6-8小时)
**目标**: 将 app-core.js 拆分为4个独立模块

**任务清单**:
- [ ] 创建 core/coordinator.js (模块协调)
  - 提取模块管理逻辑
  - 提取初始化和销毁逻辑
- [ ] 创建 core/state-manager.js (状态管理)
  - 提取状态字段
  - 提取 getState() 方法
  - 添加状态变更事件
- [ ] 创建 core/lifecycle-manager.js (生命周期)
  - 提取全局错误处理
  - 提取 onInitialized 逻辑
- [ ] 创建 adapters/websocket-adapter.js (WebSocket)
  - 提取消息处理逻辑
  - 统一消息路由
  - 集中错误处理
- [ ] 删除 websocket-handler.js (已被适配器替代)
- [ ] 更新 app-core.js 使用新模块 (暂时保留，用于兼容)
- [ ] 编写单元测试

**验收标准**:
- 4个新模块功能完整
- 单元测试通过
- app-core.js 正确使用新模块
- 应用功能不受影响

---

### 阶段4: 重构继承为组合 【P1】 (4-5小时)
**目标**: 重构 PDFViewerApp，移除继承，改用组合

**任务清单**:
- [ ] 重写 core/app.js (使用组合模式)
  - 组合 AppCoordinator
  - 组合 StateManager
  - 组合 LifecycleManager
  - 组合 WebSocketAdapter
  - 组合 EventHandlersCoordinator
- [ ] 重构 initialize() 方法
  - 按正确顺序初始化各组件
  - 处理组件间依赖
- [ ] 重构 destroy() 方法
  - 按正确顺序销毁各组件
- [ ] 保留 app-core.js 作为废弃层 (向后兼容)
- [ ] 更新 bootstrap/app-bootstrap.js
- [ ] 编写集成测试

**验收标准**:
- PDFViewerApp 不再继承
- 使用组合模式组织代码
- 所有功能正常工作
- 集成测试通过

---

### 阶段5: 完善和优化 【P2】 (3-4小时)
**目标**: 完善文档，优化细节，提升代码质量

**任务清单**:
- [ ] 更新 README.md 文档
  - 更新目录结构说明
  - 更新架构图
  - 更新API文档
- [ ] 更新 SPEC 规范文档
  - 更新模块结构规范
  - 添加组合模式说明
- [ ] 添加迁移指南
  - 导入路径迁移说明
  - API变更说明
  - 示例代码
- [ ] 代码质量优化
  - 添加注释和文档
  - 优化函数命名
  - 统一代码风格
- [ ] 性能优化
  - 移除不必要的日志
  - 优化事件监听
- [ ] 完善测试覆盖率
  - 补充缺失的测试
  - 目标覆盖率 > 80%

**验收标准**:
- 文档完整准确
- 代码质量达标
- 测试覆盖率 > 80%
- ESLint 无警告

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
- 保留 app-core.js 作为兼容层
- 编写充分的单元测试和集成测试
- 分阶段重构，每步验证功能

**应急预案**:
- 提供回退到继承模式的方案
- 保留兼容层一段时间后再删除

#### 风险3: WebSocket适配器统一可能影响性能 【低风险】
**描述**: 统一处理WebSocket消息可能增加一层抽象，影响性能

**缓解措施**:
- 适配器只做消息路由，不做复杂处理
- 性能关键路径保持直接调用

**应急预案**:
- 保留直接调用的优化路径

### 业务风险

#### 风险1: 功能回归 【中风险】
**描述**: 大规模重构可能导致部分功能失效

**缓解措施**:
- 保持API向后兼容
- 充分的测试覆盖
- 分阶段发布，渐进式验证

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
| 性能影响 | 低 | 低 | 高 | 低 |
| 功能回归 | 中 | 高 | 高 | 可控 |
| 周期延长 | 低 | 中 | 高 | 低 |

**总体评估**: 风险可控，缓解措施完备

---

## 附录

### 附录A: 目录对比表

| 当前路径 | 新路径 | 说明 |
|---------|--------|------|
| app.js | core/app.js | 主应用类 |
| app-core.js | core/coordinator.js (拆分) | 拆分为4个模块 |
| pdf-manager.js | (删除) | 桥接文件 |
| event-handlers.js | (删除) | 桥接文件 |
| eventbus.js | (删除) | 无价值封装 |
| pdf/pdf-manager-refactored.js | features/pdf/manager.js | 重命名 |
| ui/ui-manager-core-refactored.js | features/ui/manager.js | 重命名 |
| handlers/event-handlers-refactored.js | handlers/coordinator.js | 重命名 |
| websocket-handler.js | adapters/websocket-adapter.js | 重构 |
| launcher.py | qt-integration/launcher.py | 移动 |
| index.html | assets/index.html | 移动 |

### 附录B: 导入路径迁移示例

**迁移前**:
```javascript
import { PDFManager } from './pdf-manager.js';  // 桥接文件
import { UIManager } from './ui-manager.js';    // 桥接文件
import { EventHandlers } from './event-handlers.js';  // 桥接文件
```

**迁移后**:
```javascript
import { PDFManager } from './features/pdf/manager.js';
import { UIManager } from './features/ui/manager.js';
import { EventHandlersCoordinator } from './handlers/coordinator.js';
```

### 附录C: 关键文件行数对比

| 文件 | 重构前行数 | 重构后行数 | 减少比例 |
|------|-----------|-----------|---------|
| app-core.js | 340 | 拆分为4个文件 | - |
| - core/coordinator.js | - | ~100 | -71% |
| - core/state-manager.js | - | ~80 | - |
| - core/lifecycle-manager.js | - | ~60 | - |
| - adapters/websocket-adapter.js | - | ~100 | - |
| event-handlers-refactored.js | 150 | 120 | -20% |

### 附录D: 测试清单

#### 单元测试清单
- [ ] AppCoordinator 初始化测试
- [ ] AppCoordinator 销毁测试
- [ ] StateManager 状态管理测试
- [ ] LifecycleManager 错误处理测试
- [ ] WebSocketAdapter 消息路由测试
- [ ] PDFViewerApp 组合测试

#### 集成测试清单
- [ ] 应用启动流程测试
- [ ] PDF加载功能测试
- [ ] 页面导航功能测试
- [ ] 缩放功能测试
- [ ] 书签功能测试
- [ ] WebSocket通信测试

#### 端到端测试清单
- [ ] 纯浏览器环境测试
- [ ] PyQt集成环境测试
- [ ] 配置注入测试
- [ ] 外部UI组件集成测试

---

**文档版本**: v001
**最后更新**: 2025-10-02 04:02:17
**作者**: AI Assistant
**审核状态**: 待审核
