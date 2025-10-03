# PDF Viewer 标注栏功能规格说明（第一期）

**功能ID**: 20251002213000-pdf-annotation-sidebar
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-02 21:54:33
**预计完成**: 2025-10-05
**状态**: 设计中

## 现状说明

### 当前系统状态
- PDF Viewer已实现Feature-based插件化架构
- 已有侧边栏实现参考：BookmarkManager和BookmarkSidebarUI
- UI管理层已集成多种控件（缩放、导航、书签）
- WebSocket通信已建立，可与后端交互保存数据
- Text Layer已启用，支持文本选择

### 已有功能基础
1. **BookmarkSidebarUI**: 可参考的侧边栏实现，包含header、列表、交互
2. **EventBus事件总线**: 完整的事件驱动架构
3. **PDFViewerManager**: 支持页面导航、文本选择
4. **WebSocket**: 支持数据持久化到后端
5. **依赖注入容器**: SimpleDependencyContainer管理Feature依赖

### 技术栈
- PDF.js 4.7.76 (支持文本选择、页面渲染)
- HTML Canvas API (用于截图标注)
- EventBus事件系统
- Feature插件架构
- WebSocket (数据持久化)

## 存在问题

### 用户痛点
1. **无法做笔记**: 阅读PDF时无法记录重要内容和想法
2. **无法标记重点**: 重要段落、图表无法高亮或标注
3. **缺少协作功能**: 无法在PDF上添加批注和评论
4. **回顾困难**: 没有集中的地方查看所有标注和笔记

### 技术限制
1. **没有标注UI**: 缺少标注工具栏和标注侧边栏
2. **没有标注数据模型**: 缺少标注的数据结构和管理
3. **没有截图功能**: 无法截取PDF区域
4. **没有持久化机制**: 标注数据无法保存

## 提出需求

### 核心功能需求（第一期）

#### 1. 标注侧边栏UI

**侧边栏布局**
```
┌─────────────────────────────┐
│  Header                     │
│  ┌────────────────────┐    │
│  │ 标注工具栏          │    │
│  │ [📷截图][✏️选字][📝批注] [✕]│
│  └────────────────────┘    │
├─────────────────────────────┤
│  标注列表                    │
│  ┌───────────────────┐     │
│  │ 📷 截图标注         │ [→] │
│  │ 页码: P.23         │     │
│  │ 时间: 2025-10-02   │     │
│  │ 💬 2条评论         │     │
│  └───────────────────┘     │
│  ┌───────────────────┐     │
│  │ ✏️ "重要文本..."    │ [→] │
│  │ 页码: P.45         │     │
│  │ 时间: 2025-10-02   │     │
│  │ 💬 添加评论        │     │
│  └───────────────────┘     │
│  ...                       │
└─────────────────────────────┘
```

**Header部分**
- **标注工具栏**:
  - 📷 截图标注按钮
  - ✏️ 选字标注按钮
  - 📝 批注标注按钮
- **关闭按钮**: ✕ 关闭标注侧边栏

**标注列表区域**
- 显示所有标注卡片
- 每个卡片包含：
  - 标注类型图标
  - 标注内容预览
  - 页码信息
  - 创建时间
  - 评论数量
  - 跳转按钮 [→]
  - 评论按钮 💬

#### 2. 三种标注类型

##### 2.1 截图标注 (Screenshot Annotation)
**用户流程**:
1. 点击📷按钮进入截图模式
2. 鼠标变为十字光标
3. 在PDF页面上拖拽选择区域
4. 释放鼠标后显示预览和输入框
5. 输入标注描述（可选）
6. 点击"保存"创建标注

**数据结构**:
```javascript
{
  id: 'ann_001',
  type: 'screenshot',
  pageNumber: 23,
  rect: { x: 100, y: 200, width: 300, height: 200 },
  imageData: 'data:image/png;base64,...',  // base64图片
  description: '这是一个重要的图表',
  comments: [],
  createdAt: '2025-10-02T14:30:00Z',
  updatedAt: '2025-10-02T14:30:00Z'
}
```

##### 2.2 选字标注 (Text Highlight Annotation)
**用户流程**:
1. 点击✏️按钮进入选字模式
2. 在PDF上选择文本（使用浏览器原生文本选择）
3. 选择完毕后显示高亮颜色选择器
4. 选择高亮颜色（黄色、绿色、蓝色、粉色）
5. 输入标注笔记（可选）
6. 点击"保存"创建标注

