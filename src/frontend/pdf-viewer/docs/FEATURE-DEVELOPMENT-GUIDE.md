# Feature独立开发指南

## 概述

Feature-based架构允许多个开发者同时开发不同功能，互不干扰。每个Feature是一个独立的插件模块，通过EventBus与其他模块通信。

## 开发流程示例：同时开发搜索功能和标注栏功能

### 场景
- **开发者A**: 开发PDF搜索功能
- **开发者B**: 开发标注栏功能
- **目标**: 两个功能独立开发、测试、集成

---

## Step 1: 规划Feature

### 1.1 定义Feature基本信息

**搜索功能 (search Feature)**
```javascript
{
  name: 'search',
  version: '1.0.0',
  dependencies: ['app-core', 'pdf-manager'], // 依赖事件总线和PDF文档
  description: 'PDF全文搜索功能'
}
```

**标注栏功能 (annotation Feature)**
```javascript
{
  name: 'annotation',
  version: '1.0.0',
  dependencies: ['app-core', 'ui-manager'],  // 依赖事件总线和UI管理器
  description: 'PDF标注侧边栏功能'
}
```

### 1.2 定义事件接口（重要！）

在开始编码前，先在 `pdf-viewer-constants.js` 中定义事件常量：

```javascript
// src/frontend/common/event/pdf-viewer-constants.js

export const PDF_VIEWER_EVENTS = {
  // ... 现有事件 ...

  // 搜索功能事件
  SEARCH: {
    OPEN: 'pdf-viewer:search:open',           // 打开搜索框
    CLOSE: 'pdf-viewer:search:close',         // 关闭搜索框
    QUERY: 'pdf-viewer:search:query',         // 执行搜索
    RESULT: 'pdf-viewer:search:result',       // 搜索结果
    NAVIGATE_NEXT: 'pdf-viewer:search:next',  // 下一个结果
    NAVIGATE_PREV: 'pdf-viewer:search:prev'   // 上一个结果
  },

  // 标注功能事件
  ANNOTATION: {
    SIDEBAR_TOGGLE: 'pdf-viewer:annotation:sidebar:toggle',  // 切换侧边栏
    SIDEBAR_OPEN: 'pdf-viewer:annotation:sidebar:open',      // 打开侧边栏
    SIDEBAR_CLOSE: 'pdf-viewer:annotation:sidebar:close',    // 关闭侧边栏
    CREATE: 'pdf-viewer:annotation:create',                  // 创建标注
    UPDATE: 'pdf-viewer:annotation:update',                  // 更新标注
    DELETE: 'pdf-viewer:annotation:delete',                  // 删除标注
    SELECT: 'pdf-viewer:annotation:select'                   // 选中标注
  }
};
```

---

## Step 2: 创建Feature目录结构

### 2.1 搜索功能目录

```bash
mkdir -p src/frontend/pdf-viewer/features/search
cd src/frontend/pdf-viewer/features/search
```

```
features/search/
├── index.js                  # Feature入口
├── components/
│   ├── search-ui.js         # 搜索UI组件
│   └── search-result-item.js # 搜索结果项
├── services/
│   └── search-engine.js     # 搜索引擎（PDF.js findController）
├── __tests__/
│   ├── search-feature.test.js
│   └── search-engine.test.js
└── README.md
```

### 2.2 标注栏功能目录

```bash
mkdir -p src/frontend/pdf-viewer/features/annotation
cd src/frontend/pdf-viewer/features/annotation
```

```
features/annotation/
├── index.js                  # Feature入口
├── components/
│   ├── annotation-sidebar.js    # 标注侧边栏组件
│   ├── annotation-item.js       # 标注项组件
│   └── annotation-toolbar.js    # 标注工具栏
├── services/
│   ├── annotation-manager.js    # 标注管理器
│   └── annotation-storage.js    # 标注存储（WebSocket同步）
├── __tests__/
│   ├── annotation-feature.test.js
│   └── annotation-manager.test.js
└── README.md
```

---

## Step 3: 实现Feature类

### 3.1 搜索Feature实现

