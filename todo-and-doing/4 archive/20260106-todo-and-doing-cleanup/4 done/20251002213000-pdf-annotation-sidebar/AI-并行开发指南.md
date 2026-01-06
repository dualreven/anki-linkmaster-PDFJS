# AI 并行开发指南 - PDF标注功能

**创建时间**: 2025-10-03 18:30
**适用对象**: AI开发者B、AI开发者C
**前置条件**: Phase 0基础设施已完成 ✅

---

## 一、架构总览

### 已完成的基础设施 (Phase 0)

```
AnnotationFeature v2.0 (容器/协调器) ✅ 已完成
  ├── ToolRegistry (工具注册表) ✅ 已完成
  ├── AnnotationManager (数据管理器) ✅ 已完成
  └── AnnotationSidebarUI (UI管理器) ✅ 已完成
```

**你只需要**：实现一个工具插件，遵循IAnnotationTool接口规范即可！

---

## 二、并行开发任务分工

| 工具 | 负责人 | 目录 | 预计时间 | 状态 |
|------|-------|------|---------|------|
| **ScreenshotTool** | AI-A | `tools/screenshot/` | 7小时 | 待开始 |
| **TextHighlightTool** | AI-B | `tools/text-highlight/` | 3小时 | 待开始 |
| **CommentTool** | AI-C | `tools/comment/` | 3小时 | 待开始 |

**重要**: 三个工具**完全独立**，可以同时开发，互不影响！

---

## 三、如何开发一个工具插件

### 步骤1：阅读接口规范

**必读文件**: `src/frontend/pdf-viewer/features/annotation/interfaces/IAnnotationTool.js`

**11个必须实现的方法**:

```javascript
export class YourTool extends IAnnotationTool {
  // === 元数据 (getter方法) ===
  get name() { return 'your-tool'; }
  get displayName() { return '你的工具'; }
  get icon() { return '🔧'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  // === 生命周期 ===
  async initialize(context) { /* 保存eventBus、logger等 */ }
  activate() { /* 激活工具，创建UI */ }
  deactivate() { /* 停用工具，清理UI */ }
  isActive() { return this.#isActive; }

  // === UI ===
  createToolButton() { return buttonElement; }
  createAnnotationCard(annotation) { return cardElement; }

  // === 清理 ===
  destroy() { /* 销毁工具，释放资源 */ }
}
```

### 步骤2：创建目录结构

**以TextHighlightTool为例**:

```bash
mkdir -p src/frontend/pdf-viewer/features/annotation/tools/text-highlight
cd src/frontend/pdf-viewer/features/annotation/tools/text-highlight

# 创建必需文件
touch index.js              # 主类：TextHighlightTool
touch text-selector.js      # 文本选择器
touch highlight-renderer.js # 高亮渲染器
touch __tests__/            # 测试目录
```

### 步骤3：实现工具主类

**模板代码** (`tools/text-highlight/index.js`):

```javascript
/**
 * TextHighlightTool - 文字高亮工具
 */
import { getLogger } from '../../../../../common/utils/logger.js';
import { IAnnotationTool } from '../../interfaces/IAnnotationTool.js';
import { Annotation, AnnotationType } from '../../models/annotation.js';

export class TextHighlightTool extends IAnnotationTool {
  // 私有字段
  #eventBus;
  #logger;
  #pdfViewerManager;
  #isActive = false;

  // === 元数据 ===
  get name() { return 'text-highlight'; }
  get displayName() { return '选字高亮'; }
  get icon() { return '✏️'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  // === 生命周期 ===
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager } = context;
    this.#eventBus = eventBus;
    this.#logger = logger || getLogger('TextHighlightTool');
    this.#pdfViewerManager = pdfViewerManager;

    // 监听工具激活事件
    this.#eventBus.on('annotation-tool:activate:requested', (data) => {
      if (data.tool === this.name) {
        this.activate();
      }
    }, { subscriberId: 'TextHighlightTool' });

    this.#logger.info('[TextHighlightTool] Initialized');
  }

  activate() {
    this.#isActive = true;
    // TODO: 改变鼠标样式，启用文本选择
    this.#logger.info('[TextHighlightTool] Activated');
    this.#eventBus.emit('annotation-tool:activate:success', { tool: this.name });
  }

  deactivate() {
    this.#isActive = false;
    // TODO: 恢复鼠标样式，禁用文本选择
    this.#logger.info('[TextHighlightTool] Deactivated');
    this.#eventBus.emit('annotation-tool:deactivate:success', { tool: this.name });
  }

  isActive() {
    return this.#isActive;
  }

  // === UI ===
  createToolButton() {
    const button = document.createElement('button');
    button.textContent = `${this.icon} ${this.displayName}`;
    button.addEventListener('click', () => {
      this.#eventBus.emit('annotation-tool:activate:requested', { tool: this.name });
    });
    return button;
  }

  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card text-highlight-card';
    card.innerHTML = `
      <div class="card-header">
        <span>${this.icon} 页${annotation.pageNumber}</span>
        <span>${annotation.getFormattedDate()}</span>
      </div>
      <div class="card-content">
        <p>${annotation.data.selectedText}</p>
      </div>
    `;
    return card;
  }

  // === 清理 ===
  destroy() {
    if (this.isActive()) {
      this.deactivate();
    }
    this.#eventBus = null;
    this.#logger = null;
  }
}
```