**数据结构**:
```javascript
{
  id: 'ann_002',
  type: 'text-highlight',
  pageNumber: 45,
  selectedText: '这是被选中的文本内容...',
  textRanges: [
    { start: 120, end: 180 }  // 文本层的字符索引
  ],
  highlightColor: '#ffff00',  // 高亮颜色
  note: '这段话很重要',
  comments: [],
  createdAt: '2025-10-02T15:00:00Z',
  updatedAt: '2025-10-02T15:00:00Z'
}
```

##### 2.3 批注标注 (Comment Annotation)
**用户流程**:
1. 点击📝按钮进入批注模式
2. 在PDF页面上点击任意位置
3. 显示批注输入框（浮动在点击位置）
4. 输入批注内容（必填）
5. 点击"保存"创建标注，显示批注图标📌

**数据结构**:
```javascript
{
  id: 'ann_003',
  type: 'comment',
  pageNumber: 67,
  position: { x: 150, y: 300 },  // 批注图标位置
  content: '这里需要进一步研究',
  comments: [],  // 可以添加回复
  createdAt: '2025-10-02T16:00:00Z',
  updatedAt: '2025-10-02T16:00:00Z'
}
```

#### 3. 标注交互功能

##### 3.1 跳转到标注位置
- 点击标注卡片的跳转按钮 [→]
- 自动跳转到标注所在页码
- 高亮显示该标注（闪烁或边框）

##### 3.2 添加评论
- 点击标注卡片的"添加评论"或💬按钮
- 展开评论输入区域
- 输入纯文字评论
- 保存后显示在标注卡片下方
- 评论支持多条，显示评论列表

**评论数据结构**:
```javascript
{
  id: 'comment_001',
  annotationId: 'ann_002',
  content: '补充：这段话在第三章也提到了',
  createdAt: '2025-10-02T17:00:00Z'
}
```

##### 3.3 编辑和删除标注
- 标注卡片右上角显示"..."菜单
- 菜单选项：编辑、删除
- 编辑：打开对话框修改标注内容
- 删除：显示确认对话框，确认后删除

#### 4. 工具栏状态管理
- **普通模式**: 所有工具按钮可点击，默认状态
- **截图模式**: 📷按钮高亮，鼠标变为十字，其他按钮禁用
- **选字模式**: ✏️按钮高亮，可选择文本，其他按钮禁用
- **批注模式**: 📝按钮高亮，可点击页面，其他按钮禁用
- **ESC取消**: 任何模式下按ESC返回普通模式

### 性能要求
- **标注加载时间**: < 1秒（100个标注）
- **截图响应时间**: < 500ms（生成base64图片）
- **侧边栏滚动**: 流畅无卡顿（虚拟滚动，支持1000+标注）
- **数据持久化**: 标注变更后2秒内自动保存到后端

### 用户体验要求
- 侧边栏宽度300-400px，可调节
- 标注工具按钮清晰易懂，使用图标+文字
- 标注列表按创建时间倒序排列（最新的在上）
- 标注卡片设计清晰，类型易区分
- 支持键盘快捷键（Ctrl+Shift+A打开标注栏）

### 数据持久化要求
- 标注数据保存到后端（通过WebSocket）
- 支持按PDF文件路径关联标注
- 重新打开PDF时自动加载标注
- 标注变更实时保存（debounce 2秒）

## 解决方案

### 技术架构

#### Feature设计
```javascript
{
  name: 'annotation',
  version: '1.0.0',
  dependencies: ['app-core', 'pdf-manager', 'ui-manager'],
  description: 'PDF标注功能，支持截图、选字高亮、批注和评论'
}
```

#### 目录结构
```
features/annotation/
├── index.js                          # AnnotationFeature入口
├── components/
│   ├── annotation-sidebar-ui.js     # 标注侧边栏UI
│   ├── annotation-toolbar.js        # 标注工具栏
│   ├── annotation-card.js           # 标注卡片组件
│   ├── screenshot-tool.js           # 截图工具
│   ├── text-highlight-tool.js       # 选字高亮工具
│   ├── comment-tool.js              # 批注工具
│   └── comment-input.js             # 评论输入组件
├── services/
│   ├── annotation-manager.js        # 标注管理器（核心逻辑）
│   ├── annotation-renderer.js       # 标注渲染器（在PDF上显示）
│   ├── annotation-storage.js        # 标注存储（WebSocket通信）
│   └── screenshot-capturer.js       # 截图捕获器（Canvas API）
├── models/
│   ├── annotation.js                # 标注数据模型
│   └── comment.js                   # 评论数据模型
├── __tests__/
│   ├── annotation-feature.test.js
│   ├── annotation-manager.test.js
│   ├── screenshot-tool.test.js
│   ├── text-highlight-tool.test.js
│   └── comment-tool.test.js
└── README.md
```