```javascript
// features/search/index.js

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { SearchUI } from './components/search-ui.js';
import { SearchEngine } from './services/search-engine.js';

/**
 * 搜索功能Feature
 * @class SearchFeature
 * @implements {IFeature}
 */
export class SearchFeature {
  #logger = getLogger('SearchFeature');
  #eventBus = null;
  #searchUI = null;
  #searchEngine = null;
  #pdfDocument = null;

  /** Feature名称 */
  get name() {
    return 'search';
  }

  /** 版本号 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的Features */
  get dependencies() {
    return ['app-core', 'pdf-manager'];
  }

  /**
   * 安装Feature
   * @param {SimpleDependencyContainer} container - 依赖容器
   */
  async install(container) {
    this.#logger.info('Installing Search Feature...');

    // 1. 获取依赖
    this.#eventBus = container.resolve('eventBus');

    if (!this.#eventBus) {
      throw new Error('EventBus not found in container');
    }

    // 2. 初始化搜索UI
    this.#searchUI = new SearchUI(this.#eventBus);
    await this.#searchUI.initialize();

    // 3. 初始化搜索引擎
    this.#searchEngine = new SearchEngine();

    // 4. 设置事件监听
    this.#setupEventListeners();

    this.#logger.info('Search Feature installed successfully');
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('Uninstalling Search Feature...');

    if (this.#searchUI) {
      this.#searchUI.destroy();
      this.#searchUI = null;
    }

    if (this.#searchEngine) {
      this.#searchEngine.destroy();
      this.#searchEngine = null;
    }

    this.#eventBus = null;
    this.#pdfDocument = null;

    this.#logger.info('Search Feature uninstalled');
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听PDF加载成功，初始化搜索引擎
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      ({ pdfDocument }) => {
        this.#pdfDocument = pdfDocument;
        this.#searchEngine.setPDFDocument(pdfDocument);
        this.#logger.info('Search engine initialized with PDF document');
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听搜索请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.QUERY,
      async ({ query, options }) => {
        this.#logger.info(`Searching for: ${query}`);

        try {
          const results = await this.#searchEngine.search(query, options);

          // 发出搜索结果事件
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.SEARCH.RESULT,
            { query, results, total: results.length },
            { actorId: 'SearchFeature' }
          );
        } catch (error) {
          this.#logger.error('Search failed:', error);
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.SEARCH.RESULT,
            { query, results: [], error: error.message },
            { actorId: 'SearchFeature' }
          );
        }
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听导航到下一个搜索结果
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE_NEXT,
      () => {
        const nextResult = this.#searchEngine.nextResult();
        if (nextResult) {
          // 导航到对应页面
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
            { pageNumber: nextResult.pageNumber },
            { actorId: 'SearchFeature' }
          );
        }
      },
      { subscriberId: 'SearchFeature' }
    );
  }
}
```

### 3.2 标注Feature实现

```javascript
// features/annotation/index.js

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { AnnotationSidebar } from './components/annotation-sidebar.js';
import { AnnotationManager } from './services/annotation-manager.js';

/**
 * 标注功能Feature
 * @class AnnotationFeature
 * @implements {IFeature}
 */
export class AnnotationFeature {
  #logger = getLogger('AnnotationFeature');
  #eventBus = null;
  #sidebar = null;
  #manager = null;
  #wsClient = null;

  get name() {
    return 'annotation';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return ['app-core', 'ui-manager'];
  }

  async install(container) {
    this.#logger.info('Installing Annotation Feature...');

    // 1. 获取依赖
    this.#eventBus = container.resolve('eventBus');
    this.#wsClient = container.resolve('wsClient');

    // 2. 初始化标注管理器
    this.#manager = new AnnotationManager(this.#eventBus, this.#wsClient);
    await this.#manager.initialize();

    // 3. 初始化侧边栏UI
    this.#sidebar = new AnnotationSidebar(this.#eventBus);
    await this.#sidebar.initialize();

    // 4. 设置事件监听
    this.#setupEventListeners();

    // 5. 设置UI按钮监听
    this.#setupUIButton();

    this.#logger.info('Annotation Feature installed successfully');
  }

  async uninstall() {
    this.#logger.info('Uninstalling Annotation Feature...');

    if (this.#sidebar) {
      this.#sidebar.destroy();
      this.#sidebar = null;
    }

    if (this.#manager) {
      this.#manager.destroy();
      this.#manager = null;
    }

    this.#logger.info('Annotation Feature uninstalled');
  }

  #setupEventListeners() {
    // 监听切换侧边栏事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR_TOGGLE,
      () => {
        this.#sidebar.toggle();
      },
      { subscriberId: 'AnnotationFeature' }
    );

    // 监听创建标注事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      async (annotationData) => {
        try {
          const annotation = await this.#manager.createAnnotation(annotationData);
          this.#logger.info('Annotation created:', annotation.id);
        } catch (error) {
          this.#logger.error('Failed to create annotation:', error);
        }
      },
      { subscriberId: 'AnnotationFeature' }
    );

    // 监听PDF加载，加载该文档的标注
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      async ({ filename }) => {
        const annotations = await this.#manager.loadAnnotations(filename);
        this.#sidebar.renderAnnotations(annotations);
      },
      { subscriberId: 'AnnotationFeature' }
    );
  }

  #setupUIButton() {
    // 获取顶部工具栏的标注按钮
    const annotationBtn = document.getElementById('annotation-toggle-btn');

    if (annotationBtn) {
      annotationBtn.addEventListener('click', () => {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR_TOGGLE,
          null,
          { actorId: 'AnnotationButton' }
        );
      });

      this.#logger.info('Annotation button event listener attached');
    } else {
      this.#logger.warn('Annotation button not found in DOM');
    }
  }
}
```

