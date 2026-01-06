# PDF标注功能 - 内部模块化架构设计

**文档版本**: v1.0
**创建时间**: 2025-10-03 03:00:00
**目标**: 将标注功能设计为可扩展的插件化架构

## 架构概述

### 核心思想：容器 + 子插件

```
AnnotationFeature (容器/协调器)
  ├── ToolRegistry (工具注册表)
  ├── AnnotationManager (数据管理)
  ├── AnnotationSidebarUI (UI管理)
  └── Tools (子插件)
      ├── ScreenshotTool (截图插件)
      ├── TextHighlightTool (划词插件)
      └── CommentTool (批注插件)
```

### 设计原则

1. **开闭原则**: 对扩展开放（新增工具），对修改关闭（无需改AnnotationFeature）
2. **单一职责**: 每个工具只负责一种标注类型
3. **依赖倒置**: 依赖抽象接口（IAnnotationTool），不依赖具体实现
4. **组合优于继承**: 使用组合方式集成工具

## 接口设计

### 1. IAnnotationTool接口

```javascript
/**
 * 标注工具接口
 * 所有工具必须实现此接口
 * @interface
 */
export class IAnnotationTool {
  /**
   * 工具名称（唯一标识）
   * @returns {string} 'screenshot' | 'text-highlight' | 'comment'
   */
  get name() {
    throw new Error('Must implement name getter');
  }

  /**
   * 工具显示名称
   * @returns {string}
   */
  get displayName() {
    throw new Error('Must implement displayName getter');
  }

  /**
   * 工具图标
   * @returns {string}
   */
  get icon() {
    throw new Error('Must implement icon getter');
  }

  /**
   * 工具版本
   * @returns {string}
   */
  get version() {
    throw new Error('Must implement version getter');
  }

  /**
   * 工具依赖（可选）
   * @returns {string[]}
   */
  get dependencies() {
    return [];
  }

  /**
   * 初始化工具
   * @param {Object} context - 上下文
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async initialize(context) {
    throw new Error('Must implement initialize()');
  }

  /**
   * 激活工具
   * @returns {void}
   */
  activate() {
    throw new Error('Must implement activate()');
  }

  /**
   * 停用工具
   * @returns {void}
   */
  deactivate() {
    throw new Error('Must implement deactivate()');
  }

  /**
   * 检查是否激活
   * @returns {boolean}
   */
  isActive() {
    throw new Error('Must implement isActive()');
  }

  /**
   * 创建工具的UI组件（侧边栏按钮）
   * @returns {HTMLElement}
   */
  createToolButton() {
    throw new Error('Must implement createToolButton()');
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation) {
    throw new Error('Must implement createAnnotationCard()');
  }

  /**
   * 销毁工具，清理资源
   * @returns {void}
   */
  destroy() {
    throw new Error('Must implement destroy()');
  }
}
```

### 2. ToolRegistry（工具注册表）

```javascript
/**
 * 工具注册表
 * 管理所有标注工具的注册、查询、生命周期
 */
export class ToolRegistry {
  #tools = new Map();  // Map<toolName, IAnnotationTool>
  #logger;

  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * 注册工具
   * @param {IAnnotationTool} tool - 工具实例
   */
  register(tool) {
    // 验证接口
    this.#validateTool(tool);

    const name = tool.name;

    if (this.#tools.has(name)) {
      throw new Error(`Tool "${name}" is already registered`);
    }

    this.#tools.set(name, tool);
    this.#logger.info(`Tool registered: ${name} v${tool.version}`);
  }

  /**
   * 获取工具
   * @param {string} name - 工具名称
   * @returns {IAnnotationTool|null}
   */
  get(name) {
    return this.#tools.get(name) || null;
  }

  /**
   * 获取所有工具
   * @returns {IAnnotationTool[]}
   */
  getAll() {
    return Array.from(this.#tools.values());
  }

  /**
   * 检查工具是否存在
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.#tools.has(name);
  }

  /**
   * 初始化所有工具
   * @param {Object} context
   * @returns {Promise<void>}
   */
  async initializeAll(context) {
    const tools = this.getAll();

    for (const tool of tools) {
      try {
        await tool.initialize(context);
        this.#logger.info(`Tool initialized: ${tool.name}`);
      } catch (error) {
        this.#logger.error(`Failed to initialize tool ${tool.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * 停用所有工具
   */
  deactivateAll() {
    this.getAll().forEach(tool => {
      if (tool.isActive()) {
        tool.deactivate();
      }
    });
  }

  /**
   * 销毁所有工具
   */
  destroyAll() {
    this.getAll().forEach(tool => {
      try {
        tool.destroy();
      } catch (error) {
        this.#logger.error(`Failed to destroy tool ${tool.name}:`, error);
      }
    });
    this.#tools.clear();
  }

  /**
   * 验证工具接口
   * @private
   */
  #validateTool(tool) {
    const requiredMethods = [
      'name', 'displayName', 'icon', 'version',
      'initialize', 'activate', 'deactivate', 'isActive',
      'createToolButton', 'createAnnotationCard', 'destroy'
    ];

    for (const method of requiredMethods) {
      if (!(method in tool)) {
        throw new Error(`Tool must implement "${method}"`);
      }
    }
  }
}
```

### 3. AnnotationFeature（容器/协调器）

```javascript
/**
 * 标注功能容器
 * 职责：协调工具、管理数据、提供UI基础设施
 */
