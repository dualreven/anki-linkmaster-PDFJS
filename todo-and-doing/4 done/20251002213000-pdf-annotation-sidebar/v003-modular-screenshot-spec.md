# PDF标注功能 - 截图工具实现规格（模块化架构版）

**功能ID**: 20251002213000-pdf-annotation-sidebar-screenshot-tool
**优先级**: 高
**版本**: v003 (模块化架构)
**创建时间**: 2025-10-03 03:30:00
**预计完成**: 2025-10-03
**状态**: 待开发

## 修订说明

本文档是v002的模块化架构升级版，主要变更：
1. **架构升级**：采用插件化架构，截图工具作为独立插件
2. **接口标准化**：实现IAnnotationTool接口
3. **并行开发**：完全独立的工具目录，零冲突
4. **可扩展性**：未来新增工具无需修改核心代码

## 总体架构

### 模块化设计

```
AnnotationFeature (容器)
  ├── ToolRegistry (工具注册表)
  │   └── ScreenshotTool (截图插件) ← 本规格实现范围
  ├── AnnotationManager (数据管理)
  └── AnnotationSidebarUI (UI管理)
```

### 目录结构

```
features/annotation/
├── index.js                              # AnnotationFeature容器
├── interfaces/
│   └── IAnnotationTool.js               # 工具接口定义
├── core/
│   ├── tool-registry.js                 # 工具注册表
│   ├── annotation-manager.js            # 数据管理（共享）
│   └── annotation-sidebar-ui.js         # UI管理（共享）
├── tools/                                # ✨工具插件目录
│   └── screenshot/                       # 截图工具（本规格实现）
│       ├── index.js                      # ScreenshotTool主类
│       ├── screenshot-capturer.js        # Canvas截图捕获器
│       ├── qwebchannel-bridge.js         # QWebChannel通信桥
│       └── __tests__/
│           ├── screenshot-tool.test.js
│           └── screenshot-capturer.test.js
├── models/
│   ├── annotation.js                     # 数据模型（共享）
│   └── comment.js
└── README.md
```

## 接口契约

### IAnnotationTool接口（必须实现）

```javascript
/**
 * 标注工具统一接口
 * 所有工具插件必须实现此接口
 * @interface
 */
export class IAnnotationTool {
  // ===== 元数据（只读属性）=====

  /** 工具唯一标识 @returns {string} */
  get name();

  /** 工具显示名称 @returns {string} */
  get displayName();

  /** 工具图标 @returns {string} */
  get icon();

  /** 工具版本 @returns {string} */
  get version();

  /** 工具依赖 @returns {string[]} */
  get dependencies();

  // ===== 生命周期方法 =====

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async initialize(context);

  /**
   * 激活工具（进入工具模式）
   * @returns {void}
   */
  activate();

  /**
   * 停用工具（退出工具模式）
   * @returns {void}
   */
  deactivate();

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive();

  // ===== UI方法 =====

  /**
   * 创建工具按钮（显示在侧边栏工具栏）
   * @returns {HTMLElement}
   */
  createToolButton();

  /**
   * 创建标注卡片（显示在标注列表）
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation);

  // ===== 清理方法 =====

  /**
   * 销毁工具，清理资源
   * @returns {void}
   */
  destroy();
}
```

### 截图工具具体实现要求

```javascript
/**
 * 截图工具实现规格
 */
export class ScreenshotTool extends IAnnotationTool {
  // ===== 元数据实现 =====
  get name() { return 'screenshot'; }
  get displayName() { return '截图'; }
  get icon() { return '📷'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['qwebchannel']; }

  // ===== 私有状态 =====
  #eventBus;              // 事件总线
  #logger;                // 日志器
  #pdfViewerManager;      // PDF管理器
  #qwebChannelBridge;     // QWebChannel桥接器
  #capturer;              // ScreenshotCapturer实例
  #isActive = false;      // 激活状态
  #selectionOverlay;      // 选择遮罩层DOM
  #startPos;              // 拖拽起点 {x, y}
  #endPos;                // 拖拽终点 {x, y}

  // ===== 生命周期实现（必须） =====
  async initialize(context) { /* ... */ }
  activate() { /* ... */ }
  deactivate() { /* ... */ }
  isActive() { /* ... */ }
  createToolButton() { /* ... */ }
  createAnnotationCard(annotation) { /* ... */ }
  destroy() { /* ... */ }

  // ===== 截图流程私有方法 =====
  #createSelectionOverlay()
  #setupMouseEvents()
  #handleMouseDown(e)
  #handleMouseMove(e)
  #handleMouseUp(e)
  #captureAndSave(rect)
  #saveImageToPyQt(base64Image)
  #showPreviewDialog(imageData)
  #cleanup()
}
```