---

## Step 4: 编写组件代码

### 4.1 搜索UI组件示例

```javascript
// features/search/components/search-ui.js

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

export class SearchUI {
  #eventBus;
  #logger = getLogger('SearchUI');
  #searchBox = null;
  #searchInput = null;
  #resultCount = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  async initialize() {
    this.#logger.info('Initializing Search UI...');

    // 创建搜索框DOM
    this.#createSearchBox();

    // 设置快捷键（Ctrl+F）
    this.#setupKeyboardShortcut();

    // 监听搜索结果
    this.#setupResultListener();
  }

  #createSearchBox() {
    // 创建搜索框HTML
    const searchHTML = `
      <div id="search-box" class="search-box hidden">
        <input id="search-input" type="text" placeholder="搜索PDF..." />
        <button id="search-next">下一个</button>
        <button id="search-prev">上一个</button>
        <span id="search-result-count">0/0</span>
        <button id="search-close">×</button>
      </div>
    `;

    // 插入到页面
    document.body.insertAdjacentHTML('beforeend', searchHTML);

    // 获取DOM元素
    this.#searchBox = document.getElementById('search-box');
    this.#searchInput = document.getElementById('search-input');
    this.#resultCount = document.getElementById('search-result-count');

    // 绑定事件
    this.#searchInput.addEventListener('input', (e) => {
      this.#handleSearch(e.target.value);
    });

    document.getElementById('search-next').addEventListener('click', () => {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.NAVIGATE_NEXT);
    });

    document.getElementById('search-close').addEventListener('click', () => {
      this.close();
    });
  }

  #setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+F 打开搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.open();
      }
      // Esc 关闭搜索
      if (e.key === 'Escape' && !this.#searchBox.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  #handleSearch(query) {
    if (!query || query.length < 2) return;

    // 防抖处理
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.SEARCH.QUERY,
        { query, options: { caseSensitive: false } },
        { actorId: 'SearchUI' }
      );
    }, 300);
  }

  #setupResultListener() {
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.RESULT,
      ({ results, total }) => {
        this.#resultCount.textContent = `${results.length}/${total}`;
      },
      { subscriberId: 'SearchUI' }
    );
  }

  open() {
    this.#searchBox.classList.remove('hidden');
    this.#searchInput.focus();
  }

  close() {
    this.#searchBox.classList.add('hidden');
  }

  destroy() {
    if (this.#searchBox) {
      this.#searchBox.remove();
    }
  }
}
```

### 4.2 标注侧边栏组件示例

