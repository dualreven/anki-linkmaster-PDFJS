# PDF书签侧边栏功能规格说明

**功能ID**: 20250930165709-pdf-bookmark-sidebar
**优先级**: 中
**版本**: v001
**创建时间**: 2025-09-30 16:57:09
**预计完成**: 2025-10-05
**状态**: 设计中

## 现状说明
- PDF Viewer 当前只支持基本的页面浏览和缩放功能
- 用户无法快速导航到 PDF 文档的特定章节
- PDF 自带的书签信息（outline/目录）未被利用
- 缺少侧边栏 UI 组件来展示导航结构

## 存在问题
- 浏览大型 PDF 文档时，用户需要手动翻页查找内容，效率低下
- PDF 文档中的目录结构信息被忽略，用户体验不佳
- 没有可视化的文档结构导航工具

## 提出需求

### 第一版核心功能 (v001)
1. **UI层**: 添加可展开/收起的书签侧边栏
2. **数据层**: 从 PDF 自带书签信息加载目录结构
3. **交互层**: 点击书签条目跳转到对应页面位置
4. **架构设计**: 明确分层，为未来扩展预留空间

### 未来版本功能预留 (v002+)
- 用户自定义书签的创建、编辑、删除
- 书签数据的本地持久化存储
- 书签的导入/导出功能
- 书签搜索和过滤功能

## 解决方案

### 技术方案概述
采用分层架构设计，将 UI 展示、数据处理和业务逻辑严格分离：

```
┌─────────────────────────────────────┐
│  UI Layer (BookmarkSidebarUI)       │  ← 负责DOM渲染和用户交互
├─────────────────────────────────────┤
│  Manager Layer (BookmarkManager)    │  ← 负责业务逻辑和事件协调
├─────────────────────────────────────┤
│  Data Layer (BookmarkDataProvider)  │  ← 负责数据获取和转换
├─────────────────────────────────────┤
│  PDF.js API (getOutline)            │  ← PDF.js 底层接口
└─────────────────────────────────────┘
```

### 架构分层设计

#### 1. UI 展示层 (`BookmarkSidebarUI`)
**职责**:
- 渲染书签侧边栏的 DOM 结构
- 处理展开/收起按钮的点击事件
- 渲染书签树状结构（支持多级嵌套）
- 处理书签条目的点击事件
- 管理侧边栏的显示/隐藏状态

**不负责**:
- 数据获取和处理
- 页面跳转逻辑
- 事件总线通信

#### 2. 数据处理层 (`BookmarkDataProvider`)
**职责**:
- 从 PDF.js API 获取原始书签数据 (`pdfDocument.getOutline()`)
- 将 PDF.js 的 outline 格式转换为统一的书签数据结构
- 处理书签数据的空状态（无书签时返回空数组）
- 为未来扩展预留本地书签数据的合并接口

**数据结构**:
```javascript
// 标准书签节点结构
{
  id: string,              // 唯一标识 (v001: 使用索引生成)
  title: string,           // 书签标题
  dest: any,               // PDF.js destination 对象
  items: BookmarkNode[],   // 子书签数组（树状结构）
  level: number,           // 层级深度 (0-based)
  source: 'pdf' | 'local'  // 来源标识 (v001: 固定为 'pdf')
}
```

**不负责**:
- DOM 渲染
- 用户交互处理
- 页面导航逻辑

#### 3. 业务管理层 (`BookmarkManager`)
**职责**:
- 协调 UI 层和数据层
- 监听并处理书签相关事件
- 触发页面跳转事件（通过 EventBus）
- 管理书签侧边栏的生命周期
- 处理 PDF 文档加载/卸载时的书签更新

**不负责**:
- 直接操作 DOM
- 直接获取 PDF 数据
- 执行页面渲染

### 事件驱动架构

#### 事件命名规范
遵循 `FRONTEND-EVENT-NAMING-001` 规范，格式为 `{模块}:{动作}:{状态}`