### 事件接口设计

```javascript
// src/frontend/common/event/pdf-viewer-constants.js

ANNOTATION: {
  // 侧边栏控制事件
  SIDEBAR_OPEN: 'pdf-viewer:annotation:sidebar:open',          // 打开侧边栏
  SIDEBAR_CLOSE: 'pdf-viewer:annotation:sidebar:close',        // 关闭侧边栏
  SIDEBAR_TOGGLE: 'pdf-viewer:annotation:sidebar:toggle',      // 切换侧边栏

  // 工具模式切换事件
  TOOL_ACTIVATE: 'pdf-viewer:annotation:tool:activate',        // 激活工具 data: { tool: 'screenshot'|'text-highlight'|'comment' }
  TOOL_DEACTIVATE: 'pdf-viewer:annotation:tool:deactivate',    // 停用工具 data: {}

  // 标注CRUD事件
  CREATE: 'pdf-viewer:annotation:create',                      // 创建标注 data: { annotation }
  CREATED: 'pdf-viewer:annotation:created',                    // 标注已创建 data: { annotation }
  UPDATE: 'pdf-viewer:annotation:update',                      // 更新标注 data: { id, changes }
  UPDATED: 'pdf-viewer:annotation:updated',                    // 标注已更新 data: { annotation }
  DELETE: 'pdf-viewer:annotation:delete',                      // 删除标注 data: { id }
  DELETED: 'pdf-viewer:annotation:deleted',                    // 标注已删除 data: { id }

  // 标注交互事件
  SELECT: 'pdf-viewer:annotation:select',                      // 选中标注 data: { id }
  JUMP_TO: 'pdf-viewer:annotation:jump-to',                    // 跳转到标注位置 data: { id }
  HIGHLIGHT: 'pdf-viewer:annotation:highlight',                // 高亮标注 data: { id }

  // 评论事件
  COMMENT_ADD: 'pdf-viewer:annotation:comment:add',            // 添加评论 data: { annotationId, content }
  COMMENT_ADDED: 'pdf-viewer:annotation:comment:added',        // 评论已添加 data: { comment }
  COMMENT_DELETE: 'pdf-viewer:annotation:comment:delete',      // 删除评论 data: { commentId }
  COMMENT_DELETED: 'pdf-viewer:annotation:comment:deleted',    // 评论已删除 data: { commentId }

  // 数据加载事件
  LOAD: 'pdf-viewer:annotation:load',                          // 加载标注 data: { pdfPath }
  LOADED: 'pdf-viewer:annotation:loaded',                      // 标注已加载 data: { annotations }
  SAVE: 'pdf-viewer:annotation:save',                          // 保存标注 data: { annotations }
  SAVED: 'pdf-viewer:annotation:saved',                        // 标注已保存 data: {}

  // 截图工具事件
  SCREENSHOT_START: 'pdf-viewer:annotation:screenshot:start',  // 开始截图 data: {}
  SCREENSHOT_AREA_SELECTED: 'pdf-viewer:annotation:screenshot:area-selected', // 区域已选择 data: { rect }
  SCREENSHOT_CAPTURED: 'pdf-viewer:annotation:screenshot:captured', // 截图已捕获 data: { imageData }
  SCREENSHOT_CANCEL: 'pdf-viewer:annotation:screenshot:cancel', // 取消截图 data: {}

  // 选字高亮事件
  TEXT_SELECTION_START: 'pdf-viewer:annotation:text:selection:start',  // 开始选字 data: {}
  TEXT_SELECTED: 'pdf-viewer:annotation:text:selected',        // 文本已选择 data: { text, ranges }
  HIGHLIGHT_APPLIED: 'pdf-viewer:annotation:highlight:applied', // 高亮已应用 data: { annotation }

  // 批注工具事件
  COMMENT_TOOL_ACTIVE: 'pdf-viewer:annotation:comment-tool:active', // 批注工具激活
  COMMENT_POSITION_SELECTED: 'pdf-viewer:annotation:comment:position:selected', // 位置已选择 data: { x, y, pageNumber }
}
```

### 核心类设计