## 数据结构

### 截图标注数据结构

```javascript
{
  id: 'ann_20251003_abc123',
  type: 'screenshot',
  pageNumber: 23,
  rect: {
    x: 100,
    y: 200,
    width: 300,
    height: 200
  },
  data: {
    imagePath: '/data/screenshots/a1b2c3d4e5f6.png',  // PyQt返回的路径
    imageHash: 'a1b2c3d4e5f6...',                     // MD5 hash
    description: '重要图表说明'                         // 用户输入
  },
  comments: [],
  createdAt: '2025-10-03T14:30:00.000Z',
  updatedAt: '2025-10-03T14:30:00.000Z'
}
```

### Annotation类工厂方法

```javascript
// models/annotation.js (已在base分支定义)

static createScreenshot(pageNumber, rect, imagePath, imageHash, description = '') {
  return new Annotation({
    type: AnnotationType.SCREENSHOT,
    pageNumber,
    data: { rect, imagePath, imageHash, description }
  });
}
```

## 完整流程设计

### 用户交互流程

```
1. 用户点击侧边栏"📷 截图"按钮
   ↓
2. ScreenshotTool.activate()被调用
   ↓ 创建选择遮罩层
   ↓ 鼠标变为十字光标
   ↓
3. 用户在PDF页面拖拽选择区域
   ↓ mousedown → 记录起点
   ↓ mousemove → 绘制矩形框（蓝色虚线）
   ↓ mouseup → 结束选择
   ↓
4. 捕获截图
   ↓ ScreenshotCapturer.capture(pageNumber, rect)
   ↓ 获取Canvas → 提取区域 → 生成base64
   ↓
5. 显示预览对话框
   ↓ 显示截图预览
   ↓ 提供描述输入框
   ↓ [保存] [取消] 按钮
   ↓
6. 用户点击保存
   ↓ 通过QWebChannelBridge发送到PyQt
   ↓ PyQt保存为 /data/screenshots/<hash>.png
   ↓ PyQt返回 {success: true, path: '...', hash: '...'}
   ↓
7. 创建标注数据
   ↓ Annotation.createScreenshot(...)
   ↓ eventBus.emit('annotation:create:requested', annotationData)
   ↓
8. AnnotationManager处理
   ↓ 添加ID、时间戳等元数据
   ↓ Mock保存到后端（第一期）
   ↓ eventBus.emit('annotation:create:success', { annotation })
   ↓
9. UI更新
   ↓ AnnotationSidebarUI接收事件
   ↓ 调用 ScreenshotTool.createAnnotationCard(annotation)
   ↓ 添加卡片到列表
   ↓ 通过HTTP加载图片显示缩略图
   ↓
10. 完成，退出截图模式
```

### 技术流程（数据传递）

```
Canvas截图 → base64
  ↓
QWebChannel → PyQt端
  ↓
PyQt保存文件 → /data/screenshots/<hash>.png
  ↓
PyQt返回 → {path, hash}
  ↓
创建Annotation对象
  ↓
EventBus事件 → 'annotation:create:requested'
  ↓
AnnotationManager → Mock保存（第一期）
  ↓
EventBus事件 → 'annotation:create:success'
  ↓
AnnotationSidebarUI → 添加卡片
  ↓
HTTP请求 → 加载图片
  ↓
显示在UI
```

## 详细实现规格

### 1. ScreenshotTool主类

**文件**: `tools/screenshot/index.js`

