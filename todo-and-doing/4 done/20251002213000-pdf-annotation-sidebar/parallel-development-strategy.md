# PDF标注功能并行开发策略

**文档版本**: v1.0
**创建时间**: 2025-10-03 02:30:00
**目标**: 截图、划词、批注三个功能并行开发，避免Git合并冲突

## 依赖关系分析

### 共享组件（会产生冲突的）

| 组件 | 文件路径 | 冲突风险 | 解决方案 |
|------|---------|---------|---------|
| 事件常量 | `common/event/pdf-viewer-constants.js` | 🔴 高 | **接口优先**：一次性定义所有事件 |
| 数据模型 | `features/annotation/models/` | 🟡 中 | **接口优先**：先定义完整接口 |
| AnnotationFeature | `features/annotation/index.js` | 🔴 高 | **主干先行**：基础结构先完成 |
| AnnotationSidebarUI | `features/annotation/components/annotation-sidebar-ui.js` | 🟡 中 | **模板方法模式**：预留扩展点 |
| AnnotationManager | `features/annotation/services/annotation-manager.js` | 🟡 中 | **接口隔离**：预定义方法签名 |

### 独立组件（不会冲突的）

| 功能 | 独立文件 | 冲突风险 |
|------|---------|---------|
| 截图工具 | `components/screenshot-tool.js`<br>`services/screenshot-capturer.js`<br>`services/qwebchannel-screenshot-bridge.js` | 🟢 无 |
| 划词工具 | `components/text-highlight-tool.js`<br>`services/text-highlight-renderer.js` | 🟢 无 |
| 批注工具 | `components/comment-tool.js`<br>`services/comment-renderer.js` | 🟢 无 |

## 并行开发策略

### 阶段0: 接口设计（1-2小时，必须完成）✨

**责任人**: 架构师或Tech Lead
**分支**: `feature/annotation-base`
**目标**: 定义所有接口契约，作为三个功能的开发基准

#### 0.1 完成事件定义（全部27个事件）

```javascript
// src/frontend/common/event/pdf-viewer-constants.js

ANNOTATION: {
  // ===== 侧边栏事件 =====
  SIDEBAR: {
    TOGGLE: 'annotation-sidebar:toggle:requested',
    OPEN: 'annotation-sidebar:toggle:open',
    CLOSE: 'annotation-sidebar:toggle:close',
    OPENED: 'annotation-sidebar:toggle:opened',
    CLOSED: 'annotation-sidebar:toggle:closed',
  },

  // ===== 工具激活事件 =====
  TOOL: {
    ACTIVATE: 'annotation-tool:activate:requested',    // data: { tool: 'screenshot'|'text-highlight'|'comment' }
    DEACTIVATE: 'annotation-tool:deactivate:requested',
    ACTIVATED: 'annotation-tool:activate:success',     // data: { tool }
    DEACTIVATED: 'annotation-tool:deactivate:success', // data: { tool }
  },

  // ===== 标注CRUD事件 =====
  CREATE: 'annotation:create:requested',      // data: { type, pageNumber, data }
  CREATED: 'annotation:create:success',       // data: { annotation }
  CREATE_FAILED: 'annotation:create:failed',  // data: { error }

  UPDATE: 'annotation:update:requested',      // data: { id, changes }
  UPDATED: 'annotation:update:success',       // data: { annotation }

  DELETE: 'annotation:delete:requested',      // data: { id }
  DELETED: 'annotation:delete:success',       // data: { id }

  // ===== 标注交互事件 =====
  SELECT: 'annotation:select:requested',      // data: { id }
  JUMP_TO: 'annotation:jump:requested',       // data: { id }
  HIGHLIGHT: 'annotation:highlight:requested',// data: { id }

  // ===== 评论事件 =====
  COMMENT: {
    ADD: 'annotation-comment:add:requested',
    ADDED: 'annotation-comment:add:success',
    DELETE: 'annotation-comment:delete:requested',
    DELETED: 'annotation-comment:delete:success',
  },

  // ===== 数据加载事件 =====
  DATA: {
    LOAD: 'annotation-data:load:requested',
    LOADED: 'annotation-data:load:success',
    SAVE: 'annotation-data:save:requested',
    SAVED: 'annotation-data:save:success',
  }
}
```