#### AnnotationManager类
```javascript
/**
 * 标注管理器 - 核心业务逻辑
 */
class AnnotationManager {
  #eventBus
  #annotations        // Map<id, Annotation>
  #currentPdfPath
  #storage           // AnnotationStorage
  #renderer          // AnnotationRenderer
  #autoSaveTimer

  constructor(eventBus, storage, renderer)

  // 核心方法
  initialize(pdfPath)                           // 初始化并加载标注
  createAnnotation(annotationData)              // 创建标注
  updateAnnotation(id, changes)                 // 更新标注
  deleteAnnotation(id)                          // 删除标注
  getAnnotation(id)                             // 获取标注
  getAnnotationsByPage(pageNumber)              // 获取指定页的标注
  getAllAnnotations()                           // 获取所有标注

  // 评论方法
  addComment(annotationId, content)             // 添加评论
  deleteComment(commentId)                      // 删除评论

  // 数据持久化
  saveAnnotations()                             // 保存标注到后端
  loadAnnotations(pdfPath)                      // 从后端加载标注
  #scheduleAutoSave()                           // 计划自动保存

  // 事件处理
  #handleAnnotationCreate(data)                 // 处理创建标注事件
  #handleAnnotationUpdate(data)                 // 处理更新标注事件
  #handleAnnotationDelete(data)                 // 处理删除标注事件
  #handleCommentAdd(data)                       // 处理添加评论事件
  #handleJumpTo(data)                           // 处理跳转事件
}
```

#### AnnotationSidebarUI类
```javascript
/**
 * 标注侧边栏UI组件
 */
class AnnotationSidebarUI {
  #eventBus
  #container         // 侧边栏容器
  #toolbar           // 工具栏组件
  #annotationList    // 标注列表容器
  #annotations       // 当前显示的标注数组
  #isVisible

  constructor(eventBus)

  // UI方法
  createUI()                                    // 创建DOM结构
  show()                                        // 显示侧边栏
  hide()                                        // 隐藏侧边栏
  toggle()                                      // 切换显示
  render(annotations)                           // 渲染标注列表
  addAnnotationCard(annotation)                 // 添加标注卡片
  updateAnnotationCard(annotation)              // 更新标注卡片
  removeAnnotationCard(id)                      // 移除标注卡片

  // 工具栏方法
  #createToolbar()                              // 创建工具栏
  #handleToolClick(tool)                        // 处理工具点击

  // 标注卡片方法
  #createAnnotationCard(annotation)             // 创建标注卡片DOM
  #handleJumpClick(id)                          // 处理跳转点击
  #handleCommentClick(id)                       // 处理评论点击
  #handleEditClick(id)                          // 处理编辑点击
  #handleDeleteClick(id)                        // 处理删除点击

  // 事件监听
  #setupEventListeners()                        // 设置事件监听
  #handleAnnotationCreated(data)                // 监听标注创建
  #handleAnnotationUpdated(data)                // 监听标注更新
  #handleAnnotationDeleted(data)                // 监听标注删除
}
```

#### ScreenshotTool类
```javascript
/**
 * 截图工具 - 处理截图标注的创建
 */
class ScreenshotTool {
  #eventBus
  #pdfViewerManager
  #capturer          // ScreenshotCapturer
  #isActive
  #selectionOverlay  // 选择遮罩层
  #startPos
  #endPos

  constructor(eventBus, pdfViewerManager, capturer)

  // 工具控制
  activate()                                    // 激活截图模式
  deactivate()                                  // 停用截图模式

  // 截图流程
  #createSelectionOverlay()                     // 创建选择遮罩
  #handleMouseDown(e)                           // 处理鼠标按下
  #handleMouseMove(e)                           // 处理鼠标移动
  #handleMouseUp(e)                             // 处理鼠标释放
  #captureScreenshot(rect)                      // 捕获截图
  #showPreviewDialog(imageData)                 // 显示预览对话框
  #saveAnnotation(imageData, description)       // 保存标注

  // 辅助方法
  #getRectFromPoints(start, end)                // 计算矩形区域
  #getCurrentPageNumber()                       // 获取当前页码
  #cleanup()                                    // 清理资源
}
```