### 步骤4：注册工具到AnnotationFeature

**修改文件**: `src/frontend/pdf-viewer/features/annotation/index.js`

找到 `#registerTools()` 方法，取消注释并添加你的工具：

```javascript
async #registerTools() {
  this.#logger.info('[AnnotationFeature] Registering tools...');

  // Phase 1: 截图工具
  // const { ScreenshotTool } = await import('./tools/screenshot/index.js');
  // this.#toolRegistry.register(new ScreenshotTool());

  // Phase 2: 文字高亮工具 ← AI-B添加这里
  const { TextHighlightTool } = await import('./tools/text-highlight/index.js');
  this.#toolRegistry.register(new TextHighlightTool());

  // Phase 3: 批注工具 ← AI-C添加这里
  // const { CommentTool } = await import('./tools/comment/index.js');
  // this.#toolRegistry.register(new CommentTool());

  this.#logger.info(`[AnnotationFeature] ${this.#toolRegistry.getCount()} tools registered`);
}
```

---

## 四、核心通信机制 🔑

### 如何与外层通信？

**答案**: 通过**EventBus**发布事件！

### 创建标注流程

```javascript
// 步骤1: 用户完成高亮选择
const annotation = Annotation.createTextHighlight(
  pageNumber,
  selectedText,
  textRanges,
  highlightColor,
  note
);

// 步骤2: 发布创建请求事件
this.#eventBus.emit('annotation:create:requested', {
  annotation: annotation
});

// 步骤3: AnnotationManager会自动处理
// 步骤4: AnnotationManager发布成功事件
// 步骤5: AnnotationFeature自动更新UI
// 你不需要做任何事！✅
```

### 重要事件列表

**你可以发布的事件**:
```javascript
// 创建标注
'annotation:create:requested'

// 更新标注
'annotation:update:requested'

// 删除标注
'annotation:delete:requested'

// 工具激活/停用
'annotation-tool:activate:success'
'annotation-tool:deactivate:success'
```

**你可以监听的事件**:
```javascript
// 工具激活请求
'annotation-tool:activate:requested'

// 标注创建成功
'annotation:create:success'

// 标注删除成功
'annotation:delete:success'
```

---

## 五、Git工作流程

### 分支策略

**每个工具一个独立分支**:

```bash
# AI-A (截图工具)
git checkout -b feature/annotation-tool-screenshot

# AI-B (文字高亮)
git checkout -b feature/annotation-tool-text-highlight

# AI-C (批注工具)
git checkout -b feature/annotation-tool-comment
```

### 开发流程

1. **从main分支创建新分支**
   ```bash
   git checkout main
   git pull
   git checkout -b feature/annotation-tool-YOUR-TOOL
   ```

2. **开发你的工具**
   - 只修改 `tools/YOUR-TOOL/` 目录下的文件
   - 只修改 `index.js` 中的一行（注册工具）

3. **提交代码**
   ```bash
   git add src/frontend/pdf-viewer/features/annotation/tools/YOUR-TOOL/
   git add src/frontend/pdf-viewer/features/annotation/index.js
   git commit -m "feat(annotation): 实现YOUR-TOOL工具"
   ```

4. **合并到main**
   ```bash
   git checkout main
   git merge feature/annotation-tool-YOUR-TOOL
   # 几乎零冲突！✅
   ```

### 唯一的合并冲突点

**文件**: `index.js` 的 `#registerTools()` 方法