#### 定义的事件常量

```javascript
// src/frontend/pdf-viewer/event-constants.js (扩展)
export const BOOKMARK_EVENTS = {
  SIDEBAR: {
    TOGGLE: 'bookmark:sidebar:toggle',      // 切换侧边栏显示/隐藏
    OPENED: 'bookmark:sidebar:opened',      // 侧边栏已打开
    CLOSED: 'bookmark:sidebar:closed',      // 侧边栏已关闭
  },
  LOAD: {
    REQUESTED: 'bookmark:load:requested',   // 请求加载书签
    SUCCESS: 'bookmark:load:success',       // 书签加载成功
    FAILED: 'bookmark:load:failed',         // 书签加载失败
    EMPTY: 'bookmark:load:empty',           // 书签为空
  },
  NAVIGATE: {
    REQUESTED: 'bookmark:navigate:requested', // 请求导航到书签
    SUCCESS: 'bookmark:navigate:success',     // 导航成功
    FAILED: 'bookmark:navigate:failed',       // 导航失败
  },
  // 为未来扩展预留的事件（v002+）
  CREATE: {
    REQUESTED: 'bookmark:create:requested',
    SUCCESS: 'bookmark:create:success',
    FAILED: 'bookmark:create:failed',
  },
  UPDATE: {
    REQUESTED: 'bookmark:update:requested',
    SUCCESS: 'bookmark:update:success',
    FAILED: 'bookmark:update:failed',
  },
  DELETE: {
    REQUESTED: 'bookmark:delete:requested',
    SUCCESS: 'bookmark:delete:success',
    FAILED: 'bookmark:delete:failed',
  },
};
```

### 页面定位跳转方案

#### PDF.js Destination 格式
PDF.js 的 `dest` 对象可能有多种格式：
- 显式目的地: `[pageRef, {name: 'XYZ'}, left, top, zoom]`
- 命名目的地: `"section1.2"` (字符串，需要解析)
- 页面索引: `{pageIndex: 5}` (部分 PDF 使用)

#### 导航处理逻辑
```javascript
async navigateToDestination(dest) {
  // 1. 解析 destination，获取页码和坐标
  const {pageNumber, x, y, zoom} = await parseDestination(dest);

  // 2. 发出页面跳转事件
  eventBus.emit(PDF_EVENTS.PAGE.NAVIGATE, {
    pageNumber,
    position: {x, y},
    zoom
  });
}
```

## 约束条件

### 仅修改 pdf-viewer 模块代码
仅在 `src/frontend/pdf-viewer/` 目录下添加新代码，不修改 common 模块和其他模块。

允许的新增文件：
- `src/frontend/pdf-viewer/bookmark/bookmark-manager.js`
- `src/frontend/pdf-viewer/bookmark/bookmark-data-provider.js`
- `src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js`
- `src/frontend/pdf-viewer/__tests__/bookmark-manager.test.js`
- `src/frontend/pdf-viewer/__tests__/bookmark-data-provider.test.js`