```javascript
/**
 * 截图工具插件
 * @implements {IAnnotationTool}
 */
import { IAnnotationTool } from '../../interfaces/IAnnotationTool.js';
import { ScreenshotCapturer } from './screenshot-capturer.js';
import { QWebChannelScreenshotBridge } from './qwebchannel-bridge.js';
import { getLogger } from '../../../../common/utils/logger.js';

export class ScreenshotTool extends IAnnotationTool {
  // ===== 元数据 =====
  get name() { return 'screenshot'; }
  get displayName() { return '截图'; }
  get icon() { return '📷'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['qwebchannel']; }

  // ===== 私有字段 =====
  #eventBus;
  #logger;
  #pdfViewerManager;
  #qwebChannelBridge;
  #capturer;
  #isActive = false;
  #selectionOverlay = null;
  #startPos = null;
  #endPos = null;

  /**
   * 初始化工具
   */
  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger || getLogger('ScreenshotTool');
    this.#pdfViewerManager = context.pdfViewerManager;

    // 初始化截图捕获器
    this.#capturer = new ScreenshotCapturer(this.#pdfViewerManager);

    // 初始化QWebChannel桥接器
    this.#qwebChannelBridge = new QWebChannelScreenshotBridge();

    this.#logger.info('[ScreenshotTool] Initialized');
  }

  /**
   * 激活截图模式
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn('[ScreenshotTool] Already active');
      return;
    }

    this.#isActive = true;

    // 1. 创建选择遮罩层
    this.#createSelectionOverlay();

    // 2. 设置鼠标事件
    this.#setupMouseEvents();

    // 3. 改变鼠标样式
    document.body.style.cursor = 'crosshair';

    // 4. 发布激活事件
    this.#eventBus.emit('annotation-tool:activate:success', {
      tool: this.name
    });

    this.#logger.info('[ScreenshotTool] Activated');
  }

  /**
   * 停用截图模式
   */
  deactivate() {
    if (!this.#isActive) return;

    this.#cleanup();
    this.#isActive = false;
    document.body.style.cursor = 'default';

    this.#eventBus.emit('annotation-tool:deactivate:success', {
      tool: this.name
    });

    this.#logger.info('[ScreenshotTool] Deactivated');
  }

  /**
   * 检查是否激活
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * 创建工具按钮
   */
  createToolButton() {
    const button = document.createElement('button');
    button.className = 'annotation-tool-btn screenshot-tool-btn';
    button.dataset.tool = this.name;
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;

    button.style.cssText = [
      'padding: 8px 12px',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'background: white',
      'cursor: pointer',
      'font-size: 13px',
      'transition: all 0.2s'
    ].join(';');

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f5f5f5';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
    });

    return button;
  }

  /**
   * 创建标注卡片
   */
  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card screenshot-card';
    card.dataset.annotationId = annotation.id;
    card.dataset.annotationType = annotation.type;

    const imageUrl = this.#getImageUrl(annotation.data.imagePath);

    card.innerHTML = `
      <div class="annotation-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="annotation-icon" style="font-size: 18px;">${this.icon}</span>
          <span class="annotation-type" style="font-weight: 600; color: #333;">${this.displayName}标注</span>
        </div>
        <button class="card-menu-btn" style="border: none; background: transparent; cursor: pointer; font-size: 16px;">⋮</button>
      </div>
      <div class="annotation-card-body" style="padding: 12px;">
        <img
          src="${imageUrl}"
          alt="截图"
          class="screenshot-thumbnail"
          style="max-width: 100%; border-radius: 4px; margin-bottom: 8px; display: block;"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22>加载失败</text></svg>'"
        >
        ${annotation.data.description ? `<p class="annotation-description" style="color: #666; font-size: 14px; margin: 8px 0;">${this.#escapeHtml(annotation.data.description)}</p>` : ''}
        <div class="annotation-meta" style="display: flex; gap: 12px; font-size: 12px; color: #999; margin-top: 8px;">
          <span>📄 P.${annotation.pageNumber}</span>
          <span>🕒 ${this.#formatDate(annotation.createdAt)}</span>
        </div>
      </div>
      <div class="annotation-card-footer" style="display: flex; gap: 8px; padding: 8px; border-top: 1px solid #eee;">
        <button class="jump-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #2196f3; background: white; color: #2196f3; border-radius: 4px; cursor: pointer;">→ 跳转</button>
        <button class="comment-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer;">💬 ${annotation.comments.length}条评论</button>
      </div>
    `;

    // 绑定事件
    card.querySelector('.jump-btn').addEventListener('click', () => {
      this.#handleJumpToAnnotation(annotation.id);
    });

    card.querySelector('.comment-btn').addEventListener('click', () => {
      this.#handleAddComment(annotation.id);
    });

    return card;
  }

  /**
   * 销毁工具
   */
  destroy() {
    this.deactivate();
    this.#capturer = null;
    this.#qwebChannelBridge = null;
    this.#logger.info('[ScreenshotTool] Destroyed');
  }

  // ===== 私有方法：截图流程 =====

  /**
   * 创建选择遮罩层
   * @private
   */
  #createSelectionOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-selection-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'z-index: 9999',
      'pointer-events: auto'
    ].join(';');

    // 选择矩形
    const rect = document.createElement('div');
    rect.className = 'selection-rect';
    rect.style.cssText = [
      'position: absolute',
      'border: 2px dashed #2196f3',
      'background: rgba(33, 150, 243, 0.1)',
      'display: none',
      'pointer-events: none'
    ].join(';');

    overlay.appendChild(rect);
    document.body.appendChild(overlay);
    this.#selectionOverlay = overlay;
  }

  /**
   * 设置鼠标事件监听
   * @private
   */
  #setupMouseEvents() {
    const overlay = this.#selectionOverlay;

    const onMouseDown = (e) => this.#handleMouseDown(e);
    const onMouseMove = (e) => this.#handleMouseMove(e);
    const onMouseUp = (e) => this.#handleMouseUp(e);
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && this.#isActive) {
        this.deactivate();
      }
    };

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);

    // 保存引用以便清理
    overlay._listeners = { onMouseDown, onMouseMove, onMouseUp, onKeyDown };
  }

  /**
   * 处理鼠标按下
   * @private
   */
  #handleMouseDown(e) {
    this.#startPos = { x: e.clientX, y: e.clientY };
    this.#endPos = null;

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    rect.style.display = 'block';
    rect.style.left = `${e.clientX}px`;
    rect.style.top = `${e.clientY}px`;
    rect.style.width = '0px';
    rect.style.height = '0px';
  }

  /**
   * 处理鼠标移动
   * @private
   */
  #handleMouseMove(e) {
    if (!this.#startPos) return;

    this.#endPos = { x: e.clientX, y: e.clientY };

    const rect = this.#selectionOverlay.querySelector('.selection-rect');
    const bounds = this.#getRectFromPoints(this.#startPos, this.#endPos);

    rect.style.left = `${bounds.x}px`;
    rect.style.top = `${bounds.y}px`;
    rect.style.width = `${bounds.width}px`;
    rect.style.height = `${bounds.height}px`;
  }

  /**
   * 处理鼠标释放
   * @private
   */
  async #handleMouseUp(e) {
    if (!this.#startPos) return;

    this.#endPos = { x: e.clientX, y: e.clientY };
    const rect = this.#getRectFromPoints(this.#startPos, this.#endPos);

    // 最小尺寸检查
    if (rect.width < 10 || rect.height < 10) {
      this.#logger.warn('[ScreenshotTool] Selection too small, ignoring');
      this.#cleanup();
      return;
    }

    // 捕获并保存截图
    await this.#captureAndSave(rect);

    // 清理
    this.#cleanup();
  }

  /**
   * 捕获截图并保存
   * @private
   */
  async #captureAndSave(rect) {
    try {
      const pageNumber = this.#getCurrentPageNumber();

      this.#logger.info(`[ScreenshotTool] Capturing screenshot at page ${pageNumber}`, rect);

      // 1. 使用Canvas捕获截图（base64）
      const base64Image = await this.#capturer.capture(pageNumber, rect);

      // 2. 显示预览对话框
      const description = await this.#showPreviewDialog(base64Image);
      if (description === null) {
        this.#logger.info('[ScreenshotTool] User cancelled');
        return;
      }

      // 3. 通过QWebChannel保存到PyQt
      const saveResult = await this.#saveImageToPyQt(base64Image);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save image');
      }

      this.#logger.info('[ScreenshotTool] Image saved', saveResult);

      // 4. 创建标注数据
      const annotationData = {
        type: this.name,
        pageNumber,
        rect,
        data: {
          imagePath: saveResult.path,
          imageHash: saveResult.hash,
          description
        }
      };

      // 5. 发布创建事件
      this.#eventBus.emit('annotation:create:requested', annotationData);

      this.#logger.info('[ScreenshotTool] Annotation created', annotationData);

    } catch (error) {
      this.#logger.error('[ScreenshotTool] Capture failed:', error);

      // 显示错误提示
      this.#eventBus.emit('notification:error', {
        message: '截图失败: ' + error.message
      });
    }
  }

  /**
   * 通过QWebChannel保存图片到PyQt
   * @private
   */
  async #saveImageToPyQt(base64Image) {
    return this.#qwebChannelBridge.saveScreenshot(base64Image);
  }

  /**
   * 显示预览对话框
   * @private
   */
  async #showPreviewDialog(imageData) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'screenshot-preview-dialog';
      dialog.style.cssText = [
        'position: fixed',
        'top: 50%',
        'left: 50%',
        'transform: translate(-50%, -50%)',
        'background: white',
        'border-radius: 8px',
        'box-shadow: 0 4px 20px rgba(0,0,0,0.3)',
        'padding: 20px',
        'z-index: 10000',
        'max-width: 600px',
        'max-height: 80vh',
        'overflow: auto'
      ].join(';');

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">截图预览</h3>
        <img src="${imageData}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; display: block;">
        <div style="margin-top: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
            标注描述（可选）:
          </label>
          <textarea
            id="screenshot-description"
            placeholder="为这个截图添加描述..."
            style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; box-sizing: border-box; font-family: inherit;"
          ></textarea>
        </div>
        <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
          <button id="screenshot-cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
          <button id="screenshot-save-btn" style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
        </div>
      `;

      document.body.appendChild(dialog);

      const textarea = dialog.querySelector('#screenshot-description');
      const saveBtn = dialog.querySelector('#screenshot-save-btn');
      const cancelBtn = dialog.querySelector('#screenshot-cancel-btn');

      textarea.focus();

      saveBtn.addEventListener('click', () => {
        const description = textarea.value.trim();
        dialog.remove();
        resolve(description);
      });

      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(null);
      });

      // ESC关闭
      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          dialog.remove();
          document.removeEventListener('keydown', onKeyDown);
          resolve(null);
        }
      };
      document.addEventListener('keydown', onKeyDown);
    });
  }

  // ===== 辅助方法 =====

  /**
   * 计算矩形区域
   * @private
   */
  #getRectFromPoints(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    return { x, y, width, height };
  }

  /**
   * 获取当前页码
   * @private
   */
  #getCurrentPageNumber() {
    return this.#pdfViewerManager?.getCurrentPageNumber() || 1;
  }

  /**
   * 获取图片URL
   * @private
   */
  #getImageUrl(imagePath) {
    const port = window.APP_CONFIG?.fileServerPort || 8080;
    return `http://localhost:${port}${imagePath}`;
  }

  /**
   * HTML转义
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 格式化日期
   * @private
   */
  #formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 跳转到标注
   * @private
   */
  #handleJumpToAnnotation(annotationId) {
    this.#eventBus.emit('annotation:jump:requested', { id: annotationId });
  }

  /**
   * 添加评论
   * @private
   */
  #handleAddComment(annotationId) {
    this.#eventBus.emit('annotation-comment:add:requested', { annotationId });
  }

  /**
   * 清理资源
   * @private
   */
  #cleanup() {
    if (this.#selectionOverlay) {
      // 移除事件监听
      const listeners = this.#selectionOverlay._listeners;
      if (listeners) {
        this.#selectionOverlay.removeEventListener('mousedown', listeners.onMouseDown);
        this.#selectionOverlay.removeEventListener('mousemove', listeners.onMouseMove);
        this.#selectionOverlay.removeEventListener('mouseup', listeners.onMouseUp);
        document.removeEventListener('keydown', listeners.onKeyDown);
      }

      // 移除DOM
      this.#selectionOverlay.remove();
      this.#selectionOverlay = null;
    }

    this.#startPos = null;
    this.#endPos = null;
  }
}
```

### 2. ScreenshotCapturer类

**文件**: `tools/screenshot/screenshot-capturer.js`

```javascript
/**
 * 截图捕获器
 * 使用Canvas API捕获PDF指定区域
 */