#### 0.2 定义数据模型接口

```javascript
// src/frontend/pdf-viewer/features/annotation/models/annotation.js

/**
 * 标注数据模型（完整接口定义）
 */
export class Annotation {
  constructor(data) {
    this.id = data.id || this.#generateId();
    this.type = data.type;  // 'screenshot' | 'text-highlight' | 'comment'
    this.pageNumber = data.pageNumber;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.comments = data.comments || [];
    this.data = data.data;  // 类型特定数据
  }

  // ===== 静态工厂方法（预留三个类型）=====
  static createScreenshot(pageNumber, rect, imagePath, imageHash, description = '') {
    return new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber,
      data: { rect, imagePath, imageHash, description }
    });
  }

  static createTextHighlight(pageNumber, selectedText, textRanges, highlightColor, note = '') {
    return new Annotation({
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber,
      data: { selectedText, textRanges, highlightColor, note }
    });
  }

  static createComment(pageNumber, position, content) {
    return new Annotation({
      type: AnnotationType.COMMENT,
      pageNumber,
      data: { position, content }
    });
  }

  // ===== 公共方法 =====
  toJSON() { /* ... */ }
  static fromJSON(json) { /* ... */ }
  addComment(comment) { /* ... */ }
  removeComment(commentId) { /* ... */ }
  updateData(changes) { /* ... */ }

  #generateId() {
    return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

/**
 * 标注类型枚举
 */
export const AnnotationType = {
  SCREENSHOT: 'screenshot',
  TEXT_HIGHLIGHT: 'text-highlight',
  COMMENT: 'comment'
};
```

#### 0.3 定义工具接口（ITool接口）

```javascript
// src/frontend/pdf-viewer/features/annotation/interfaces/ITool.js

/**
 * 标注工具统一接口
 * 三个工具都必须实现这个接口
 */
export class ITool {
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
   * 清理资源
   * @returns {void}
   */
  cleanup() {
    throw new Error('Must implement cleanup()');
  }
}
```

#### 0.4 定义AnnotationManager接口

```javascript
// src/frontend/pdf-viewer/features/annotation/services/annotation-manager.js

/**
 * 标注管理器（只定义接口，实现留空）
 */
export class AnnotationManager {
  #eventBus;
  #annotations = new Map();
  #useMockBackend = true;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#setupEventListeners();
  }

  // ===== 接口方法（预定义签名）=====

  /**
   * 创建标注
   * @param {Object} annotationData
   * @returns {Promise<Annotation>}
   */
  async createAnnotation(annotationData) {
    // TODO: 各分支实现
  }

  /**
   * 更新标注
   * @param {string} id
   * @param {Object} changes
   * @returns {Promise<Annotation>}
   */
  async updateAnnotation(id, changes) {
    // TODO: 各分支实现
  }

  /**
   * 删除标注
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteAnnotation(id) {
    // TODO: 各分支实现
  }

  /**
   * 添加评论
   * @param {string} annotationId
   * @param {string} content
   * @returns {Promise<Comment>}
   */
  async addComment(annotationId, content) {
    // TODO: 各分支实现
  }

  #setupEventListeners() {
    // 监听CREATE事件
    this.#eventBus.on('annotation:create:requested',
      (data) => this.createAnnotation(data),
      { subscriberId: 'AnnotationManager' }
    );

    // TODO: 其他事件监听
  }
}
```

#### 0.5 定义AnnotationSidebarUI基础结构