### 严格遵循代码规范和标准
必须优先阅读和理解以下规范：
1. `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. `docs/SPEC/FRONTEND-EVENT-BUS-001.md`
3. `docs/SPEC/FRONTEND-EVENT-NAMING-001.md`
4. `docs/SPEC/JAVASCRIPT-CLASS-STRUCTURE-001.md`
5. `docs/SPEC/JAVASCRIPT-FUNCTION-DESIGN-001.md`

### 与现有模块的集成要求
- 必须使用现有的 EventBus 系统 (`pdf-viewer/eventbus.js`)
- 必须使用现有的 Logger 系统 (`common/utils/logger.js`)
- 必须通过 `PDFManager` 获取 PDF 文档对象
- UI 样式应与现有的 pdf-viewer 界面风格保持一致

### 性能和兼容性要求
- 书签树的渲染必须支持虚拟滚动（当书签数量 > 100 时）
- 必须在 QtWebEngine 环境下正常工作
- 侧边栏的展开/收起动画应流畅（60fps）
- 大型 PDF（1000+ 页）的书签加载时间 < 500ms

## 可行验收标准

### 单元测试
1. `BookmarkDataProvider` 测试覆盖率 ≥ 90%
   - 测试 PDF.js outline 数据解析
   - 测试空书签情况处理
   - 测试多级嵌套书签结构转换
   - 测试错误处理

2. `BookmarkManager` 测试覆盖率 ≥ 85%
   - 测试事件监听和触发逻辑
   - 测试书签加载流程
   - 测试导航请求处理
   - 测试侧边栏状态管理

### 端到端测试

#### 测试场景1: 加载带书签的PDF
- **前置条件**: 打开一个包含多级目录的 PDF 文档
- **操作步骤**:
  1. 点击书签按钮
  2. 验证侧边栏显示
  3. 验证书签树结构正确渲染
- **预期结果**:
  - 侧边栏从右侧滑出
  - 书签树显示 PDF 的完整目录结构
  - 多级书签正确缩进显示

#### 测试场景2: 点击书签导航
- **前置条件**: 书签侧边栏已打开
- **操作步骤**:
  1. 点击任意书签条目
  2. 观察 PDF 渲染区域
- **预期结果**:
  - PDF 自动跳转到对应页面
  - 页面滚动到精确的垂直位置
  - 书签条目高亮显示（可选）

#### 测试场景3: 无书签的PDF
- **前置条件**: 打开一个没有书签的 PDF 文档
- **操作步骤**:
  1. 点击书签按钮
  2. 验证侧边栏状态
- **预期结果**:
  - 侧边栏显示"暂无书签"提示信息
  - 不显示任何书签条目
  - UI 不报错

#### 测试场景4: 展开/收起侧边栏
- **前置条件**: 已打开 PDF
- **操作步骤**:
  1. 点击书签按钮展开侧边栏
  2. 再次点击按钮收起侧边栏
  3. 重复步骤1-2
- **预期结果**:
  - 侧边栏平滑展开/收起动画
  - 按钮状态（图标/颜色）正确切换
  - 多次操作无异常

### 接口实现

#### 接口1: BookmarkDataProvider.getBookmarks()
- **函数**: `async getBookmarks(pdfDocument)`
- **描述**: 从 PDF 文档中提取书签数据并转换为标准格式
- **参数**:
  - `pdfDocument`: PDF.js PDFDocumentProxy 对象
- **返回值**: `Promise<BookmarkNode[]>` - 书签树数组（根级节点）
- **异常**:
  - 若 PDF 无权限访问 outline，返回空数组
  - 若 PDF.js API 调用失败，抛出 `BookmarkLoadError`

#### 接口2: BookmarkManager.navigateToBookmark()
- **函数**: `async navigateToBookmark(bookmark)`
- **描述**: 导航到指定书签的目标位置
- **参数**:
  - `bookmark`: BookmarkNode 对象（包含 dest 属性）
- **返回值**: `Promise<void>`
- **事件触发**:
  - 成功: `BOOKMARK_EVENTS.NAVIGATE.SUCCESS`
  - 失败: `BOOKMARK_EVENTS.NAVIGATE.FAILED`

#### 接口3: BookmarkSidebarUI.toggle()
- **函数**: `toggle()`
- **描述**: 切换书签侧边栏的显示/隐藏状态
- **参数**: 无
- **返回值**: `boolean` - 切换后的状态 (true=显示, false=隐藏)
- **事件触发**:
  - 显示: `BOOKMARK_EVENTS.SIDEBAR.OPENED`
  - 隐藏: `BOOKMARK_EVENTS.SIDEBAR.CLOSED`

### 类实现

#### 类1: BookmarkDataProvider
- **职责**: 书签数据获取和格式转换
- **属性**:
  - `_logger`: Logger 实例
  - `_pdfDocument`: 当前 PDF 文档对象引用
- **方法**:
  - `async getBookmarks(pdfDocument)`: 获取书签数据
  - `_convertOutlineToBookmarks(outline, level=0)`: 递归转换 outline 结构
  - `_parseDestination(dest)`: 解析 PDF.js destination 对象
  - `_generateBookmarkId(index, level)`: 生成书签唯一ID

#### 类2: BookmarkManager
- **职责**: 书签功能的业务逻辑协调
- **属性**:
  - `_dataProvider`: BookmarkDataProvider 实例
  - `_sidebarUI`: BookmarkSidebarUI 实例
  - `_eventBus`: EventBus 实例
  - `_currentBookmarks`: 当前书签数据缓存
  - `_isInitialized`: 初始化状态
- **方法**:
  - `initialize()`: 初始化管理器，设置事件监听
  - `async loadBookmarks(pdfDocument)`: 加载书签数据
  - `async navigateToBookmark(bookmark)`: 导航到书签位置
  - `toggleSidebar()`: 切换侧边栏显示
  - `_handlePDFLoaded(event)`: PDF 加载事件处理器
  - `_handleBookmarkClicked(event)`: 书签点击事件处理器
  - `destroy()`: 清理资源和事件监听

#### 类3: BookmarkSidebarUI
- **职责**: 书签侧边栏的 UI 渲染和交互
- **属性**:
  - `_container`: 侧边栏容器元素
  - `_treeContainer`: 书签树容器元素
  - `_toggleButton`: 展开/收起按钮元素
  - `_isVisible`: 可见性状态
  - `_eventBus`: EventBus 实例
- **方法**:
  - `render(bookmarks)`: 渲染书签树
  - `toggle()`: 切换显示/隐藏
  - `show()`: 显示侧边栏
  - `hide()`: 隐藏侧边栏
  - `clear()`: 清空书签内容
  - `_renderBookmarkNode(node, parentElement)`: 递归渲染书签节点
  - `_createToggleButton()`: 创建切换按钮
  - `_setupEventListeners()`: 设置事件监听
  - `_handleBookmarkClick(event)`: 处理书签点击事件

### 事件规范

#### 事件1: bookmark:load:success
- **描述**: 书签数据加载成功时触发
- **触发时机**: `BookmarkManager.loadBookmarks()` 成功完成
- **参数**:
  ```javascript
  {
    bookmarks: BookmarkNode[],  // 书签数据数组
    count: number,               // 书签总数（包括子书签）
    source: 'pdf'                // 数据来源
  }
  ```
- **监听者**: `BookmarkSidebarUI`

#### 事件2: bookmark:navigate:requested
- **描述**: 用户点击书签，请求导航到目标位置
- **触发时机**: 用户在侧边栏点击书签条目
- **参数**:
  ```javascript
  {
    bookmark: BookmarkNode,     // 被点击的书签对象
    timestamp: number           // 触发时间戳
  }
  ```
- **监听者**: `BookmarkManager`

#### 事件3: bookmark:sidebar:toggle
- **描述**: 请求切换侧边栏显示状态
- **触发时机**: 用户点击书签按钮
- **参数**:
  ```javascript
  {
    visible: boolean            // 目标状态 (可选，不提供则自动切换)
  }
  ```
- **监听者**: `BookmarkManager` → `BookmarkSidebarUI`

## 技术细节

### HTML 结构设计
```html
<!-- 书签侧边栏容器 -->
<div id="bookmark-sidebar" class="bookmark-sidebar" hidden>
  <!-- 侧边栏头部 -->
  <div class="bookmark-sidebar-header">
    <h3 class="bookmark-sidebar-title">书签</h3>
    <button class="bookmark-sidebar-close" aria-label="关闭书签">×</button>
  </div>

  <!-- 书签树容器 -->
  <div class="bookmark-tree-container">
    <!-- 空状态提示 -->
    <div class="bookmark-empty-state" hidden>
      <p>暂无书签</p>
    </div>

    <!-- 书签树（动态生成） -->
    <ul class="bookmark-tree">
      <!-- 书签节点模板 -->
      <li class="bookmark-node" data-bookmark-id="xxx" data-level="0">
        <span class="bookmark-toggle">▶</span>
        <span class="bookmark-title">第一章</span>
        <ul class="bookmark-children">
          <!-- 子书签递归 -->
        </ul>
      </li>
    </ul>
  </div>