import { getLogger } from '../../../../common/utils/logger.js';

export class ScreenshotCapturer {
  #pdfViewerManager;
  #logger;

  constructor(pdfViewerManager) {
    this.#pdfViewerManager = pdfViewerManager;
    this.#logger = getLogger('ScreenshotCapturer');
  }

  /**
   * 捕获PDF指定区域的截图
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 { x, y, width, height }
   * @returns {Promise<string>} base64图片数据
   */
  async capture(pageNumber, rect) {
    try {
      // 1. 获取页面Canvas
      const canvas = this.#getPageCanvas(pageNumber);

      if (!canvas) {
        throw new Error(`Cannot find canvas for page ${pageNumber}`);
      }

      // 2. 提取指定区域
      const regionCanvas = this.#extractRegion(canvas, rect);

      // 3. 转换为base64
      const base64 = this.#toBase64(regionCanvas);

      this.#logger.info(`[Capturer] Captured ${rect.width}x${rect.height} at page ${pageNumber}`);

      return base64;

    } catch (error) {
      this.#logger.error('[Capturer] Capture failed:', error);
      throw error;
    }
  }

  /**
   * 获取PDF页面的Canvas元素
   * @private
   */
  #getPageCanvas(pageNumber) {
    // 尝试多种选择器
    const selectors = [
      `[data-page-number="${pageNumber}"] canvas`,
      `.page[data-page-number="${pageNumber}"] canvas`,
      `#page-${pageNumber} canvas`
    ];

