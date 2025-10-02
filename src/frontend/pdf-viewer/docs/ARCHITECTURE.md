# PDF Viewer 架构文档

## 目录结构

```
src/frontend/pdf-viewer/
├── main.js                          # 应用入口
├── app-core.js                      # 应用核心初始化（旧架构兼容）
├── index.html                       # HTML模板
│
├── bootstrap/                       # 启动引导模块
│   ├── app-bootstrap-feature.js    # Feature启动器（新架构）
│   └── app-bootstrap.js            # 传统启动器（旧架构）
│
├── container/                       # 依赖注入容器
│   ├── simple-dependency-container.js  # 简单DI容器
│   └── app-container.js            # 应用容器（提供EventBus等）
│
├── features/                        # Feature插件模块（新架构核心）
│   ├── app-core/                   # 核心应用Feature
│   │   └── index.js               # EventBus、WebSocket、日志
│   ├── pdf-manager/                # PDF管理Feature
│   │   └── index.js               # PDF加载、缓存、文档管理
│   ├── ui-manager/                 # UI管理Feature
│   │   └── index.js               # 渲染、控件、事件处理
│   ├── pdf-reader/                 # PDF阅读器Feature（功能域架构）
│   │   ├── components/            # 组件
│   │   ├── services/              # 服务
│   │   └── __tests__/             # 测试
│   └── ...                        # 其他Features
│
├── pdf/                            # PDF核心模块
│   ├── pdf-manager-refactored.js  # PDF管理器（整合加载、缓存、文档）
│   ├── pdf-loader.js              # PDF加载器
│   ├── pdf-document-manager.js    # PDF文档管理
│   ├── page-cache-manager.js      # 页面缓存管理
│   └── pdf-config.js              # PDF配置
│
├── ui/                             # UI模块
│   ├── ui-manager-core-refactored.js  # UI管理器核心
│   ├── dom-element-manager.js     # DOM元素管理
│   ├── keyboard-handler.js        # 键盘事件处理
│   ├── ui-state-manager.js        # UI状态管理
│   ├── text-layer-manager.js      # 文本层管理
│   └── bookmark-sidebar-ui.js     # 书签侧边栏UI
│
├── bookmark/                       # 书签模块
│   ├── bookmark-manager.js        # 书签管理器
│   └── bookmark-data-provider.js  # 书签数据提供者
│
├── pdf-viewer-manager.js          # PDFViewer管理器（PDF.js封装）
├── ui-zoom-controls.js            # 缩放控件
├── ui-layout-controls.js          # 布局控件
│
├── types/                          # TypeScript类型定义
│   ├── index.d.ts                 # 类型定义导出
│   ├── common.d.ts                # 通用类型
│   ├── events.d.ts                # 事件类型
│   ├── pdf.d.ts                   # PDF模块类型
│   ├── ui.d.ts                    # UI模块类型
│   ├── adapters.d.ts              # 适配器类型
│   └── features.d.ts              # Feature架构类型
│
├── handlers/                       # 事件处理器（旧架构）
├── adapters/                       # 适配器
├── core/                           # 核心组件（旧架构）
└── __tests__/                      # 测试文件
```

## 架构设计

### 1. Feature-based 插件化架构（当前架构）

#### 核心思想
- **插件化**: 所有功能封装为独立的Feature模块
- **依赖注入**: 通过SimpleDependencyContainer管理依赖
- **事件驱动**: 通过EventBus实现模块间通信
- **渐进式迁移**: 与旧架构兼容，逐步迁移

#### Feature接口规范
```javascript
interface IFeature {
  name: string;           // Feature名称
  version: string;        // 版本号
  dependencies: string[]; // 依赖的其他Features
  install(container): Promise<void>;  // 安装Feature
  uninstall(): Promise<void>;         // 卸载Feature
}
```

#### 当前Features
1. **app-core**: 核心基础设施
   - EventBus事件总线
   - WebSocket客户端
   - 日志系统
   - 控制台桥接