export class AnnotationFeature {
  #logger;
  #eventBus;
  #container;

  #toolRegistry;
  #annotationManager;
  #sidebarUI;

  get name() { return 'annotation'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['app-core', 'ui-manager']; }

  async install(context) {
    const { globalEventBus, logger, container } = context;

    this.#logger = logger || getLogger('AnnotationFeature');
    this.#eventBus = globalEventBus;
    this.#container = container;

    // 1. 创建工具注册表
    this.#toolRegistry = new ToolRegistry(this.#logger);

    // 2. 注册工具（可配置）
    this.#registerTools();

    // 3. 创建AnnotationManager
    this.#annotationManager = new AnnotationManager(
      this.#eventBus,
      this.#toolRegistry  // 传入注册表
    );

    // 4. 创建AnnotationSidebarUI
    this.#sidebarUI = new AnnotationSidebarUI(
      this.#eventBus,
      this.#toolRegistry  // 传入注册表
    );

    // 5. 初始化所有工具
    const toolContext = {
      eventBus: this.#eventBus,
      logger: this.#logger,
      pdfViewerManager: this.#container.resolve('pdfViewerManager'),
      container: this.#container
    };
    await this.#toolRegistry.initializeAll(toolContext);

    // 6. 初始化UI
    this.#sidebarUI.initialize();

    // 7. 创建标注按钮
    this.#createAnnotationButton();

    // 8. 设置工具激活逻辑
    this.#setupToolActivation();

    this.#logger.info('AnnotationFeature installed successfully');
  }

  /**
   * 注册工具
   * ✨扩展点：可通过配置动态注册
   */
  #registerTools() {
    // 可以从配置文件读取要启用的工具
    const enabledTools = this.#getEnabledTools();

    enabledTools.forEach(ToolClass => {
      const tool = new ToolClass();
      this.#toolRegistry.register(tool);
    });
  }

  /**
   * 获取启用的工具列表
   * ✨可配置化
   */
  #getEnabledTools() {
    // 方式1：硬编码（当前）
    return [
      ScreenshotTool,
      TextHighlightTool,
      CommentTool
    ];

    // 方式2：从配置读取（未来）
    // const config = this.#container.resolve('config');
    // return config.annotation.enabledTools.map(name => {
    //   return TOOL_MAP[name];
    // });
  }

  /**
   * 设置工具激活逻辑
   */
  #setupToolActivation() {
    this.#eventBus.on(
      'annotation-tool:activate:requested',
      ({ tool: toolName }) => {
        // 停用所有工具
        this.#toolRegistry.deactivateAll();

        // 激活指定工具
        const tool = this.#toolRegistry.get(toolName);
        if (tool) {
          tool.activate();
        } else {
          this.#logger.warn(`Tool not found: ${toolName}`);
        }
      },
      { subscriberId: 'AnnotationFeature' }
    );

    // ESC停用所有工具
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.#toolRegistry.deactivateAll();
      }
    });
  }

  async uninstall() {
    this.#sidebarUI?.destroy();
    this.#toolRegistry?.destroyAll();
    this.#logger.info('AnnotationFeature uninstalled');
  }
}
```

### 4. AnnotationSidebarUI（使用注册表）

```javascript
/**
 * 标注侧边栏UI
 * 使用工具注册表动态生成UI
 */
export class AnnotationSidebarUI {
  #eventBus;
  #toolRegistry;
  #sidebar;
  #toolbar;
  #annotationList;

  constructor(eventBus, toolRegistry) {
    this.#eventBus = eventBus;
    this.#toolRegistry = toolRegistry;
  }

  initialize() {
    this.#createSidebar();
    this.#setupEventListeners();
  }

  #createSidebar() {
    this.#sidebar = this.#createSidebarContainer();
    this.#toolbar = this.#createToolbar();
    this.#annotationList = this.#createAnnotationList();