    for (const selector of selectors) {
      const canvas = document.querySelector(selector);
      if (canvas) {
        return canvas;
      }
    }

    this.#logger.warn(`[Capturer] Canvas not found for page ${pageNumber}`);
    return null;
  }

  /**
   * 从完整Canvas中提取指定区域
   * @private
   */
  #extractRegion(sourceCanvas, rect) {
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = rect.width;
    regionCanvas.height = rect.height;

    const ctx = regionCanvas.getContext('2d');

    // 从源Canvas提取区域
    ctx.drawImage(
      sourceCanvas,
      rect.x, rect.y, rect.width, rect.height,  // 源区域
      0, 0, rect.width, rect.height             // 目标区域
    );

    return regionCanvas;
  }

  /**
   * 将Canvas转换为base64字符串
   * @private
   */
  #toBase64(canvas) {
    return canvas.toDataURL('image/png', 1.0);
  }
}
```

### 3. QWebChannelScreenshotBridge类

**文件**: `tools/screenshot/qwebchannel-bridge.js`

```javascript
/**
 * QWebChannel截图桥接器
 * 与PyQt端通信，保存截图
 */
import { getLogger } from '../../../../common/utils/logger.js';

export class QWebChannelScreenshotBridge {
  #pyqtObject = null;
  #isAvailable = false;
  #logger;