```javascript
// features/annotation/components/annotation-sidebar.js

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

export class AnnotationSidebar {
  #eventBus;
  #logger = getLogger('AnnotationSidebar');
  #sidebar = null;
  #isOpen = false;

  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  async initialize() {
    this.#logger.info('Initializing Annotation Sidebar...');
    this.#createSidebar();
  }

  #createSidebar() {
    const sidebarHTML = `
      <div id="annotation-sidebar" class="annotation-sidebar closed">
        <div class="sidebar-header">
          <h3>标注列表</h3>
          <button id="annotation-sidebar-close">×</button>
        </div>
        <div id="annotation-list" class="annotation-list">
          <!-- 标注列表将动态填充 -->
        </div>
        <div class="sidebar-footer">
          <button id="annotation-create-btn">+ 新建标注</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', sidebarHTML);
    this.#sidebar = document.getElementById('annotation-sidebar');

    // 绑定关闭按钮
    document.getElementById('annotation-sidebar-close').addEventListener('click', () => {
      this.close();
    });

    // 绑定新建按钮
    document.getElementById('annotation-create-btn').addEventListener('click', () => {
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
        { type: 'text', content: '' },
        { actorId: 'AnnotationSidebar' }
      );
    });
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.#sidebar.classList.remove('closed');
    this.#sidebar.classList.add('open');
    this.#isOpen = true;

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR_OPEN,
      null,
      { actorId: 'AnnotationSidebar' }
    );
  }

  close() {
    this.#sidebar.classList.remove('open');
    this.#sidebar.classList.add('closed');
    this.#isOpen = false;

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR_CLOSE,
      null,
      { actorId: 'AnnotationSidebar' }
    );
  }

  renderAnnotations(annotations) {
    const listContainer = document.getElementById('annotation-list');
    listContainer.innerHTML = annotations.map(ann => `
      <div class="annotation-item" data-id="${ann.id}">
        <div class="annotation-content">${ann.content}</div>
        <div class="annotation-meta">页面 ${ann.pageNumber}</div>
      </div>
    `).join('');

    // 绑定点击事件
    listContainer.querySelectorAll('.annotation-item').forEach(item => {
      item.addEventListener('click', () => {
        const annId = item.dataset.id;
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
          { annotationId: annId },
          { actorId: 'AnnotationSidebar' }
        );
      });
    });
  }

  destroy() {
    if (this.#sidebar) {
      this.#sidebar.remove();
    }
  }
}
```

---

## Step 5: 注册Features

### 5.1 在main.js中注册

```javascript
// main.js

import { bootstrapFeatureApp } from './bootstrap/app-bootstrap-feature.js';
import { AppCoreFeature } from './features/app-core/index.js';
import { PDFManagerFeature } from './features/pdf-manager/index.js';
import { UIManagerFeature } from './features/ui-manager/index.js';

// 导入新开发的Features
import { SearchFeature } from './features/search/index.js';
import { AnnotationFeature } from './features/annotation/index.js';

// 注册所有Features
const features = [
  new AppCoreFeature(),
  new PDFManagerFeature(),
  new UIManagerFeature(),
  new SearchFeature(),        // 搜索Feature
  new AnnotationFeature()     // 标注Feature
];

// 启动应用
bootstrapFeatureApp(features)
  .then(() => {
    console.log('PDF Viewer started with all features');
  })
  .catch((error) => {
    console.error('Failed to start PDF Viewer:', error);
  });
```

---

## Step 6: 编写测试

### 6.1 搜索Feature测试

```javascript
// features/search/__tests__/search-feature.test.js

import { SearchFeature } from '../index.js';
import { SimpleDependencyContainer } from '../../../container/simple-dependency-container.js';

describe('SearchFeature', () => {
  let feature;
  let container;
  let mockEventBus;

  beforeEach(() => {
    // 创建mock EventBus
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn()
    };

    // 创建容器并注册依赖
    container = new SimpleDependencyContainer();
    container.register('eventBus', mockEventBus);

    feature = new SearchFeature();
  });

  test('应该正确定义Feature信息', () => {
    expect(feature.name).toBe('search');
    expect(feature.version).toBe('1.0.0');
    expect(feature.dependencies).toContain('app-core');
  });

  test('应该成功安装Feature', async () => {
    await expect(feature.install(container)).resolves.not.toThrow();

    // 验证EventBus监听器被注册
    expect(mockEventBus.on).toHaveBeenCalled();
  });

  test('应该监听FILE.LOAD.SUCCESS事件', async () => {
    await feature.install(container);

    const onCalls = mockEventBus.on.mock.calls;
    const hasFileLoadListener = onCalls.some(
      call => call[0] === 'pdf-viewer:file:load-success'
    );

    expect(hasFileLoadListener).toBe(true);
  });

  test('应该正确卸载Feature', async () => {
    await feature.install(container);
    await expect(feature.uninstall()).resolves.not.toThrow();
  });
});
```

### 6.2 标注Feature测试

```javascript
// features/annotation/__tests__/annotation-feature.test.js

import { AnnotationFeature } from '../index.js';
import { SimpleDependencyContainer } from '../../../container/simple-dependency-container.js';