    this.#sidebar.appendChild(this.#toolbar);
    this.#sidebar.appendChild(this.#annotationList);
    document.querySelector('main').appendChild(this.#sidebar);
  }

  /**
   * ✨动态创建工具栏（从注册表）
   */
  #createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'annotation-toolbar';
    toolbar.style.cssText = 'display: flex; gap: 8px; padding: 8px;';

    // 从注册表获取所有工具
    const tools = this.#toolRegistry.getAll();

    // 动态生成工具按钮
    tools.forEach(tool => {
      const button = tool.createToolButton();
      button.dataset.tool = tool.name;

      // 统一的点击事件
      button.addEventListener('click', () => {
        this.#eventBus.emit('annotation-tool:activate:requested', {
          tool: tool.name
        });
      });

      toolbar.appendChild(button);
    });

    return toolbar;
  }

  /**
   * ✨动态创建标注卡片（委托给工具）
   */
  addAnnotationCard(annotation) {
    const tool = this.#toolRegistry.get(annotation.type);

    if (!tool) {
      console.error(`No tool registered for type: ${annotation.type}`);
      return;
    }

    // 委托给对应的工具创建卡片
    const card = tool.createAnnotationCard(annotation);
    this.#annotationList.appendChild(card);
  }

  #setupEventListeners() {
    this.#eventBus.on(
      'annotation:create:success',
      ({ annotation }) => this.addAnnotationCard(annotation),
      { subscriberId: 'AnnotationSidebarUI' }
    );

    // TODO: 其他事件监听
  }

  destroy() {
    this.#sidebar?.remove();
  }
}
```

## 工具实现示例

### ScreenshotTool（截图工具插件）

```javascript
/**
 * 截图工具插件
 * @implements {IAnnotationTool}
 */
export class ScreenshotTool extends IAnnotationTool {
  // 工具元数据
  get name() { return 'screenshot'; }
  get displayName() { return '截图'; }
  get icon() { return '📷'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['qwebchannel']; }

  // 私有状态
  #eventBus;
  #logger;
  #pdfViewerManager;
  #qwebChannelBridge;
  #capturer;
  #isActive = false;

  // 生命周期方法
  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger;
    this.#pdfViewerManager = context.pdfViewerManager;

    // 初始化依赖组件
    this.#qwebChannelBridge = context.container.resolve('qwebChannelBridge');
    this.#capturer = new ScreenshotCapturer(this.#pdfViewerManager);

    this.#logger.info('[ScreenshotTool] Initialized');
  }

  activate() {
    if (this.#isActive) return;

    this.#isActive = true;
    document.body.style.cursor = 'crosshair';

    // TODO: 创建选择遮罩层

    this.#eventBus.emit('annotation-tool:activate:success', {
      tool: this.name
    });
  }

  deactivate() {
    if (!this.#isActive) return;

    this.#isActive = false;
    document.body.style.cursor = 'default';

    // TODO: 清理遮罩层

    this.#eventBus.emit('annotation-tool:deactivate:success', {
      tool: this.name
    });
  }

  isActive() {
    return this.#isActive;
  }

  /**
   * 创建工具按钮
   */
  createToolButton() {
    const button = document.createElement('button');
    button.className = 'annotation-tool-btn';
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;
    button.style.cssText = [
      'padding: 8px 12px',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'background: white',
      'cursor: pointer',
      'font-size: 13px'
    ].join(';');

    return button;
  }

  /**
   * 创建标注卡片
   */
  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card screenshot-card';
    card.dataset.annotationId = annotation.id;

    const imageUrl = this.#getImageUrl(annotation.data.imagePath);

    card.innerHTML = `
      <div class="annotation-card-header">
        <span class="annotation-icon">${this.icon}</span>
        <span class="annotation-type">${this.displayName}标注</span>
      </div>
      <div class="annotation-card-body">
        <img src="${imageUrl}" alt="截图" style="max-width: 100%; border-radius: 4px;">
        <p>${this.#escapeHtml(annotation.data.description)}</p>
        <div class="annotation-meta">
          <span>页码: P.${annotation.pageNumber}</span>
          <span>时间: ${this.#formatDate(annotation.createdAt)}</span>
        </div>
      </div>
      <div class="annotation-card-footer">
        <button class="jump-btn">→ 跳转</button>
        <button class="comment-btn">💬 评论</button>
      </div>
    `;

    return card;
  }

  destroy() {
    this.deactivate();
    this.#capturer = null;
    this.#logger.info('[ScreenshotTool] Destroyed');
  }

  // 辅助方法
  #getImageUrl(imagePath) {
    const port = window.APP_CONFIG?.fileServerPort || 8080;
    return `http://localhost:${port}${imagePath}`;
  }

  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  #formatDate(isoString) {
    return new Date(isoString).toLocaleString('zh-CN');
  }
}
```

### TextHighlightTool（划词工具插件）

```javascript
/**
 * 划词高亮工具插件
 * @implements {IAnnotationTool}
 */