  constructor() {
    this.#logger = getLogger('QWebChannelBridge');
    this.#initialize();
  }

  /**
   * 初始化QWebChannel
   * @private
   */
  #initialize() {
    // 检查QWebChannel是否可用
    if (typeof qt === 'undefined' || !qt.webChannelTransport) {
      this.#logger.warn('[QWebChannel] Not available, using mock mode');
      this.#isAvailable = false;
      return;
    }

    try {
      // 连接到QWebChannel
      new QWebChannel(qt.webChannelTransport, (channel) => {
        this.#pyqtObject = channel.objects.screenshotHandler;
        this.#isAvailable = true;
        this.#logger.info('[QWebChannel] Connected to PyQt');
      });
    } catch (error) {
      this.#logger.error('[QWebChannel] Connection failed:', error);
      this.#isAvailable = false;
    }
  }

  /**
   * 保存截图到PyQt端
   * @param {string} base64Image - base64图片数据
   * @returns {Promise<{success: boolean, path: string, hash: string}>}
   */
  async saveScreenshot(base64Image) {
    if (!this.#isAvailable || !this.#pyqtObject) {
      // Mock模式（浏览器模式）
      return this.#mockSaveScreenshot(base64Image);
    }

    return new Promise((resolve, reject) => {
      try {
        // 调用PyQt方法
        this.#pyqtObject.saveScreenshot(base64Image, (result) => {
          if (result.success) {
            this.#logger.info('[QWebChannel] Screenshot saved:', result.path);
            resolve({
              success: true,
              path: result.path,
              hash: result.hash
            });
          } else {
            this.#logger.error('[QWebChannel] Save failed:', result.error);
            reject(new Error(result.error || 'Unknown error'));
          }
        });
      } catch (error) {
        this.#logger.error('[QWebChannel] Call failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Mock保存（浏览器模式）
   * @private
   */
  async #mockSaveScreenshot(base64Image) {
    this.#logger.info('[QWebChannel] Using mock save (browser mode)');

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200));

    // 生成mock数据
    const timestamp = Date.now();
    const mockHash = 'mock_' + Math.random().toString(36).substr(2, 9);

    return {
      success: true,
      path: `/data/screenshots/mock_${timestamp}.png`,
      hash: mockHash
    };
  }

  /**
   * 检查QWebChannel是否可用
   */
  isAvailable() {
    return this.#isAvailable;
  }
}
```

## PyQt端接口规范

### ScreenshotHandler类

**文件**: `src/backend/pyqt/screenshot_handler.py`

```python
import base64
import hashlib
from pathlib import Path
from PyQt5.QtCore import QObject, pyqtSlot