```javascript
// src/frontend/pdf-viewer/features/annotation/components/annotation-sidebar-ui.js

export class AnnotationSidebarUI {
  #eventBus;
  #sidebar;
  #toolbar;
  #annotationList;

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
  }

  initialize() {
    this.#createSidebar();
    this.#setupEventListeners();
  }

  #createSidebar() {
    // 创建基础DOM结构
    this.#sidebar = this.#createSidebarContainer();
    this.#toolbar = this.#createToolbar();
    this.#annotationList = this.#createAnnotationList();
  }

  #createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'annotation-toolbar';

    // ✨预留三个工具按钮的位置
    toolbar.innerHTML = `
      <button id="screenshot-tool-btn" data-tool="screenshot">📷 截图</button>
      <button id="text-highlight-tool-btn" data-tool="text-highlight">✏️ 选字</button>
      <button id="comment-tool-btn" data-tool="comment">📝 批注</button>
    `;

    // 统一的工具按钮事件
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tool]');
      if (btn) {
        const tool = btn.dataset.tool;
        this.#eventBus.emit('annotation-tool:activate:requested', { tool });
      }
    });

    return toolbar;
  }

  #createAnnotationList() {
    const list = document.createElement('div');
    list.className = 'annotation-list';
    return list;
  }

  // ===== 渲染方法（模板方法模式）=====

  /**
   * 添加标注卡片（分发到具体类型）
   */
  addAnnotationCard(annotation) {
    const card = this.#createCardByType(annotation);
    this.#annotationList.appendChild(card);
  }

  /**
   * ✨根据类型创建卡片（扩展点）
   */
  #createCardByType(annotation) {
    switch (annotation.type) {
      case 'screenshot':
        return this.#createScreenshotCard(annotation);
      case 'text-highlight':
        return this.#createTextHighlightCard(annotation);
      case 'comment':
        return this.#createCommentCard(annotation);
      default:
        throw new Error('Unknown annotation type: ' + annotation.type);
    }
  }

  // ===== 类型特定卡片（各分支实现）=====

  #createScreenshotCard(annotation) {
    // TODO: feature/annotation-screenshot 实现
    return document.createElement('div');
  }

  #createTextHighlightCard(annotation) {
    // TODO: feature/annotation-text-highlight 实现
    return document.createElement('div');
  }

  #createCommentCard(annotation) {
    // TODO: feature/annotation-comment 实现
    return document.createElement('div');
  }
}
```

#### 0.6 定义AnnotationFeature基础结构

```javascript
// src/frontend/pdf-viewer/features/annotation/index.js

export class AnnotationFeature {
  #logger;
  #eventBus;
  #container;

  #annotationManager;
  #sidebarUI;

  // ✨三个工具实例（预留）
  #screenshotTool = null;
  #textHighlightTool = null;
  #commentTool = null;

  get name() { return 'annotation'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['app-core', 'ui-manager']; }

  async install(context) {
    const { globalEventBus, logger, container } = context;

    this.#logger = logger || getLogger('AnnotationFeature');
    this.#eventBus = globalEventBus;
    this.#container = container;

    // 1. 创建AnnotationManager
    this.#annotationManager = new AnnotationManager(this.#eventBus);

    // 2. 创建AnnotationSidebarUI
    this.#sidebarUI = new AnnotationSidebarUI(this.#eventBus);
    this.#sidebarUI.initialize();

    // 3. 初始化三个工具（各分支负责）
    await this.#initializeTools();

    // 4. 创建标注按钮
    this.#createAnnotationButton();

    // 5. 监听工具激活事件
    this.#setupToolActivation();
  }

  /**
   * ✨初始化三个工具（扩展点）
   */
  async #initializeTools() {
    // TODO: feature/annotation-screenshot 实现
    // this.#screenshotTool = new ScreenshotTool(...);

    // TODO: feature/annotation-text-highlight 实现
    // this.#textHighlightTool = new TextHighlightTool(...);

    // TODO: feature/annotation-comment 实现
    // this.#commentTool = new CommentTool(...);
  }

  /**
   * ✨工具激活切换（统一逻辑）
   */
  #setupToolActivation() {
    this.#eventBus.on('annotation-tool:activate:requested',
      ({ tool }) => {
        // 停用所有工具
        this.#deactivateAllTools();

        // 激活指定工具
        switch (tool) {
          case 'screenshot':
            this.#screenshotTool?.activate();
            break;
          case 'text-highlight':
            this.#textHighlightTool?.activate();
            break;
          case 'comment':
            this.#commentTool?.activate();
            break;
        }
      },
      { subscriberId: 'AnnotationFeature' }
    );
  }

  #deactivateAllTools() {
    this.#screenshotTool?.deactivate();
    this.#textHighlightTool?.deactivate();
    this.#commentTool?.deactivate();
  }
}
```

---

### 阶段1: 三个功能并行开发（各自独立）

#### 分支策略