describe('AnnotationFeature', () => {
  let feature;
  let container;
  let mockEventBus;
  let mockWSClient;

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn()
    };

    mockWSClient = {
      send: jest.fn(),
      on: jest.fn()
    };

    container = new SimpleDependencyContainer();
    container.register('eventBus', mockEventBus);
    container.register('wsClient', mockWSClient);

    feature = new AnnotationFeature();
  });

  test('应该正确定义Feature信息', () => {
    expect(feature.name).toBe('annotation');
    expect(feature.dependencies).toContain('app-core');
    expect(feature.dependencies).toContain('ui-manager');
  });

  test('应该成功安装Feature', async () => {
    // Mock DOM元素
    document.body.innerHTML = '<button id="annotation-toggle-btn"></button>';

    await expect(feature.install(container)).resolves.not.toThrow();
  });

  test('应该监听SIDEBAR_TOGGLE事件', async () => {
    document.body.innerHTML = '<button id="annotation-toggle-btn"></button>';
    await feature.install(container);

    const onCalls = mockEventBus.on.mock.calls;
    const hasToggleListener = onCalls.some(
      call => call[0] === 'pdf-viewer:annotation:sidebar:toggle'
    );

    expect(hasToggleListener).toBe(true);
  });
});
```

---

## Step 7: 调试和集成

### 7.1 独立调试单个Feature

```javascript
// features/search/debug.js

import { SearchFeature } from './index.js';
import { SimpleDependencyContainer } from '../../container/simple-dependency-container.js';
import { EventBus } from '../../../common/event/event-bus.js';

// 创建最小化测试环境
async function debugSearchFeature() {
  const container = new SimpleDependencyContainer();
  const eventBus = new EventBus();

  container.register('eventBus', eventBus);

  const searchFeature = new SearchFeature();
  await searchFeature.install(container);

  // 模拟搜索请求
  eventBus.emit('pdf-viewer:search:query', {
    query: 'test',
    options: {}
  });

  console.log('Search Feature debugging...');
}

debugSearchFeature();
```

### 7.2 Feature热重载（开发时）

由于Vite支持热模块替换(HMR)，修改Feature代码后会自动重载：

```javascript
// features/search/index.js

// Vite HMR支持
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('SearchFeature hot reloaded');
  });
}
```

---

## 并行开发最佳实践

### 1. **事件接口先行**
```
开发者A和B先共同定义所有事件常量
    ↓
各自独立实现Feature
    ↓
通过EventBus集成，无需修改对方代码
```

### 2. **Mock依赖进行测试**
```javascript
// 开发者A在没有ui-manager的情况下测试search
const mockEventBus = {
  on: jest.fn(),
  emit: jest.fn()
};
```

### 3. **Feature版本管理**
```javascript
get version() {
  return '1.0.0';  // 遵循语义化版本
}
```

### 4. **文档先行**
每个Feature目录都应有README.md：

```markdown
# Search Feature

## 功能说明
提供PDF全文搜索功能

## 依赖
- app-core
- pdf-manager

## 事件接口
- 监听: FILE.LOAD.SUCCESS, SEARCH.QUERY
- 发出: SEARCH.RESULT

## 使用示例
\`\`\`javascript
eventBus.emit('pdf-viewer:search:query', {
  query: 'keyword',
  options: { caseSensitive: false }
});
\`\`\`
```

### 5. **Feature独立性检查清单**

- [ ] Feature类实现了IFeature接口（name, version, dependencies, install, uninstall）
- [ ] 所有依赖通过container.resolve()获取
- [ ] 不直接import其他Feature的代码
- [ ] 所有通信通过EventBus
- [ ] 有完整的测试覆盖
- [ ] 有README文档
- [ ] 可以单独安装/卸载而不影响其他Features

---

## 常见问题

### Q1: 两个Feature需要共享数据怎么办？
**A**: 通过EventBus传递数据，或将共享数据注册到container中。

```javascript
// Feature A 存储数据到container
container.register('sharedData', myData);

// Feature B 获取数据
const data = container.resolve('sharedData');
```

### Q2: Feature之间有循环依赖怎么办？
**A**: 重新设计架构，通过EventBus解耦，或提取共同依赖到新的Feature。

### Q3: 如何临时禁用某个Feature？
**A**: 在main.js中注释掉该Feature即可。

```javascript
const features = [
  new AppCoreFeature(),
  new PDFManagerFeature(),
  new UIManagerFeature(),
  // new SearchFeature(),     // 临时禁用搜索功能
  new AnnotationFeature()
];
```

### Q4: Feature开发完成后如何合并？
**A**:
1. 确保所有测试通过
2. 更新事件常量（如有新增）
3. 在main.js中注册Feature
4. 提交代码并创建PR

---

## 总结

Feature-based架构的优势：

1. **并行开发**: 多人可同时开发不同Features，互不干扰
2. **独立测试**: 每个Feature有独立的测试套件
3. **按需加载**: 可选择性加载Features
4. **易于维护**: Feature内部高内聚，Features之间低耦合
5. **渐进式迁移**: 新旧架构可共存

遵循本指南，你可以高效地进行Feature独立开发和团队协作！