2. **pdf-manager**: PDF文档管理
   - PDFManager（加载、缓存、文档管理）
   - 监听FILE.LOAD.REQUESTED事件
   - 发出FILE.LOAD.SUCCESS事件

3. **ui-manager**: UI界面管理
   - UIManagerCore（渲染、控件、事件）
   - PDFViewerManager集成
   - BookmarkManager集成
   - UIZoomControls集成
   - UILayoutControls集成

### 2. 启动流程

```
main.js
  ↓
app-bootstrap-feature.js
  ↓
1. 创建SimpleDependencyContainer
  ↓
2. 注册Features（app-core, pdf-manager, ui-manager）
  ↓
3. 解析依赖关系
  ↓
4. 按依赖顺序安装Features
  app-core → pdf-manager → ui-manager
  ↓
5. 发出APP.BOOTSTRAP.COMPLETED事件
  ↓
6. 自动加载PDF（如果URL有pdf参数）
```

### 3. 事件驱动架构

#### 核心事件流
```
用户操作
  ↓
UI组件 → EventBus.emit(事件)
  ↓
EventBus分发 → 所有订阅者
  ↓
处理器执行 → 更新状态/调用服务
  ↓
服务层 → EventBus.emit(结果事件)
  ↓
UI组件监听 → 更新显示
```

#### 主要事件类型

**PDF加载事件**
- `FILE.LOAD.REQUESTED`: 请求加载PDF
- `FILE.LOAD.PROGRESS`: 加载进度
- `FILE.LOAD.SUCCESS`: 加载成功
- `FILE.LOAD.FAILED`: 加载失败

**缩放事件**
- `ZOOM.IN`: 放大
- `ZOOM.OUT`: 缩小
- `ZOOM.ACTUAL_SIZE`: 重置到100%
- `ZOOM.FIT_WIDTH`: 适应宽度
- `ZOOM.FIT_HEIGHT`: 适应高度
- `ZOOM.CHANGING`: 缩放变化中（由PDF.js触发）

**导航事件**
- `NAVIGATION.PREVIOUS`: 上一页
- `NAVIGATION.NEXT`: 下一页
- `NAVIGATION.GOTO`: 跳转到指定页
- `PAGE.CHANGING`: 页面变化中

**书签事件**
- `BOOKMARK.LOAD.SUCCESS`: 书签加载成功
- `BOOKMARK.CLICK`: 书签点击

### 4. 模块职责

#### PDFManager（pdf/pdf-manager-refactored.js）
**职责**:
- PDF文档的加载、缓存和管理
- 协调PDFLoader、PDFDocumentManager、PageCacheManager

**核心方法**:
```javascript
async loadPDF(fileData)      // 加载PDF
async getPage(pageNumber)    // 获取页面（带缓存）
getTotalPages()              // 获取总页数
closePDF()                   // 关闭PDF
```

**事件监听**:
- `FILE.LOAD.REQUESTED` → 加载PDF

**事件发出**:
- `FILE.LOAD.SUCCESS` → 加载成功
- `FILE.LOAD.FAILED` → 加载失败

#### UIManagerCore（ui/ui-manager-core-refactored.js）
**职责**:
- UI组件的初始化和协调
- 集成PDFViewerManager、BookmarkManager、缩放控件、布局控件
- 处理所有UI相关的事件

**集成的组件**:
- PDFViewerManager: PDF渲染引擎
- BookmarkManager: 书签管理
- UIZoomControls: 缩放控件
- UILayoutControls: 布局控件
- DOMElementManager: DOM管理
- KeyboardHandler: 键盘处理
- TextLayerManager: 文本层管理

**事件处理**:
```javascript
FILE.LOAD.SUCCESS      → 加载PDF到PDFViewerManager
ZOOM.IN/OUT            → 执行缩放操作
ZOOM.ACTUAL_SIZE       → 重置缩放
ZOOM.FIT_WIDTH/HEIGHT  → 适应宽高
NAVIGATION.PREVIOUS/NEXT → 翻页
NAVIGATION.GOTO        → 跳转页面
ZOOM.CHANGING          → 更新缩放显示
PAGE.CHANGING          → 更新页码显示
```