```
main (或 d-main-20250927)
  ↓
feature/annotation-base  ← 合并后成为基准
  ↓
  ├─→ feature/annotation-screenshot        (开发者A)
  ├─→ feature/annotation-text-highlight    (开发者B)
  └─→ feature/annotation-comment           (开发者C)
```

#### 开发者A: 截图工具 (feature/annotation-screenshot)

**只修改以下文件**:
```
✅ 新增 components/screenshot-tool.js
✅ 新增 services/screenshot-capturer.js
✅ 新增 services/qwebchannel-screenshot-bridge.js
✅ 修改 index.js (只修改#initializeTools和#screenshotTool部分)
✅ 修改 annotation-sidebar-ui.js (只实现#createScreenshotCard方法)
✅ 修改 annotation-manager.js (只实现createAnnotation的screenshot分支)
```

**不允许修改**:
```
❌ pdf-viewer-constants.js (已在base分支定义)
❌ models/annotation.js (已在base分支定义)
❌ models/comment.js (已在base分支定义)
❌ 其他工具的文件
```

#### 开发者B: 划词工具 (feature/annotation-text-highlight)

**只修改以下文件**:
```
✅ 新增 components/text-highlight-tool.js
✅ 新增 services/text-highlight-renderer.js
✅ 修改 index.js (只修改#initializeTools和#textHighlightTool部分)
✅ 修改 annotation-sidebar-ui.js (只实现#createTextHighlightCard方法)
✅ 修改 annotation-manager.js (只实现createAnnotation的text-highlight分支)
```

#### 开发者C: 批注工具 (feature/annotation-comment)

**只修改以下文件**:
```
✅ 新增 components/comment-tool.js
✅ 新增 services/comment-renderer.js
✅ 修改 index.js (只修改#initializeTools和#commentTool部分)
✅ 修改 annotation-sidebar-ui.js (只实现#createCommentCard方法)
✅ 修改 annotation-manager.js (只实现createAnnotation的comment分支)
```

---

## 冲突解决策略

### 共享文件的修改规则

#### 1. index.js - #initializeTools方法

**冲突点**:
```javascript
async #initializeTools() {
  // <<<<<<< feature/annotation-screenshot
  this.#screenshotTool = new ScreenshotTool(...);
  // =======
  this.#textHighlightTool = new TextHighlightTool(...);
  // >>>>>>> feature/annotation-text-highlight
}
```

**解决方案**: 手动合并（简单，不会有逻辑冲突）
```javascript
async #initializeTools() {
  // 截图工具
  this.#screenshotTool = new ScreenshotTool(...);

  // 划词工具
  this.#textHighlightTool = new TextHighlightTool(...);

  // 批注工具
  this.#commentTool = new CommentTool(...);
}
```

#### 2. annotation-sidebar-ui.js - 卡片渲染方法

**冲突点**: 三个分支各自实现一个方法
```javascript
// 开发者A添加
#createScreenshotCard(annotation) { /* ... */ }

// 开发者B添加
#createTextHighlightCard(annotation) { /* ... */ }

// 开发者C添加
#createCommentCard(annotation) { /* ... */ }
```

**解决方案**: 自动合并（无冲突，三个方法互不影响）

#### 3. annotation-manager.js - createAnnotation方法

**冲突点**: switch语句不同分支
```javascript
async createAnnotation(annotationData) {
  const annotation = Annotation.createByType(annotationData);

  switch (annotation.type) {
    // <<<<<<< feature/annotation-screenshot
    case 'screenshot':
      // 截图特定逻辑
      break;
    // =======
    case 'text-highlight':
      // 划词特定逻辑
      break;
    // >>>>>>> feature/annotation-text-highlight
  }
}
```

**解决方案**: 手动合并（简单，合并三个case分支）

---

## 合并顺序和时机

### 推荐合并顺序

```
1. feature/annotation-base → main         (优先合并基础设施)
   ↓ 等待
2. feature/annotation-screenshot → main   (第一个功能)
   ↓ rebase
3. feature/annotation-text-highlight → main  (第二个功能，基于最新main)
   ↓ rebase
4. feature/annotation-comment → main         (第三个功能，基于最新main)
```

### 合并前的准备