**冲突内容**:
```javascript
<<<<<<< HEAD
const { ScreenshotTool } = await import('./tools/screenshot/index.js');
this.#toolRegistry.register(new ScreenshotTool());
=======
const { TextHighlightTool } = await import('./tools/text-highlight/index.js');
this.#toolRegistry.register(new TextHighlightTool());
>>>>>>> feature/annotation-tool-text-highlight
```

**解决方法**:
```javascript
// 保留所有工具的注册
const { ScreenshotTool } = await import('./tools/screenshot/index.js');
this.#toolRegistry.register(new ScreenshotTool());

const { TextHighlightTool } = await import('./tools/text-highlight/index.js');
this.#toolRegistry.register(new TextHighlightTool());
```

**冲突解决时间**: < 1分钟 ✅

---

## 六、测试和验证

### 单元测试

**创建测试文件**: `tools/YOUR-TOOL/__tests__/your-tool.test.js`

```javascript
import { TextHighlightTool } from '../index.js';
import { validateAnnotationTool } from '../../../interfaces/IAnnotationTool.js';

describe('TextHighlightTool', () => {
  test('implements IAnnotationTool interface', () => {
    const tool = new TextHighlightTool();
    expect(() => validateAnnotationTool(tool)).not.toThrow();
  });

  test('has correct metadata', () => {
    const tool = new TextHighlightTool();
    expect(tool.name).toBe('text-highlight');
    expect(tool.displayName).toBe('选字高亮');
    expect(tool.icon).toBe('✏️');
  });
});
```

### 集成测试

1. 启动项目：`python ai_launcher.py start --module pdf-viewer --pdf-id test`
2. 打开开发者工具 (F12)
3. 检查日志：看到工具注册成功
4. 点击工具按钮：测试激活/停用
5. 创建标注：测试完整流程

---

## 七、常见问题

### Q1: 如何获取当前PDF页面信息？

```javascript
// 通过pdfViewerManager获取
const currentPage = this.#pdfViewerManager.getCurrentPage();
const totalPages = this.#pdfViewerManager.getTotalPages();
```

### Q2: 如何获取用户选择的文本？

```javascript
const selectedText = window.getSelection().toString();
```

### Q3: 如何在PDF上绘制高亮？

参考ScreenshotTool的Canvas操作方式，或创建DOM overlay。

### Q4: 数据存储在哪里？

Phase 1使用Mock模式（内存），数据不持久化。Phase 2会实现真实后端。

---

## 八、参考资料

### 必读文档
1. **接口规范**: `interfaces/IAnnotationTool.js`
2. **截图工具规范**: `v003-modular-screenshot-spec.md`
3. **并行开发策略**: `parallel-development-strategy.md`
4. **模块化架构**: `modular-architecture.md`

### 参考实现
- **ScreenshotTool**: `tools/screenshot/` (AI-A实现后可参考)

### 数据模型
- **Annotation**: `models/annotation.js`
- **Comment**: `models/comment.js`

---

## 九、协作建议

### 沟通渠道
- 在各自的分支工作，避免干扰
- 通过Memory Bank了解其他人进度
- 遇到问题查阅测试说明文档

### 开发顺序建议
1. **先实现ScreenshotTool** (最复杂，可为其他工具提供参考)
2. **再实现TextHighlightTool** (中等复杂度)
3. **最后实现CommentTool** (最简单)

### 质量标准
- ✅ 通过IAnnotationTool接口验证
- ✅ 有单元测试
- ✅ 有完整的JSDoc注释
- ✅ 通过ESLint检查

---

**祝开发顺利！有任何问题请查阅相关文档或在Memory Bank留言。**

**作者**: AI Assistant (Phase 0完成者)
**版本**: 1.0
**最后更新**: 2025-10-03 18:30