export class TextHighlightTool extends IAnnotationTool {
  get name() { return 'text-highlight'; }
  get displayName() { return '选字'; }
  get icon() { return '✏️'; }
  get version() { return '1.0.0'; }

  #eventBus;
  #logger;
  #pdfViewerManager;
  #isActive = false;

  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger;
    this.#pdfViewerManager = context.pdfViewerManager;
  }

  activate() {
    this.#isActive = true;
    // TODO: 激活文本选择监听
    this.#logger.info('[TextHighlightTool] Activated');
  }

  deactivate() {
    this.#isActive = false;
    // TODO: 清理监听
  }

  isActive() {
    return this.#isActive;
  }

  createToolButton() {
    const button = document.createElement('button');
    button.className = 'annotation-tool-btn';
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.style.cssText = 'padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;';
    return button;
  }

  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card highlight-card';

    card.innerHTML = `
      <div class="annotation-card-header">
        <span class="annotation-icon">${this.icon}</span>
        <span class="annotation-type">${this.displayName}标注</span>
      </div>
      <div class="annotation-card-body">
        <div class="highlight-preview" style="background-color: ${annotation.data.highlightColor}; padding: 8px; border-radius: 4px;">
          "${annotation.data.selectedText}"
        </div>
        <p>${annotation.data.note}</p>
        <div class="annotation-meta">
          <span>页码: P.${annotation.pageNumber}</span>
        </div>
      </div>
    `;

    return card;
  }

  destroy() {
    this.deactivate();
  }
}
```

### CommentTool（批注工具插件）

```javascript
/**
 * 批注工具插件
 * @implements {IAnnotationTool}
 */
export class CommentTool extends IAnnotationTool {
  get name() { return 'comment'; }
  get displayName() { return '批注'; }
  get icon() { return '📝'; }
  get version() { return '1.0.0'; }

  #eventBus;
  #logger;
  #pdfViewerManager;
  #isActive = false;

  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger;
    this.#pdfViewerManager = context.pdfViewerManager;
  }

  activate() {
    this.#isActive = true;
    document.body.style.cursor = 'text';
    // TODO: 监听页面点击
  }

  deactivate() {
    this.#isActive = false;
    document.body.style.cursor = 'default';
  }

  isActive() {
    return this.#isActive;
  }

  createToolButton() {
    const button = document.createElement('button');
    button.className = 'annotation-tool-btn';
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.style.cssText = 'padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;';
    return button;
  }

  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card comment-card';

    card.innerHTML = `
      <div class="annotation-card-header">
        <span class="annotation-icon">${this.icon}</span>
        <span class="annotation-type">${this.displayName}标注</span>
      </div>
      <div class="annotation-card-body">
        <p>${annotation.data.content}</p>
        <div class="annotation-meta">
          <span>页码: P.${annotation.pageNumber}</span>
          <span>位置: (${annotation.data.position.x}, ${annotation.data.position.y})</span>
        </div>
      </div>
    `;

    return card;
  }

  destroy() {
    this.deactivate();
  }
}
```

## 目录结构

```
features/annotation/
├── index.js                          # AnnotationFeature（容器）
├── interfaces/
│   └── IAnnotationTool.js           # 工具接口定义
├── core/
│   ├── tool-registry.js             # 工具注册表
│   ├── annotation-manager.js        # 数据管理
│   └── annotation-sidebar-ui.js     # UI管理
├── tools/                            # ✨工具插件目录
│   ├── screenshot/
│   │   ├── index.js                 # ScreenshotTool
│   │   ├── screenshot-capturer.js
│   │   └── qwebchannel-bridge.js
│   ├── text-highlight/
│   │   ├── index.js                 # TextHighlightTool
│   │   └── highlight-renderer.js
│   └── comment/
│       ├── index.js                 # CommentTool
│       └── comment-renderer.js
├── models/
│   ├── annotation.js
│   └── comment.js
├── __tests__/
│   ├── tool-registry.test.js
│   ├── screenshot-tool.test.js
│   ├── text-highlight-tool.test.js
│   └── comment-tool.test.js
└── README.md
```

## 并行开发策略（模块化版）

### 阶段0: 基础设施（2小时）

**分支**: `feature/annotation-base`

**负责人**: 架构师

**任务**:
1. ✅ 定义IAnnotationTool接口
2. ✅ 实现ToolRegistry
3. ✅ 实现AnnotationFeature骨架
4. ✅ 实现AnnotationSidebarUI骨架
5. ✅ 定义数据模型
6. ✅ 定义事件常量

### 阶段1: 三个工具并行开发（完全独立）

```
feature/annotation-base
  ↓
  ├─→ feature/annotation-tool-screenshot      (开发者A)
  ├─→ feature/annotation-tool-text-highlight  (开发者B)
  └─→ feature/annotation-tool-comment          (开发者C)