#### TextHighlightTool类
```javascript
/**
 * 选字高亮工具 - 处理文本高亮标注
 */
class TextHighlightTool {
  #eventBus
  #pdfViewerManager
  #isActive
  #selectedText
  #textRanges
  #highlightColors = ['#ffff00', '#90ee90', '#87ceeb', '#ffb6c1']

  constructor(eventBus, pdfViewerManager)

  // 工具控制
  activate()                                    // 激活选字模式
  deactivate()                                  // 停用选字模式

  // 选字流程
  #handleTextSelection()                        // 处理文本选择
  #getSelectedText()                            // 获取选中的文本
  #getTextRanges()                              // 获取文本范围
  #showHighlightDialog()                        // 显示高亮对话框
  #saveAnnotation(color, note)                  // 保存标注

  // 高亮渲染
  #applyHighlight(annotation)                   // 应用高亮到PDF
}
```

#### CommentTool类
```javascript
/**
 * 批注工具 - 处理批注标注的创建
 */
class CommentTool {
  #eventBus
  #pdfViewerManager
  #isActive
  #commentInput      // 批注输入框

  constructor(eventBus, pdfViewerManager)

  // 工具控制
  activate()                                    // 激活批注模式
  deactivate()                                  // 停用批注模式

  // 批注流程
  #handlePageClick(e)                           // 处理页面点击
  #showCommentInput(x, y, pageNumber)           // 显示批注输入框
  #saveAnnotation(content, position)            // 保存标注

  // 批注渲染
  #renderCommentIcon(annotation)                // 渲染批注图标
}
```

#### AnnotationRenderer类
```javascript
/**
 * 标注渲染器 - 在PDF页面上渲染标注
 */
class AnnotationRenderer {
  #pdfViewerManager
  #renderedAnnotations   // Map<id, elements>

  constructor(pdfViewerManager)

  // 渲染方法
  render(annotation)                            // 渲染单个标注
  renderAll(annotations)                        // 渲染所有标注
  remove(id)                                    // 移除标注渲染
  highlight(id)                                 // 高亮标注（闪烁效果）

  // 类型特定渲染
  #renderScreenshot(annotation)                 // 渲染截图标注（边框）
  #renderTextHighlight(annotation)              // 渲染文本高亮
  #renderComment(annotation)                    // 渲染批注图标

  // 辅助方法
  #createOverlayElement(annotation)             // 创建覆盖层元素
  #positionElement(element, rect, pageNumber)   // 定位元素
}
```

#### AnnotationStorage类
```javascript
/**
 * 标注存储 - 与后端通信
 */
class AnnotationStorage {
  #wsClient
  #eventBus

  constructor(wsClient, eventBus)

  // 存储方法
  save(pdfPath, annotations)                    // 保存标注到后端
  load(pdfPath)                                 // 从后端加载标注
  delete(pdfPath, annotationId)                 // 删除标注

  // WebSocket消息处理
  #sendSaveRequest(data)                        // 发送保存请求
  #sendLoadRequest(pdfPath)                     // 发送加载请求
  #handleSaveResponse(response)                 // 处理保存响应
  #handleLoadResponse(response)                 // 处理加载响应
}
```

#### ScreenshotCapturer类
```javascript
/**
 * 截图捕获器 - 使用Canvas捕获PDF区域
 */
class ScreenshotCapturer {
  #pdfViewerManager

  constructor(pdfViewerManager)

  /**
   * 捕获PDF指定区域的截图
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 { x, y, width, height }
   * @returns {Promise<string>} base64图片数据
   */
  async capture(pageNumber, rect)

  // 内部方法
  #getPageCanvas(pageNumber)                    // 获取页面Canvas
  #extractRegion(canvas, rect)                  // 提取区域
  #toBase64(canvas)                             // 转换为base64
}
```

### 数据模型

#### Annotation类
```javascript
/**
 * 标注数据模型
 */
class Annotation {
  constructor(data) {
    this.id = data.id || generateId()
    this.type = data.type  // 'screenshot' | 'text-highlight' | 'comment'
    this.pageNumber = data.pageNumber
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
    this.comments = data.comments || []

    // 类型特定数据
    this.data = data.data  // 根据type不同包含不同字段
  }

  // 方法
  toJSON()                    // 序列化
  static fromJSON(json)       // 反序列化
  addComment(comment)         // 添加评论
  removeComment(commentId)    // 移除评论
  update(changes)             // 更新数据
}
```

#### Comment类
```javascript
/**
 * 评论数据模型
 */
class Comment {
  constructor(data) {
    this.id = data.id || generateId()
    this.annotationId = data.annotationId
    this.content = data.content
    this.createdAt = data.createdAt || new Date().toISOString()
  }

  toJSON()
  static fromJSON(json)
}
```

## 约束条件

### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer` 中的代码，但需要扩展后端以支持标注数据的保存和加载