class ScreenshotHandler(QObject):
    """
    截图处理器
    通过QWebChannel暴露给JavaScript端
    """

    def __init__(self, config):
        super().__init__()
        self.config = config

    @pyqtSlot(str, 'QVariant')
    def saveScreenshot(self, base64_image: str, callback):
        """
        保存截图到本地文件系统

        Args:
            base64_image: base64编码的图片数据 (格式: data:image/png;base64,...)
            callback: JavaScript回调函数

        Returns (通过callback):
            {
                'success': True/False,
                'path': '/data/screenshots/<hash>.png',  # 相对路径
                'hash': '<hash>',                         # MD5 hash
                'error': '错误信息'  # 失败时
            }
        """
        try:
            # 1. 解码base64
            # 格式: "data:image/png;base64,iVBORw0KG..."
            if ',' in base64_image:
                image_data = base64.b64decode(base64_image.split(',')[1])
            else:
                image_data = base64.b64decode(base64_image)

            # 2. 计算MD5 hash
            hash_value = hashlib.md5(image_data).hexdigest()

            # 3. 确保screenshots目录存在
            data_dir = Path(self.config.get('data_dir', './data'))
            screenshot_dir = data_dir / 'screenshots'
            screenshot_dir.mkdir(parents=True, exist_ok=True)

            # 4. 生成文件名和路径
            filename = f"{hash_value}.png"
            filepath = screenshot_dir / filename

            # 5. 保存文件（如果不存在）
            if not filepath.exists():
                with open(filepath, 'wb') as f:
                    f.write(image_data)
                print(f"[ScreenshotHandler] Saved: {filepath}")
            else:
                print(f"[ScreenshotHandler] Already exists: {filepath}")

            # 6. 返回成功结果
            callback({
                'success': True,
                'path': f'/data/screenshots/{filename}',
                'hash': hash_value
            })

        except Exception as e:
            print(f"[ScreenshotHandler] Error: {e}")
            callback({
                'success': False,
                'error': str(e)
            })
```

### QWebChannel注册

**文件**: `src/backend/pyqt/main_window.py` (修改部分)

```python
from PyQt5.QtWebChannel import QWebChannel
from .screenshot_handler import ScreenshotHandler

class PDFViewerWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        # ... 其他初始化 ...

        # 创建截图处理器
        self.screenshot_handler = ScreenshotHandler(config={
            'data_dir': './data'
        })

        # 创建QWebChannel
        self.channel = QWebChannel()
        self.channel.registerObject('screenshotHandler', self.screenshot_handler)

        # 设置到WebEngineView
        self.web_view.page().setWebChannel(self.channel)
```

## 事件定义

### PDF-Viewer事件常量

**文件**: `src/frontend/common/event/pdf-viewer-constants.js` (已在base分支定义)

```javascript
ANNOTATION: {
  // 工具激活事件
  TOOL: {
    ACTIVATE: 'annotation-tool:activate:requested',
    DEACTIVATE: 'annotation-tool:deactivate:requested',
    ACTIVATED: 'annotation-tool:activate:success',
    DEACTIVATED: 'annotation-tool:deactivate:success',
  },

  // 标注CRUD事件
  CREATE: 'annotation:create:requested',
  CREATED: 'annotation:create:success',
  CREATE_FAILED: 'annotation:create:failed',

  // 标注交互事件
  JUMP_TO: 'annotation:jump:requested',

  // 评论事件
  COMMENT: {
    ADD: 'annotation-comment:add:requested',
  }
}
```

## 开发任务拆分

### Phase 0: 基础设施（feature/annotation-base）

**时间**: 2小时
**负责人**: 架构师/Tech Lead
**分支**: `feature/annotation-base`

- [ ] 定义IAnnotationTool接口
- [ ] 实现ToolRegistry类
- [ ] 实现AnnotationFeature骨架
- [ ] 实现AnnotationSidebarUI骨架
- [ ] 定义Annotation/Comment数据模型
- [ ] 定义所有事件常量
- [ ] 实现AnnotationManager基础结构
- [ ] 提交到main分支

### Phase 1: 截图工具开发（feature/annotation-tool-screenshot）

**时间**: 7小时
**负责人**: 你
**分支**: `feature/annotation-tool-screenshot`
**基于**: `feature/annotation-base`

#### 子任务1: ScreenshotCapturer实现（1小时）
- [ ] 创建`tools/screenshot/screenshot-capturer.js`
- [ ] 实现`capture()`方法
- [ ] 实现`#getPageCanvas()`方法
- [ ] 实现`#extractRegion()`方法
- [ ] 实现`#toBase64()`方法
- [ ] 编写单元测试
- [ ] 测试Canvas截图生成base64

#### 子任务2: QWebChannelBridge实现（1.5小时）
- [ ] 创建`tools/screenshot/qwebchannel-bridge.js`
- [ ] 实现`#initialize()`方法
- [ ] 实现`saveScreenshot()`方法
- [ ] 实现`#mockSaveScreenshot()`方法（浏览器模式）
- [ ] 实现`isAvailable()`方法
- [ ] 测试PyQt通信（需要PyQt端配合）
- [ ] 测试浏览器mock模式

