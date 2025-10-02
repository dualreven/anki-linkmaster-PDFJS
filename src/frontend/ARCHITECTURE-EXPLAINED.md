# 功能域插件架构 - 深度解析

**从零开始理解整套架构的工作原理**

---

## 目录

1. [核心概念](#核心概念)
2. [基础组件详解](#基础组件详解)
3. [运行流程演示](#运行流程演示)
4. [设计思想解析](#设计思想解析)
5. [实战案例](#实战案例)

---

## 核心概念

### 什么是插件模式？

**传统方式（紧耦合）：**
```javascript
// ❌ 所有功能都写在一起
class PDFViewerApp {
  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.uiManager = new UIManager();
    this.pdfLoader = new PDFLoader();
    // 100个功能 = 100个new
  }

  init() {
    // 手动管理初始化顺序
    this.pdfLoader.init();
    this.uiManager.init();
    this.bookmarkManager.init();
    // 顺序错了就报错
  }
}
```

**问题**：
- 💥 功能耦合，改一个影响全部
- 💥 依赖顺序复杂，容易出错
- 💥 无法动态加载/卸载功能
- 💥 多人协作困难

---

**插件模式（解耦）：**
```javascript
// ✅ 每个功能是独立的插件
class BookmarkFeature {
  get name() { return 'bookmark'; }
  get dependencies() { return ['pdf-loader']; }

  async install(context) {
    // 插件自己管理初始化
  }
}

// ✅ 注册中心管理所有插件
const registry = new FeatureRegistry();
registry.register(new BookmarkFeature());
registry.register(new PDFLoaderFeature());
registry.installAll(); // 自动计算依赖顺序
```

**优势**：
- ✅ 功能独立，互不干扰
- ✅ 自动解析依赖顺序
- ✅ 可动态加载/卸载
- ✅ 多人并行开发

---

## 基础组件详解

### 1. FeatureRegistry（插件注册中心）

**职责**：管理所有Feature的生命周期

**核心方法**：
```javascript
class FeatureRegistry {
  #features = new Map();  // 存储所有已注册的Feature

  // 注册一个Feature
  register(feature) {
    this.#features.set(feature.name, feature);
  }

  // 安装所有Feature（按依赖顺序）
  async installAll() {
    const sorted = this.#sortByDependencies();  // 拓扑排序
    for (const feature of sorted) {
      await feature.install(context);  // 依次安装
    }
  }

  // 获取已安装的Feature
  getFeature(name) {
    return this.#features.get(name);
  }
}
```

**工作原理**：

```
┌─────────────────────────────────────┐
│  FeatureRegistry                    │
├─────────────────────────────────────┤
│                                     │
│  features: Map {                    │
│    'app-core' => AppCoreFeature     │
│    'pdf-manager' => PDFManagerFeat. │
│    'bookmark' => BookmarkFeature    │
│  }                                  │
│                                     │
│  installAll() {                     │
│    1. 读取每个Feature的依赖        │
│    2. 拓扑排序计算安装顺序         │
│    3. 按顺序依次调用install()      │
│  }                                  │
└─────────────────────────────────────┘
```

**依赖解析示例**：

```javascript
// Feature声明的依赖关系
AppCore: []                      // 无依赖
PDFManager: ['app-core']         // 依赖app-core
Bookmark: ['pdf-manager']        // 依赖pdf-manager

// Registry自动计算安装顺序
installOrder = [
  AppCore,      // 第1个安装（无依赖）
  PDFManager,   // 第2个安装（app-core已安装）
  Bookmark      // 第3个安装（pdf-manager已安装）
]
```

---

### 2. DependencyContainer（依赖注入容器）

**职责**：管理共享的服务和对象

**核心方法**：
```javascript
class DependencyContainer {
  #services = new Map();

  // 注册一个服务
  register(name, instance) {
    this.#services.set(name, instance);
  }

  // 获取一个服务
  get(name) {
    return this.#services.get(name);
  }

  // 批量获取依赖
  getDependencies() {
    return {
      eventBus: this.get('eventBus'),
      logger: this.get('logger'),
      wsClient: this.get('wsClient')
    };
  }
}
```

**使用场景**：

```javascript
// 在bootstrap中注册全局服务
const container = new DependencyContainer();
container.register('eventBus', globalEventBus);
container.register('logger', logger);
container.register('wsClient', wsClient);

// Feature中使用
async install(context) {
  const { container } = context;
  const wsClient = container.get('wsClient');  // 获取共享的wsClient
}
```

**为什么需要容器？**

```javascript
// ❌ 没有容器：每个Feature都要手动传参
class BookmarkFeature {
  async install(eventBus, logger, wsClient, config, ...) {
    // 参数太多，容易出错
  }
}

// ✅ 有容器：统一管理，按需获取
class BookmarkFeature {
  async install(context) {
    const { container } = context;
    const wsClient = container.get('wsClient');  // 需要什么取什么
  }
}
```

---

### 3. EventBus（事件总线）

**职责**：Feature之间的通信桥梁

**核心方法**：
```javascript
class EventBus {
  #listeners = new Map();

  // 订阅事件
  subscribe(eventName, handler) {
    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, []);
    }
    this.#listeners.get(eventName).push(handler);

    // 返回取消订阅函数
    return () => this.unsubscribe(eventName, handler);
  }

  // 发布事件
  emit(eventName, data, metadata) {
    const handlers = this.#listeners.get(eventName) || [];
    handlers.forEach(handler => handler(data, metadata));
  }
}
```

**Feature间通信示例**：

```javascript
// ========== Feature A：发布者 ==========
class PDFLoaderFeature {
  async install(context) {
    const { globalEventBus } = context;

    // 加载PDF后发布事件
    async loadPDF(url) {
      const pdfDoc = await loadDocument(url);

      // 发布事件：PDF已加载
      globalEventBus.emit('pdf:loaded', {
        document: pdfDoc,
        pageCount: pdfDoc.numPages
      });
    }
  }
}

// ========== Feature B：订阅者 ==========
class BookmarkFeature {
  async install(context) {
    const { globalEventBus } = context;

    // 订阅事件：等待PDF加载
    globalEventBus.subscribe('pdf:loaded', (data) => {
      const { document, pageCount } = data;
      this.loadBookmarks(document);  // 加载书签
    });
  }
}

// ========== Feature C：也可以订阅 ==========
class PageNavigatorFeature {
  async install(context) {
    const { globalEventBus } = context;

    // 同一个事件，多个订阅者
    globalEventBus.subscribe('pdf:loaded', (data) => {
      this.setupNavigation(data.pageCount);
    });
  }
}
```

**EventBus的优势**：

```
没有EventBus（直接调用）:
┌──────────┐  直接调用   ┌──────────┐
│ Feature A│─────────────>│ Feature B│
└──────────┘              └──────────┘
           \  直接调用   /
            └───────────>│ Feature C│
                         └──────────┘
问题：A必须知道B和C的存在，紧耦合

有EventBus（事件驱动）:
┌──────────┐              ┌──────────┐
│ Feature A│──┐        ┌─>│ Feature B│
└──────────┘  │        │  └──────────┘
              ↓        │
          ┌────────┐   │
          │EventBus│───┤
          └────────┘   │
                       │  ┌──────────┐
                       └─>│ Feature C│
                          └──────────┘
优势：A只需发布事件，不用知道谁在监听
```

---

### 4. FeatureContext（功能上下文）

**职责**：传递给每个Feature的环境信息

**结构**：
```javascript
const context = {
  globalEventBus,  // 全局事件总线
  logger,          // 日志记录器
  container,       // 依赖容器
  config,          // 配置对象（可选）
  registry         // Registry自身（可选）
};
```

**使用示例**：
```javascript
class MyFeature {
  async install(context) {
    // 解构获取需要的对象
    const { globalEventBus, logger, container } = context;

    logger.info('Installing MyFeature...');

    // 从容器获取共享服务
    const wsClient = container.get('wsClient');

    // 订阅事件
    globalEventBus.subscribe('some-event', (data) => {
      logger.debug('Event received:', data);
    });
  }
}
```

---

## 运行流程演示

### 场景：用户打开PDF并跳转到书签

**涉及的Features**：
- `AppCoreFeature` - 提供WebSocket连接
- `PDFManagerFeature` - 管理PDF文档
- `BookmarkFeature` - 管理书签
- `UIManagerFeature` - 管理UI

**完整时序图**：

```
用户操作                Bootstrap              AppCore            PDFManager         Bookmark           UIManager
   │                       │                      │                    │                  │                  │
   │  打开应用             │                      │                    │                  │                  │
   ├──────────────────────>│                      │                    │                  │                  │
   │                       │                      │                    │                  │                  │
   │                       │ 1. 创建Registry      │                    │                  │                  │
   │                       │ 2. 注册Features      │                    │                  │                  │
   │                       │ 3. installAll()      │                    │                  │                  │
   │                       ├─────────────────────>│                    │                  │                  │
   │                       │                      │ install()          │                  │                  │
   │                       │                      │ (建立WS连接)       │                  │                  │
   │                       │                      │                    │                  │                  │
   │                       │                      ├───────────────────>│                  │                  │
   │                       │                      │                    │ install()        │                  │
   │                       │                      │                    │ (初始化PDF管理器)│                  │
   │                       │                      │                    │                  │                  │
   │                       │                      │                    ├─────────────────>│                  │
   │                       │                      │                    │                  │ install()        │
   │                       │                      │                    │                  │ (订阅pdf:loaded) │
   │                       │                      │                    │                  │                  │
   │                       │                      │                    │                  ├─────────────────>│
   │                       │                      │                    │                  │                  │ install()
   │                       │                      │                    │                  │                  │ (初始化UI)
   │                       │<─────────────────────┴────────────────────┴──────────────────┴──────────────────┘
   │                       │                      │                    │                  │                  │
   │  选择PDF文件          │                      │                    │                  │                  │
   ├──────────────────────────────────────────────┴───────────────────>│                  │                  │
   │                       │                      │                    │ loadPDF()        │                  │
   │                       │                      │                    │                  │                  │
   │                       │                      │   EventBus: 'pdf:loaded'              │                  │
   │                       │                      │<───────────────────┴──────────────────┼──────────────────│
   │                       │                      │                    │                  │                  │
   │                       │                      │                    │                  │<─────────────────┤
   │                       │                      │                    │                  │ 收到事件         │
   │                       │                      │                    │                  │ loadBookmarks()  │
   │                       │                      │                    │                  │                  │
   │  点击书签             │                      │                    │                  │                  │
   ├──────────────────────────────────────────────┴────────────────────┴──────────────────>│                  │
   │                       │                      │                    │                  │ jumpToPage()     │
   │                       │                      │   EventBus: 'page:jump'               │                  │
   │                       │                      │<───────────────────┴──────────────────┴──────────────────│
   │                       │                      │                    │                  │                  │
   │                       │                      │                    │                  │                  │<─────────
   │                       │                      │                    │                  │                  │ 收到事件
   │  页面跳转             │<─────────────────────┴────────────────────┴──────────────────┴──────────────────┤ render()
   │<──────────────────────┤                      │                    │                  │                  │
```

**代码视角的完整流程**：

#### 步骤1：Bootstrap启动

```javascript
// bootstrap/app-bootstrap-feature.js
async function bootstrapPDFViewerAppFeature() {
  const logger = getLogger('Bootstrap');

  // 1. 创建容器
  const container = new SimpleDependencyContainer('pdf-viewer');
  container.register('eventBus', globalEventBus);
  container.register('logger', logger);

  // 2. 创建Registry
  const registry = new FeatureRegistry({
    container,
    globalEventBus,
    logger
  });

  // 3. 注册所有Features（顺序无关，Registry会自动排序）
  registry.register(new AppCoreFeature());
  registry.register(new PDFManagerFeature());
  registry.register(new BookmarkFeature());
  registry.register(new UIManagerFeature());

  // 4. 安装所有Features
  await registry.installAll();

  logger.info('All features installed!');
}
```

#### 步骤2：Registry自动安装

```javascript
// common/micro-service/feature-registry.js
async installAll() {
  // 1. 分析依赖关系
  const dependencies = {
    'app-core': [],
    'pdf-manager': ['app-core'],
    'bookmark': ['pdf-manager'],
    'ui-manager': ['pdf-manager']
  };

  // 2. 拓扑排序（计算安装顺序）
  const sorted = topologicalSort(dependencies);
  // 结果: ['app-core', 'pdf-manager', 'bookmark', 'ui-manager']

  // 3. 按顺序安装
  for (const featureName of sorted) {
    const feature = this.#features.get(featureName);

    const context = {
      globalEventBus: this.#globalEventBus,
      logger: this.#logger,
      container: this.#container,
      registry: this
    };

    await feature.install(context);
    this.#logger.info(`✓ ${featureName} installed`);
  }
}
```

#### 步骤3：各Feature的install()

```javascript
// ========== AppCoreFeature ==========
class AppCoreFeature {
  #wsClient = null;

  async install(context) {
    const { container, logger } = context;

    // 创建WebSocket客户端
    this.#wsClient = new WSClient('ws://localhost:8765');
    await this.#wsClient.connect();

    // 注册到容器（供其他Feature使用）
    container.register('wsClient', this.#wsClient);

    logger.info('AppCore: WebSocket connected');
  }
}

// ========== PDFManagerFeature ==========
class PDFManagerFeature {
  #pdfManager = null;

  get dependencies() {
    return ['app-core'];  // 依赖app-core
  }

  async install(context) {
    const { globalEventBus, container, logger } = context;

    // 从容器获取wsClient（app-core已注册）
    const wsClient = container.get('wsClient');

    // 创建PDF管理器
    this.#pdfManager = new PDFManager(globalEventBus, wsClient);

    logger.info('PDFManager: Initialized');
  }

  async loadPDF(url) {
    const doc = await this.#pdfManager.load(url);

    // 发布事件：PDF已加载
    globalEventBus.emit('pdf:loaded', {
      document: doc,
      pageCount: doc.numPages
    });
  }
}

// ========== BookmarkFeature ==========
class BookmarkFeature {
  #bookmarks = [];
  #unsubscribe = null;

  get dependencies() {
    return ['pdf-manager'];
  }

  async install(context) {
    const { globalEventBus, logger } = context;

    // 订阅pdf:loaded事件
    this.#unsubscribe = globalEventBus.subscribe('pdf:loaded', (data) => {
      logger.info('Bookmark: PDF loaded, loading bookmarks...');
      this.#loadBookmarks(data.document);
    });

    logger.info('BookmarkFeature: Listening for PDF load events');
  }

  #loadBookmarks(document) {
    // 从PDF提取书签
    this.#bookmarks = document.getOutline();
  }

  jumpToBookmark(bookmark) {
    // 发布事件：跳转到页面
    globalEventBus.emit('page:jump', {
      pageNumber: bookmark.dest[0]
    });
  }

  async uninstall(context) {
    // 清理：取消订阅
    if (this.#unsubscribe) {
      this.#unsubscribe();
    }
  }
}

// ========== UIManagerFeature ==========
class UIManagerFeature {
  #currentPage = 1;
  #unsubscribes = [];

  get dependencies() {
    return ['pdf-manager'];
  }

  async install(context) {
    const { globalEventBus, logger } = context;

    // 订阅多个事件
    const unsubscribe1 = globalEventBus.subscribe('pdf:loaded', (data) => {
      this.#renderFirstPage(data.document);
    });

    const unsubscribe2 = globalEventBus.subscribe('page:jump', (data) => {
      this.#jumpToPage(data.pageNumber);
    });

    this.#unsubscribes.push(unsubscribe1, unsubscribe2);

    logger.info('UIManager: Ready to render');
  }

  #jumpToPage(pageNumber) {
    this.#currentPage = pageNumber;
    this.#render();
  }

  async uninstall(context) {
    // 清理：取消所有订阅
    this.#unsubscribes.forEach(fn => fn());
    this.#unsubscribes = [];
  }
}
```

---

## 设计思想解析

### 为什么要用EventBus而不是直接调用？

**问题场景**：
```javascript
// ❌ 直接调用 - 紧耦合
class PDFManager {
  loadPDF() {
    const doc = loadDocument();

    // 需要通知很多模块
    this.bookmarkManager.loadBookmarks(doc);  // 耦合1
    this.uiManager.render(doc);              // 耦合2
    this.thumbnailManager.generate(doc);     // 耦合3
    // 每增加一个功能就要修改这里
  }
}
```

**EventBus解耦**：
```javascript
// ✅ EventBus - 解耦
class PDFManager {
  loadPDF() {
    const doc = loadDocument();

    // 只发布事件，不关心谁在监听
    eventBus.emit('pdf:loaded', { document: doc });
    // 新增功能？只需订阅事件，无需修改这里
  }
}

// 各个模块独立订阅
class BookmarkManager {
  init() {
    eventBus.subscribe('pdf:loaded', (data) => {
      this.loadBookmarks(data.document);
    });
  }
}

class UIManager {
  init() {
    eventBus.subscribe('pdf:loaded', (data) => {
      this.render(data.document);
    });
  }
}
```

**优势**：
- ✅ PDFManager不需要知道有多少模块在监听
- ✅ 新增功能只需订阅事件，无需修改PDFManager
- ✅ 可以动态增删监听器
- ✅ 解耦，易于测试

---

### 为什么需要DependencyContainer？

**问题场景**：
```javascript
// ❌ 全局变量 - 污染命名空间
window.globalEventBus = new EventBus();
window.globalLogger = new Logger();
window.globalWSClient = new WSClient();

// ❌ 手动传参 - 参数爆炸
class MyFeature {
  async install(eventBus, logger, wsClient, config, container, registry, ...) {
    // 参数太多，难以维护
  }
}
```

**Container解决方案**：
```javascript
// ✅ 统一管理
const container = new DependencyContainer();
container.register('eventBus', eventBus);
container.register('logger', logger);
container.register('wsClient', wsClient);

// ✅ 按需获取
class MyFeature {
  async install(context) {
    const { container } = context;
    const wsClient = container.get('wsClient');  // 需要什么取什么
  }
}
```

**优势**：
- ✅ 集中管理共享对象
- ✅ 避免全局变量污染
- ✅ 按需获取，清晰明了
- ✅ 便于替换和测试（mock）

---

### 为什么Feature要有dependencies？

**问题场景**：
```javascript
// ❌ 手动管理顺序 - 容易出错
registry.register(new BookmarkFeature());   // 依赖PDFManager，但还没注册
registry.register(new PDFManagerFeature()); // 后注册，导致Bookmark出错
registry.register(new AppCoreFeature());    // 最后注册，但应该最先
```

**dependencies自动排序**：
```javascript
// ✅ 声明依赖关系
class AppCoreFeature {
  get dependencies() { return []; }
}

class PDFManagerFeature {
  get dependencies() { return ['app-core']; }
}

class BookmarkFeature {
  get dependencies() { return ['pdf-manager']; }
}

// ✅ Registry自动计算正确顺序
registry.register(new BookmarkFeature());    // 注册顺序无所谓
registry.register(new PDFManagerFeature());
registry.register(new AppCoreFeature());

await registry.installAll();
// 实际安装顺序: AppCore → PDFManager → Bookmark
```

**优势**：
- ✅ 自动计算依赖顺序
- ✅ 注册顺序无关
- ✅ 避免人为错误
- ✅ 支持复杂依赖图

---

## 实战案例

### 案例：添加一个"最近打开"功能

**需求**：记录用户最近打开的5个PDF文件

**步骤1：创建Feature**

```javascript
// features/recent-files/index.js
export class RecentFilesFeature {
  #recentFiles = [];
  #maxFiles = 5;
  #unsubscribes = [];

  get name() {
    return 'recent-files';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return ['pdf-manager'];  // 依赖pdf-manager
  }

  async install(context) {
    const { globalEventBus, logger } = context;

    logger.info('Installing RecentFilesFeature...');

    // 从localStorage加载历史记录
    this.#loadFromStorage();

    // 订阅PDF加载事件
    const unsubscribe = globalEventBus.subscribe('pdf:loaded', (data) => {
      this.#addRecentFile(data.filename);
    });

    this.#unsubscribes.push(unsubscribe);

    logger.info('RecentFilesFeature installed');
  }

  async uninstall(context) {
    const { logger } = context;

    // 取消订阅
    this.#unsubscribes.forEach(fn => fn());
    this.#unsubscribes = [];

    logger.info('RecentFilesFeature uninstalled');
  }

  #loadFromStorage() {
    const stored = localStorage.getItem('recentFiles');
    if (stored) {
      this.#recentFiles = JSON.parse(stored);
    }
  }

  #addRecentFile(filename) {
    // 移除重复项
    this.#recentFiles = this.#recentFiles.filter(f => f !== filename);

    // 添加到开头
    this.#recentFiles.unshift(filename);

    // 限制数量
    if (this.#recentFiles.length > this.#maxFiles) {
      this.#recentFiles = this.#recentFiles.slice(0, this.#maxFiles);
    }

    // 保存到localStorage
    localStorage.setItem('recentFiles', JSON.stringify(this.#recentFiles));

    // 发布事件：最近文件列表更新
    globalEventBus.emit('recent-files:updated', {
      files: this.#recentFiles
    });
  }

  getRecentFiles() {
    return [...this.#recentFiles];
  }
}
```

**步骤2：注册Feature**

```javascript
// bootstrap/app-bootstrap-feature.js
import { RecentFilesFeature } from "../features/recent-files/index.js";

export async function bootstrapPDFViewerAppFeature() {
  // ... 其他代码 ...

  registry.register(new RecentFilesFeature());  // 添加这一行

  await registry.installAll();
}
```

**步骤3：UI监听并显示**

```javascript
// UI代码可以订阅recent-files:updated事件
globalEventBus.subscribe('recent-files:updated', (data) => {
  updateRecentFilesMenu(data.files);
});
```

**完成！**
- ✅ 无需修改PDFManager代码
- ✅ 无需修改其他Feature
- ✅ 自动按依赖顺序安装
- ✅ 通过EventBus解耦

---

## 总结

### 核心组件关系图

```
┌─────────────────────────────────────────────────────┐
│                   Bootstrap                          │
│  1. 创建EventBus、Logger等基础对象                   │
│  2. 创建Container并注册这些对象                      │
│  3. 创建Registry                                     │
│  4. 注册所有Features                                 │
│  5. installAll()                                     │
└───────────────┬─────────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│            FeatureRegistry                        │
│  • 管理所有Feature实例                            │
│  • 分析依赖关系                                   │
│  • 拓扑排序计算安装顺序                           │
│  • 依次调用install()                              │
└───────────────┬───────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│         各个Feature的install()                    │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  AppCore    │  │ PDFManager  │               │
│  │ • 创建WS连接 │  │ • 初始化管理器│              │
│  │ • 注册到容器 │  │ • 订阅事件   │              │
│  └─────────────┘  └─────────────┘               │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  Bookmark   │  │  UIManager  │               │
│  │ • 订阅事件   │  │ • 初始化UI  │               │
│  │ • 加载书签   │  │ • 监听渲染  │               │
│  └─────────────┘  └─────────────┘               │
└───────────────┬───────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│            运行时通信                              │
│                                                   │
│         EventBus (事件总线)                       │
│  ┌─────────────────────────────────────┐         │
│  │  Feature A ──emit──> EventBus       │         │
│  │                         │            │         │
│  │                         ├──> Feature B        │
│  │                         ├──> Feature C        │
│  │                         └──> Feature D        │
│  └─────────────────────────────────────┘         │
└───────────────────────────────────────────────────┘
```

### 关键要点

1. **FeatureRegistry** = 生命周期管理器
   - 注册Features
   - 解析依赖
   - 按序安装

2. **EventBus** = 通信中枢
   - Feature间解耦
   - 发布-订阅模式
   - 支持多对多通信

3. **DependencyContainer** = 服务仓库
   - 集中管理共享对象
   - 按需获取
   - 避免全局污染

4. **Feature** = 独立插件
   - 单一职责
   - 声明依赖
   - 自我管理

### 设计优势

✅ **解耦** - Feature间无直接依赖
✅ **可扩展** - 新增功能无需修改现有代码
✅ **可测试** - 每个Feature可独立测试
✅ **并行开发** - 多人同时开发不同Feature
✅ **动态性** - 可运行时加载/卸载Feature

---

**现在你理解整套架构了吗？🎓**

参考：
- [HOW-TO-ADD-FEATURE.md](./HOW-TO-ADD-FEATURE.md) - 开发指南
- [FEATURE-REGISTRATION-RULES.md](../.kilocode/rules/FEATURE-REGISTRATION-RULES.md) - 注册规则