### 严格遵循代码规范和标准
必须优先阅读和理解项目的代码规范和Feature开发指南

### Feature架构规范
1. 必须实现IFeature接口
2. 必须通过依赖注入容器获取依赖
3. 必须使用EventBus进行通信
4. 必须提供TypeScript类型定义

### UI设计规范
1. 侧边栏宽度300-400px，与书签栏统一风格
2. 使用清晰的图标和颜色区分标注类型
3. 支持响应式布局
4. 保持与现有UI的视觉一致性

### 数据安全规范
1. 标注数据必须关联到特定PDF文件
2. 不允许跨文件访问标注
3. 删除操作必须有确认对话框
4. 数据保存失败时显示错误提示

## 可行验收标准

### 单元测试

#### AnnotationManager测试
- ✅ createAnnotation正确创建三种类型标注
- ✅ updateAnnotation正确更新标注数据
- ✅ deleteAnnotation正确删除标注
- ✅ addComment正确添加评论
- ✅ getAnnotationsByPage正确过滤标注
- ✅ 自动保存定时器正常工作

#### ScreenshotTool测试
- ✅ activate正确进入截图模式
- ✅ 鼠标拖拽正确绘制选择区域
- ✅ capture生成正确的base64图片
- ✅ ESC键取消截图模式
- ✅ 保存标注触发正确事件

#### TextHighlightTool测试
- ✅ activate正确进入选字模式
- ✅ 文本选择正确获取文本和范围
- ✅ 高亮颜色正确应用
- ✅ 高亮渲染正确显示在PDF上

#### CommentTool测试
- ✅ activate正确进入批注模式
- ✅ 页面点击正确显示输入框
- ✅ 批注图标正确定位
- ✅ 保存批注触发正确事件

#### AnnotationSidebarUI测试
- ✅ createUI生成正确DOM结构
- ✅ render正确显示标注列表
- ✅ 标注卡片根据类型正确渲染
- ✅ 跳转按钮触发正确事件
- ✅ 评论输入正常工作

#### AnnotationStorage测试
- ✅ save正确发送WebSocket消息
- ✅ load正确接收并解析标注数据
- ✅ 数据序列化和反序列化正确

### 端到端测试

#### 测试1: 截图标注完整流程
1. 加载测试PDF（至少50页）
2. 点击标注按钮打开标注侧边栏
3. 点击📷截图按钮
4. 验证鼠标变为十字光标
5. 在页面上拖拽选择区域
6. 验证预览对话框显示
7. 输入描述"测试截图"
8. 点击保存
9. 验证：
   - 标注侧边栏显示新标注卡片
   - 卡片显示截图缩略图
   - 页码正确
   - 创建时间正确
10. 点击跳转按钮
11. 验证：跳转到标注所在页

#### 测试2: 选字标注完整流程
1. 点击✏️选字按钮
2. 在PDF上选择一段文本
3. 验证高亮颜色选择器显示
4. 选择黄色高亮
5. 输入笔记"重要段落"
6. 点击保存
7. 验证：
   - 文本高亮显示在PDF上
   - 标注卡片显示文本预览
   - 笔记内容正确
8. 点击跳转按钮
9. 验证：跳转到标注位置，高亮可见

#### 测试3: 批注标注完整流程
1. 点击📝批注按钮
2. 在PDF页面任意位置点击
3. 验证批注输入框显示在点击位置
4. 输入批注内容"这里有疑问"
5. 点击保存
6. 验证：
   - 批注图标📌显示在点击位置
   - 标注卡片显示批注内容
7. 点击跳转按钮
8. 验证：跳转到批注位置

#### 测试4: 添加评论流程
1. 创建任意标注
2. 点击标注卡片的"添加评论"按钮
3. 验证评论输入框展开
4. 输入评论"补充说明"
5. 点击发送
6. 验证：
   - 评论显示在标注卡片下方
   - 评论数量更新为"💬 1条评论"
7. 添加第二条评论
8. 验证：评论数量更新为"💬 2条评论"

#### 测试5: 编辑和删除标注
1. 创建一个标注
2. 点击标注卡片的"..."菜单
3. 选择"编辑"
4. 修改标注内容
5. 保存
6. 验证：标注卡片内容已更新
7. 再次点击"..."菜单
8. 选择"删除"
9. 验证确认对话框显示
10. 确认删除
11. 验证：标注从列表中移除