#### PDFViewerManager（pdf-viewer-manager.js）
**职责**:
- 封装PDF.js的PDFViewer
- 桥接PDF.js事件到应用EventBus
- 管理PDF渲染

**核心方法**:
```javascript
initialize(container)         // 初始化PDFViewer
load(pdfDocument)            // 加载PDF文档
set currentScale(scale)       // 设置缩放
set currentScaleValue(value)  // 设置缩放模式
set currentPageNumber(page)   // 设置当前页
```

**事件桥接**:
- PDF.js `pagechanging` → `PAGE.CHANGING`
- PDF.js `scalechanging` → `ZOOM.CHANGING`

#### BookmarkManager（bookmark/bookmark-manager.js）
**职责**:
- 管理PDF书签
- 渲染书签侧边栏
- 处理书签点击导航

**配置**:
- URL参数 `?bookmark=0` 可禁用书签

#### UIZoomControls（ui-zoom-controls.js）
**职责**:
- 管理缩放按钮、页码输入框
- 更新缩放和页码显示
- 处理用户输入

**DOM元素**:
```javascript
#zoom-in          // 放大按钮
#zoom-out         // 缩小按钮
#zoom-level       // 缩放百分比显示
#page-input       // 页码输入框
#page-total       // 总页数显示
#prev-page        // 上一页按钮
#next-page        // 下一页按钮
```

**事件发出**:
- `ZOOM.IN/OUT` → 点击缩放按钮
- `NAVIGATION.PREVIOUS/NEXT` → 点击翻页按钮
- `NAVIGATION.GOTO` → 输入页码回车

#### UILayoutControls（ui-layout-controls.js）
**职责**:
- 管理布局按钮（旋转、滚动模式）
- 直接操作PDFViewerManager

### 5. 数据流示例

#### 场景1: 用户点击"下一页"按钮
```
用户点击#next-page
  ↓
UIZoomControls监听click事件
  ↓
EventBus.emit('NAVIGATION.NEXT')
  ↓
UIManagerCore监听NAVIGATION.NEXT
  ↓
pdfViewerManager.currentPageNumber = currentPage + 1
  ↓
PDFViewerManager设置PDF.js的currentPageNumber
  ↓
PDF.js触发pagechanging事件
  ↓
PDFViewerManager桥接 → EventBus.emit('PAGE.CHANGING', {pageNumber})
  ↓
UIManagerCore监听PAGE.CHANGING
  ↓
uiZoomControls.updatePageInfo(pageNumber, totalPages)
  ↓
更新页码输入框和显示
```

#### 场景2: 用户点击"放大"按钮
```
用户点击#zoom-in
  ↓
UIZoomControls监听click事件
  ↓
EventBus.emit('ZOOM.IN')
  ↓
UIManagerCore监听ZOOM.IN
  ↓
计算newScale = currentScale + 0.25
  ↓
pdfViewerManager.currentScale = newScale
  ↓
PDFViewerManager设置PDF.js的currentScale
  ↓
PDF.js触发scalechanging事件
  ↓
PDFViewerManager桥接 → EventBus.emit('ZOOM.CHANGING', {scale})
  ↓
UIManagerCore监听ZOOM.CHANGING
  ↓
uiZoomControls.setScale(scale)
  ↓
更新缩放百分比显示（如125%）
```

### 6. 技术栈

#### 前端框架
- **原生JavaScript** (ES6+)
- **Vite 5.0.0**: 开发服务器和构建工具
- **PDF.js 4.7.76**: PDF渲染引擎

#### 开发工具
- **Babel 7.28**: ES6+转译，支持私有类字段
- **Jest 30.1**: 单元测试
- **ESLint 9.34**: 代码检查

#### 设计模式
- **依赖注入**: SimpleDependencyContainer
- **事件驱动**: EventBus/ScopedEventBus
- **插件架构**: Feature-based
- **观察者模式**: EventBus订阅/发布
- **单例模式**: 各种Manager类