</div>

<!-- 书签切换按钮（集成到主工具栏） -->
<button id="bookmark-toggle-btn"
        class="toolbar-button"
        aria-label="切换书签"
        title="书签">
  <svg><!-- 书签图标 --></svg>
</button>
```

### CSS 样式要求
- 侧边栏宽度: 280px (可配置)
- 展开/收起动画: `transform: translateX()` + `transition: 0.3s ease`
- 书签节点缩进: 每级 20px
- 响应式设计: 小屏幕时侧边栏覆盖内容，大屏幕时推挤内容
- 暗色模式兼容: 使用 CSS 变量定义颜色

### 错误处理策略
1. **PDF.js API 调用失败**:
   - 捕获异常，记录日志
   - 显示用户友好的错误提示
   - 不阻塞 PDF 查看器其他功能

2. **Destination 解析失败**:
   - 降级处理：仅跳转到页码，忽略精确坐标
   - 记录警告日志

3. **DOM 操作失败**:
   - 捕获异常，防止页面崩溃
   - 记录错误堆栈

## 未来扩展点 (v002+)

### 本地书签存储设计
```javascript
// 扩展 BookmarkNode 结构
{
  id: string,
  title: string,
  dest: any,
  items: BookmarkNode[],
  level: number,
  source: 'pdf' | 'local',      // 已预留

  // v002 新增字段
  createdAt: timestamp,         // 创建时间
  updatedAt: timestamp,         // 更新时间
  color: string,                // 自定义颜色
  note: string,                 // 书签备注
  userId: string,               // 用户ID（多用户支持）
}
```

### 扩展接口预留
- `BookmarkDataProvider.saveBookmark(bookmark)` - 保存自定义书签
- `BookmarkDataProvider.deleteBookmark(id)` - 删除书签
- `BookmarkDataProvider.updateBookmark(id, updates)` - 更新书签
- `BookmarkDataProvider.mergeBookmarks(pdfBookmarks, localBookmarks)` - 合并书签

### 存储方案选型
- 优先使用 IndexedDB (前端本地存储)
- 备选方案: LocalStorage (容量限制)
- 未来考虑: 后端同步（需要后端 API 支持）

## 开发顺序建议

### Phase 1: 数据层开发 (1天)
1. 实现 `BookmarkDataProvider` 类
2. 编写单元测试
3. 测试各种 PDF 书签格式

### Phase 2: UI层开发 (1.5天)
1. 实现 `BookmarkSidebarUI` 类
2. 编写 HTML/CSS 样式
3. 测试树状结构渲染

### Phase 3: 管理层开发 (1天)
1. 实现 `BookmarkManager` 类
2. 集成数据层和UI层
3. 实现事件监听和协调逻辑

### Phase 4: 集成测试 (1天)
1. 端到端功能测试
2. QtWebEngine 兼容性测试
3. 性能测试和优化

### Phase 5: 文档和验收 (0.5天)
1. 编写使用文档
2. 代码审查
3. 验收测试

## 参考资料
- PDF.js API 文档: https://mozilla.github.io/pdf.js/api/
- PDF.js Outline 示例: https://github.com/mozilla/pdf.js/tree/master/examples
- 项目现有代码规范: `docs/SPEC/`