#### 测试6: 数据持久化
1. 创建3个不同类型的标注
2. 关闭PDF文档
3. 重新打开同一PDF文档
4. 验证：
   - 标注侧边栏自动加载3个标注
   - 标注内容完整
   - 标注在PDF上正确渲染

#### 测试7: 工具模式切换
1. 点击📷按钮，进入截图模式
2. 验证：按钮高亮，其他按钮禁用
3. 按ESC键
4. 验证：返回普通模式，所有按钮可用
5. 点击✏️按钮，进入选字模式
6. 点击📝按钮
7. 验证：切换到批注模式，选字模式取消

### 接口实现

#### 函数：createAnnotation
```javascript
/**
 * 创建标注
 * @param {Object} annotationData - 标注数据
 * @param {'screenshot'|'text-highlight'|'comment'} annotationData.type - 标注类型
 * @param {number} annotationData.pageNumber - 页码
 * @param {Object} annotationData.data - 类型特定数据
 * @returns {Promise<Annotation>} 创建的标注对象
 *
 * @example
 * // 截图标注
 * const annotation = await manager.createAnnotation({
 *   type: 'screenshot',
 *   pageNumber: 23,
 *   data: {
 *     rect: { x: 100, y: 200, width: 300, height: 200 },
 *     imageData: 'data:image/png;base64,...',
 *     description: '重要图表'
 *   }
 * });
 */
```

#### 函数：addComment
```javascript
/**
 * 为标注添加评论
 * @param {string} annotationId - 标注ID
 * @param {string} content - 评论内容
 * @returns {Promise<Comment>} 创建的评论对象
 * @throws {Error} 如果标注不存在
 *
 * @example
 * const comment = await manager.addComment('ann_001', '这是一条评论');
 */
```

#### 函数：jumpToAnnotation
```javascript
/**
 * 跳转到标注位置
 * @param {string} annotationId - 标注ID
 * @returns {Promise<void>}
 * @throws {Error} 如果标注不存在
 */
```

### 类实现

#### 类：AnnotationFeature
```javascript
/**
 * PDF标注功能Feature
 * @implements {IFeature}
 */
class AnnotationFeature {
  name: 'annotation'
  version: '1.0.0'
  dependencies: ['app-core', 'pdf-manager', 'ui-manager']

  #annotationManager
  #sidebarUI
  #tools  // { screenshot, textHighlight, comment }

  async install(container)
  async uninstall()
}
```

### 事件规范

#### 事件：ANNOTATION.SIDEBAR_TOGGLE
- **描述**: 切换标注侧边栏显示/隐藏
- **触发时机**: 用户点击标注按钮或按快捷键Ctrl+Shift+A
- **数据**: `{}`
- **订阅者**: AnnotationSidebarUI

#### 事件：ANNOTATION.CREATE
- **描述**: 创建新标注
- **触发时机**: 用户完成标注创建（截图/选字/批注）
- **数据**: `{ type, pageNumber, data }`
- **订阅者**: AnnotationManager

#### 事件：ANNOTATION.CREATED
- **描述**: 标注已创建
- **触发时机**: AnnotationManager创建标注后
- **数据**: `{ annotation }`
- **订阅者**: AnnotationSidebarUI, AnnotationRenderer

#### 事件：ANNOTATION.JUMP_TO
- **描述**: 跳转到标注位置
- **触发时机**: 用户点击标注卡片的跳转按钮
- **数据**: `{ id }`
- **订阅者**: AnnotationManager

#### 事件：ANNOTATION.COMMENT_ADD
- **描述**: 添加评论
- **触发时机**: 用户提交评论
- **数据**: `{ annotationId, content }`
- **订阅者**: AnnotationManager

## 后端扩展需求

### WebSocket消息格式

#### 保存标注请求
```javascript
{
  type: 'annotation:save',
  data: {
    pdfPath: '/path/to/document.pdf',
    annotations: [
      { id: 'ann_001', type: 'screenshot', ... },
      { id: 'ann_002', type: 'text-highlight', ... }
    ]
  }
}
```

#### 保存标注响应
```javascript
{
  type: 'annotation:saved',
  data: {
    success: true,
    savedCount: 2
  }
}
```

#### 加载标注请求
```javascript
{
  type: 'annotation:load',
  data: {
    pdfPath: '/path/to/document.pdf'
  }
}
```

#### 加载标注响应
```javascript
{
  type: 'annotation:loaded',
  data: {
    annotations: [...]
  }
}
```