#### 子任务3: ScreenshotTool核心实现（2小时）
- [ ] 创建`tools/screenshot/index.js`
- [ ] 实现IAnnotationTool接口所有方法
- [ ] 实现`activate()`/`deactivate()`
- [ ] 实现`#createSelectionOverlay()`
- [ ] 实现`#setupMouseEvents()`
- [ ] 实现鼠标拖拽逻辑（down/move/up）
- [ ] 实现ESC取消功能

#### 子任务4: 截图流程实现（1.5小时）
- [ ] 实现`#captureAndSave()`方法
- [ ] 实现`#showPreviewDialog()`方法
- [ ] 实现`#saveImageToPyQt()`方法
- [ ] 完善错误处理
- [ ] 测试完整截图流程

#### 子任务5: UI组件实现（0.5小时）
- [ ] 实现`createToolButton()`方法
- [ ] 实现`createAnnotationCard()`方法
- [ ] 实现卡片事件绑定（跳转、评论）
- [ ] 测试UI显示

#### 子任务6: 测试和集成（0.5小时）
- [ ] 编写单元测试
- [ ] 端到端测试
- [ ] 修复bug
- [ ] 代码review自查
- [ ] 准备PR

#### 子任务7: PyQt端实现（协作，不阻塞）
- [ ] 实现`ScreenshotHandler`类
- [ ] 注册到QWebChannel
- [ ] 测试通信
- [ ] 处理错误

### Phase 2: 合并和验收（0.5小时）

- [ ] 提交PR: `feature/annotation-tool-screenshot` → `main`
- [ ] Code Review
- [ ] 解决合并冲突（预计< 1分钟）
- [ ] 合并到main
- [ ] 验收测试

## 验收标准

### 功能测试

1. ✅ **工具激活**
   - 点击"📷 截图"按钮
   - 鼠标变为十字光标
   - 其他工具按钮禁用

2. ✅ **区域选择**
   - 拖拽鼠标绘制矩形
   - 蓝色虚线边框
   - 半透明填充

3. ✅ **预览对话框**
   - 显示截图预览
   - 提供描述输入框
   - 保存/取消按钮

4. ✅ **QWebChannel通信**
   - base64发送到PyQt
   - PyQt保存文件到`/data/screenshots/<hash>.png`
   - 返回路径和hash

5. ✅ **标注创建**
   - 发布`annotation:create:requested`事件
   - AnnotationManager mock保存
   - 发布`annotation:create:success`事件

6. ✅ **UI更新**
   - 标注卡片显示在侧边栏
   - 截图缩略图通过HTTP加载
   - 页码、时间、描述显示正确

7. ✅ **交互功能**
   - 跳转按钮触发事件
   - 评论按钮触发事件

8. ✅ **ESC取消**
   - 按ESC退出截图模式
   - 清理遮罩层
   - 鼠标恢复默认

### 浏览器模式兼容

1. ✅ 无QWebChannel时使用mock
2. ✅ mock返回模拟路径
3. ✅ UI功能正常

### 性能要求

- ✅ 截图生成base64 < 500ms
- ✅ QWebChannel通信往返 < 200ms
- ✅ UI响应流畅，无卡顿

### 代码质量

- ✅ 通过ESLint检查
- ✅ 单元测试覆盖率 > 80%
- ✅ 所有方法有JSDoc注释
- ✅ 错误处理完善

## 风险和缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Canvas截图失败 | 🟡 中 | 多种选择器兼容，错误提示 |
| QWebChannel通信失败 | 🟡 中 | Mock模式降级，错误处理 |
| PyQt保存失败 | 🟡 中 | 返回错误信息，用户提示 |
| 图片路径冲突 | 🟢 低 | MD5 hash去重 |
| HTTP加载图片失败 | 🟡 中 | onerror占位图 |

## 相关文档

- [v001原始规格](./v001-spec.md) - 完整功能设计
- [v002第一期实现](./v002-phase1-screenshot-spec.md) - QWebChannel方案
- [模块化架构设计](./modular-architecture.md) - 插件化架构
- [并行开发策略](./parallel-development-strategy.md) - 多人协作
- [IAnnotationTool接口](../../src/frontend/pdf-viewer/features/annotation/interfaces/IAnnotationTool.js) - 工具接口

## 后续计划

### 第二期（其他工具）

- TextHighlightTool（划词）- 开发者B
- CommentTool（批注）- 开发者C

### 第三期（后端持久化）

- 真实WebSocket通信
- 数据库存储
- 历史标注加载

## 修订历史

- v003 (2025-10-03): 模块化架构版本，采用插件化设计
- v002 (2025-10-03): 第一期实现，QWebChannel + Mock
- v001 (2025-10-02): 初始设计，完整功能规划