### 7. 兼容性策略

#### 渐进式迁移
项目同时保留新旧两套架构：

**新架构（Feature-based）**:
- `main.js` → `app-bootstrap-feature.js`
- `features/app-core/`
- `features/pdf-manager/`
- `features/ui-manager/`

**旧架构（保留用于回退）**:
- `app.js` → `bootstrap/app-bootstrap.js`
- `core/app-coordinator.js`
- 各种独立的Handler

#### 迁移路径
1. ✅ 创建Feature基础设施
2. ✅ 迁移app-core（EventBus、WebSocket）
3. ✅ 迁移pdf-manager（PDF加载管理）
4. ✅ 迁移ui-manager（UI渲染控件）
5. ⏳ 后续：bookmark、page-transfer等其他Features

### 8. 配置和环境

#### Vite配置（vite.config.js）
- 支持CommonJS模块（PDF.js兼容）
- 别名配置：`@pdfjs` → `pdfjs-dist`
- PDF.worker配置

#### 运行时配置
- `runtime-ports.json`: 端口配置
- URL参数:
  - `pdf`: 要加载的PDF文件名
  - `bookmark`: 是否启用书签（0禁用）

### 9. 测试策略

#### 单元测试
- Feature安装测试
- 组件功能测试
- 事件流程测试

#### 集成测试
- Feature依赖解析测试
- 跨Feature通信测试
- 完整用户流程测试

### 10. TypeScript类型定义

项目已引入完整的TypeScript类型定义，位于`types/`目录。虽然项目使用JavaScript编写，但通过`.d.ts`文件提供类型支持，为IDE提供智能提示和类型检查。

#### 类型定义结构
```typescript
types/
├── index.d.ts        # 统一导出入口
├── common.d.ts       # 通用类型（Logger、EventOptions、StateSnapshot）
├── events.d.ts       # 事件系统类型（EventBus、事件数据）
├── pdf.d.ts          # PDF模块类型（IPDFManager、IPDFLoader等）
├── ui.d.ts           # UI模块类型（IUIManager、IZoomControls等）
├── adapters.d.ts     # 适配器类型（WSClient、IWebSocketAdapter）
└── features.d.ts     # Feature架构类型（IFeature、IDependencyContainer等）
```

#### 核心类型接口
**Feature接口**
```typescript
export interface IFeature {
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  install(container: IDependencyContainer): Promise<void>;
  uninstall(): Promise<void>;
}
```

**依赖容器接口**
```typescript
export interface IDependencyContainer {
  register<T>(key: string, instance: T): void;
  resolve<T>(key: string): T | null;
  has(key: string): boolean;
  clear(): void;
  keys(): string[];
}
```

**事件总线接口**
```typescript
export interface EventBus {
  on<T>(event: string, callback: (data: T, metadata?: EventMetadata) => void, options?: EventOptions): () => void;
  emit<T>(event: string, data: T, metadata?: EventMetadata): void;
  off(event: string, callback?: Function): void;
  destroy(): void;
}
```

#### 使用方式
在JavaScript文件中通过JSDoc引用类型：
```javascript
/**
 * @typedef {import('../types').IFeature} IFeature
 * @typedef {import('../types').IDependencyContainer} IDependencyContainer
 */

/**
 * @implements {IFeature}
 */
export class MyFeature {
  // IDE会提供类型检查和智能提示
}
```

### 11. 未来规划

#### 待迁移Features
- **bookmark**: 书签功能域
- **page-transfer**: 页面传输功能
- **websocket-adapter**: WebSocket适配器

#### 架构优化
- ✅ 引入TypeScript类型定义（已完成）
- 完善依赖注入容器
- 优化事件溯源和调试
- 增强错误处理和恢复机制

---

**文档版本**: v1.1.0
**最后更新**: 2025-10-02
**维护者**: PDF Viewer Team
**变更日志**:
- v1.1.0 (2025-10-02): 添加TypeScript类型定义章节，更新目录结构
- v1.0.0 (2025-10-02): Feature-based架构文档初始版本