### 后端存储
- 使用JSON文件存储标注数据
- 文件路径：`{pdf_path}.annotations.json`
- 支持按PDF文件路径查询标注
- 支持增量保存（只保存变更）

## 实现计划

### Phase 1: 数据模型和事件接口（2小时）
- [ ] 在pdf-viewer-constants.js中添加ANNOTATION事件定义
- [ ] 实现Annotation和Comment数据模型类
- [ ] 更新TypeScript类型定义
- [ ] 提交commit

### Phase 2: 标注侧边栏UI（4小时）
- [ ] 实现AnnotationSidebarUI类
- [ ] 实现标注工具栏组件
- [ ] 实现标注卡片组件
- [ ] 实现评论输入组件
- [ ] CSS样式编写
- [ ] 编写UI单元测试
- [ ] 提交commit

### Phase 3: 截图工具（4小时）
- [ ] 实现ScreenshotCapturer类（Canvas截图）
- [ ] 实现ScreenshotTool类（用户交互）
- [ ] 实现选择区域绘制
- [ ] 实现预览对话框
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 4: 选字高亮工具（3小时）
- [ ] 实现TextHighlightTool类
- [ ] 实现文本选择处理
- [ ] 实现高亮渲染
- [ ] 实现颜色选择器
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 5: 批注工具（3小时）
- [ ] 实现CommentTool类
- [ ] 实现批注输入框
- [ ] 实现批注图标渲染
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 6: 标注管理器（4小时）
- [ ] 实现AnnotationManager类
- [ ] 实现CRUD操作
- [ ] 实现评论管理
- [ ] 实现自动保存机制
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 7: 标注渲染器（3小时）
- [ ] 实现AnnotationRenderer类
- [ ] 实现三种标注类型的渲染
- [ ] 实现高亮效果
- [ ] 编写单元测试
- [ ] 提交commit

### Phase 8: 数据存储（3小时）
- [ ] 实现AnnotationStorage类（前端）
- [ ] 扩展后端WebSocket处理器
- [ ] 实现JSON文件存储
- [ ] 测试数据持久化
- [ ] 提交commit

### Phase 9: AnnotationFeature集成（3小时）
- [ ] 实现AnnotationFeature类
- [ ] 集成所有组件
- [ ] 添加到bootstrap流程
- [ ] 端到端测试
- [ ] 提交commit

### Phase 10: 文档和优化（2小时）
- [ ] 编写README.md
- [ ] 更新ARCHITECTURE.md
- [ ] 性能优化（虚拟滚动、debounce）
- [ ] 最终测试
- [ ] 提交最终commit

**总预计时间**: 31小时

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Canvas截图性能问题 | 🟡 中 | 使用requestIdleCallback，限制截图尺寸 |
| 文本高亮定位精度 | 🟡 中 | 使用PDF.js的textContent API，测试各种字体 |
| 大量标注加载慢 | 🟡 中 | 实现虚拟滚动，按需渲染 |
| 标注数据冲突 | 🟢 低 | 使用UUID，时间戳冲突检测 |
| WebSocket通信失败 | 🟡 中 | 实现本地缓存，离线模式支持 |
| UI与现有控件冲突 | 🟢 低 | z-index管理，独立事件监听 |
| 不同PDF格式兼容性 | 🟡 中 | 测试多种PDF格式，处理特殊情况 |

## 后续版本规划（不在第一期实现）

### 第二期功能
- 标注排序（按时间、页码、类型）
- 标注筛选（按类型、颜色、关键词）
- 只显示当前页标注（切换按钮）
- 标注搜索功能
- 标注导出（JSON、Markdown）

### 第三期功能
- 标注分组和标签
- 协作标注（多用户）
- 标注历史记录
- 撤销/重做功能
- 更多标注类型（箭头、形状、手绘）

## 参考资料

### PDF.js文档
- [Text Selection API](https://mozilla.github.io/pdf.js/api/draft/TextLayer.html)
- [Canvas Rendering](https://mozilla.github.io/pdf.js/api/draft/PDFPageView.html)

### 项目文档
- [Feature开发指南](../../../src/frontend/pdf-viewer/docs/FEATURE-DEVELOPMENT-GUIDE.md)
- [架构文档](../../../src/frontend/pdf-viewer/docs/ARCHITECTURE.md)
- [BookmarkSidebarUI实现](../../../src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js)

### UI设计参考
- Adobe Acrobat Reader标注功能
- Foxit Reader标注功能
- PDF.js Viewer注释功能
- Notion Web Clipper标注功能