**每个分支合并前必须**:
```bash
# 1. 拉取最新main
git checkout main
git pull origin main

# 2. rebase到最新main
git checkout feature/annotation-screenshot
git rebase main

# 3. 解决冲突
# ... 手动解决冲突 ...

# 4. 运行测试
npm run test

# 5. 提交PR
git push origin feature/annotation-screenshot
```

---

## 测试隔离策略

### 单元测试文件隔离

```
__tests__/
├── screenshot-tool.test.js        ← 开发者A
├── screenshot-capturer.test.js    ← 开发者A
├── text-highlight-tool.test.js    ← 开发者B
├── text-highlight-renderer.test.js ← 开发者B
├── comment-tool.test.js           ← 开发者C
└── comment-renderer.test.js       ← 开发者C
```

**优点**: 测试文件完全隔离，不会冲突

### E2E测试策略

**base分支预留测试钩子**:
```javascript
// __tests__/e2e/annotation-feature.test.js (base分支创建)

describe('Annotation Feature E2E', () => {
  describe('Screenshot Tool', () => {
    it.skip('should capture screenshot', () => {
      // TODO: feature/annotation-screenshot 实现
    });
  });

  describe('Text Highlight Tool', () => {
    it.skip('should highlight text', () => {
      // TODO: feature/annotation-text-highlight 实现
    });
  });

  describe('Comment Tool', () => {
    it.skip('should add comment', () => {
      // TODO: feature/annotation-comment 实现
    });
  });
});
```

**各分支去掉skip**:
```javascript
// feature/annotation-screenshot
it('should capture screenshot', () => {  // 去掉 .skip
  // 实现测试
});
```

---

## 代码审查Checklist

### 提交PR前自查

**开发者A (截图工具)**:
- [ ] 只修改了允许的文件
- [ ] 实现了ITool接口的所有方法
- [ ] #createScreenshotCard方法独立完成
- [ ] 没有修改其他工具的代码
- [ ] 单元测试覆盖率 > 80%
- [ ] 通过ESLint检查
- [ ] 通过npm run test

**开发者B (划词工具)**:
- [ ] 同上，但针对text-highlight

**开发者C (批注工具)**:
- [ ] 同上，但针对comment

---

## 沟通协调机制

### 每日同步会议（15分钟）

**讨论内容**:
1. 各自进度
2. 遇到的接口问题
3. 是否需要修改base接口
4. 合并顺序调整

### Slack/钉钉频道

**专用频道**: #annotation-feature-dev

**关键通知**:
- "我要修改AnnotationManager的XX方法签名"
- "我发现base接口有问题，建议改为..."
- "我的分支已ready for review"

---

## 风险缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| base接口设计不完善 | 🟡 中 | 第一周快速验证接口，及时调整 |
| 合并冲突复杂 | 🟡 中 | 严格遵循文件修改规则 |
| 三个功能依赖耦合 | 🟢 低 | ITool接口强制解耦 |
| 测试覆盖不足 | 🟡 中 | PR必须包含测试，Review严格检查 |
| 最后集成失败 | 🟡 中 | 每周在集成分支上合并一次，提前发现问题 |

---

## 时间线（7个工作日）

```
Day 1:
  - 完成feature/annotation-base
  - 三个分支从base拉出

Day 2-3:
  - 三个功能并行开发（核心逻辑）

Day 4:
  - 第一轮集成测试（临时集成分支）
  - 发现接口问题并修复

Day 5-6:
  - 继续开发（UI、测试）
  - 准备合并

Day 7:
  - 依次合并三个分支
  - 最终集成测试
  - 部署
```

---

## 总结

### 成功的关键

1. ✅ **接口优先设计** - 80%的工作在base分支完成
2. ✅ **文件隔离** - 新增文件不冲突，共享文件有明确规则
3. ✅ **测试隔离** - 每个分支独立测试文件
4. ✅ **频繁同步** - 每日站会，Slack沟通
5. ✅ **分批合并** - 不要三个分支同时合并

### 预期冲突处理时间

- **base分支合并**: 0冲突（新功能）
- **第一个分支合并**: 0-5分钟（简单冲突）
- **第二个分支合并**: 5-10分钟（switch语句合并）
- **第三个分支合并**: 5-10分钟（switch语句合并）

**总计**: < 30分钟解决所有冲突