```

#### 开发者A: 截图工具

**只修改文件**:
```
✅ 新增 tools/screenshot/index.js (ScreenshotTool)
✅ 新增 tools/screenshot/screenshot-capturer.js
✅ 新增 tools/screenshot/qwebchannel-bridge.js
✅ 修改 features/annotation/index.js (仅#registerTools方法，导入ScreenshotTool)
```

**完全不会冲突**！

#### 开发者B: 划词工具

**只修改文件**:
```
✅ 新增 tools/text-highlight/index.js (TextHighlightTool)
✅ 新增 tools/text-highlight/highlight-renderer.js
✅ 修改 features/annotation/index.js (仅#registerTools方法，导入TextHighlightTool)
```

#### 开发者C: 批注工具

**只修改文件**:
```
✅ 新增 tools/comment/index.js (CommentTool)
✅ 新增 tools/comment/comment-renderer.js
✅ 修改 features/annotation/index.js (仅#registerTools方法，导入CommentTool)
```

### 合并时的冲突（仅1处）

**唯一冲突**: `index.js` 的 `#registerTools()` 方法

```javascript
#registerTools() {
  return [
    ScreenshotTool,        // ← 开发者A添加
    TextHighlightTool,     // ← 开发者B添加
    CommentTool            // ← 开发者C添加
  ];
}
```

**解决**: 保留三行（< 30秒）

## 优势对比

### 原方案 vs 模块化方案

| 维度 | 原方案 | 模块化方案 |
|------|--------|-----------|
| **冲突点** | 3处 | 1处 |
| **冲突复杂度** | 中 | 低（仅import语句） |
| **并行度** | 受限 | 完全并行 |
| **扩展性** | 需修改核心代码 | 只需新增插件 |
| **测试隔离** | 中 | 完全隔离 |
| **可维护性** | 中 | 高 |
| **可配置性** | 无 | 可配置启用/禁用工具 |

## 未来扩展场景

### 场景1: 新增"箭头标注"工具

```javascript
// 1. 创建新工具（完全独立）
export class ArrowTool extends IAnnotationTool {
  get name() { return 'arrow'; }
  get displayName() { return '箭头'; }
  get icon() { return '➡️'; }
  // ... 实现接口
}

// 2. 注册到系统（只改一行）
#registerTools() {
  return [
    ScreenshotTool,
    TextHighlightTool,
    CommentTool,
    ArrowTool  // ✨新增
  ];
}
```

### 场景2: 通过配置启用工具

```javascript
// config.json
{
  "annotation": {
    "enabledTools": ["screenshot", "text-highlight"]  // 只启用两个
  }
}

// 动态加载
#getEnabledTools() {
  const config = this.#container.resolve('config');
  const TOOL_MAP = {
    'screenshot': ScreenshotTool,
    'text-highlight': TextHighlightTool,
    'comment': CommentTool
  };

  return config.annotation.enabledTools.map(name => TOOL_MAP[name]);
}
```

### 场景3: 懒加载工具

```javascript
// 按需加载，减少初始包大小
async #registerTools() {
  const enabledTools = ['screenshot', 'text-highlight'];

  for (const toolName of enabledTools) {
    const ToolClass = await import(`./tools/${toolName}/index.js`);
    this.#toolRegistry.register(new ToolClass.default());
  }
}
```

## 总结

### 核心价值

1. ✅ **完全解耦**: 三个工具互不依赖，100%并行开发
2. ✅ **零冲突**: 新增文件为主，共享文件仅1处import冲突
3. ✅ **易扩展**: 新增工具无需改核心代码
4. ✅ **可配置**: 支持动态启用/禁用工具
5. ✅ **易测试**: 每个工具独立测试，mock容易

### 开发流程

```
Day 1: 完成feature/annotation-base（接口+注册表）
Day 2-6: 三人完全并行开发各自工具
Day 7: 依次合并，解决1个import冲突（< 1分钟）
```

**是否采用模块化方案？**
