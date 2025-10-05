# Memory Bank（精简版 / 权威）

## 总体目标
- 前端（pdf-home、pdf-viewer）为纯 UI 模块，复用共享基础设施（EventBus / Logger / WSClient），仅在必要时通过 QWebChannel 与 Python 通信。
- 后端分三类：WebSocket 转发器（仅收发转发）、HTTP 文件服务器（仅文件传输）、PDF 业务服务器（独立、接收指令执行业务）。
- 日志分层：前端控制台经 DevTools 捕获写入 UTF-8 文件；后端统一用 Python logging（文件覆盖写，UTF-8）。
- AI Launcher 模块化：服务短小、可 start/stop/status，模块可独立运行与测试。

## 统一规范
- 目录命名：统一 kebab-case（示例：`pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 文件 I/O：所有读写显式 UTF-8；确保换行 `\n` 正确。
- 前端依赖：统一使用 `src/frontend/common/*`（EventBus / Logger / WSClient）。

---

## ⚠️ 前端开发核心规范（必读）

### 1️⃣ Logger 日志系统（强制使用）

**❌ 严禁使用**: `console.log` / `console.info` / `console.warn` / `console.error`
**✅ 必须使用**: 项目的 Logger 系统

**位置**: `src/frontend/common/utils/logger.js`

**基本用法**:
```javascript
import { getLogger, LogLevel } from '../common/utils/logger.js';

// 获取模块专属 logger（推荐使用 getLogger，会自动缓存实例）
const logger = getLogger('ModuleName');

// 使用日志
logger.debug('调试信息', extraData);      // 调试级别
logger.info('一般信息', extraData);       // 信息级别
logger.warn('警告信息', extraData);       // 警告级别
logger.error('错误信息', errorObject);   // 错误级别
logger.event('event:name', 'action', data); // 事件日志
```

**为什么必须使用 Logger**:
1. 统一日志格式，便于调试和追踪问题
2. 支持日志级别控制，生产环境可关闭 debug 日志
3. 日志会被保存到文件，便于事后分析
4. 防止敏感信息泄露（Logger 会过滤私有属性）
5. 与 PyQt 集成，前后端日志统一管理

---

### 2️⃣ 项目启动方法（必须遵守）

**⚠️ 严禁直接运行**: `npm run dev` 或 `python app.py` 等命令！
**✅ 必须使用**: `ai_launcher.py` 脚本管理项目启动和停止

**正确启动方式**:
```bash
# 启动 PDF-Home 模块（文件管理界面）
python ai_launcher.py start --module pdf-home

# 启动 PDF-Viewer 模块（查看器）
python ai_launcher.py start --module pdf-viewer --pdf-id sample

# 检查服务状态
python ai_launcher.py status

# 查看运行日志
python ai_launcher.py logs

# 停止所有服务
python ai_launcher.py stop
```

**为什么必须使用 ai_launcher.py**:
1. 自动管理多个服务的启动顺序（Vite、WebSocket、HTTP服务器）
2. 自动检测端口冲突，避免启动失败
3. 后台运行，不阻塞终端，支持 AI 自动化开发
4. 统一日志管理，所有服务日志集中输出
5. 一键停止所有服务，避免遗留进程

---

### 3️⃣ EventBus 事件命名规范（严格遵守）

**格式**: `{module}:{action}:{status}` （必须正好3段，用冒号分隔）

**✅ 正确示例**:
```javascript
'pdf:load:completed'          // PDF加载完成
'bookmark:create:requested'   // 请求创建书签
'sidebar:open:success'        // 侧边栏打开成功
'annotation:delete:failed'    // 删除批注失败
```

**❌ 错误示例（绝对禁止）**:
```javascript
'loadData'                    // ❌ 缺少冒号
'pdf:list:data:loaded'        // ❌ 超过3段
'pdf_list_updated'            // ❌ 使用下划线
'onButtonClick'               // ❌ 驼峰命名
'pdf:loaded'                  // ❌ 只有2段
```

**规则**:
- module: 模块名称（小写，用连字符，如 `pdf-list`, `pdf-viewer`）
- action: 动作名称（小写，用连字符，如 `load`, `toggle`, `refresh`）
- status: 状态（`requested`/`completed`/`failed`/`success`/`error` 等）

**⚠️ 不符合格式会导致 EventBus 验证失败，代码无法运行！**

---

### 4️⃣ 局部事件 vs 全局事件（严格区分）

#### 🔹 局部事件（Feature内部通信）
**使用方法**: `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`
- 仅在同一Feature内传递
- 其他Feature **无法**监听

```javascript
// ✅ 正确：Feature内部事件
class MyFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 发布局部事件
    scopedEventBus.emit('data:load:completed', data);
    // 实际事件名: @my-feature/data:load:completed

    // 监听局部事件
    scopedEventBus.on('ui:refresh:requested', (data) => {
      this.#refreshUI(data);
    });
  }
}
```

#### 🌐 全局事件（Feature间跨模块通信）
**使用方法**: `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀
- 所有Feature都可以监听
- 用于跨模块通信

```javascript
// ✅ 正确：跨Feature通信
class BookmarkFeature {
  async install(context) {
    const { scopedEventBus } = context;

    // 发布全局事件（其他Feature可监听）
    scopedEventBus.emitGlobal('pdf:bookmark:created', bookmark);

    // 监听全局事件（来自其他Feature）
    scopedEventBus.onGlobal('pdf:file:loaded', (data) => {
      this.#loadBookmarks(data);
    });
  }
}
```

**❌ 常见错误**:
```javascript
// ❌ 错误：混用局部和全局
scopedEventBus.emit('pdf:file:loaded', data);  // 应该用 emitGlobal
scopedEventBus.on('pdf:file:loaded', handler);  // 应该用 onGlobal

// ❌ 错误：监听全局事件时使用了带命名空间的名称
scopedEventBus.onGlobal('@my-feature/data:loaded', handler);  // 不需要命名空间
```

---

### 5️⃣ Feature 开发标准流程（严格遵守）

**📖 完整文档**: `src/frontend/HOW-TO-ADD-FEATURE.md`

**第一步：创建Feature类结构**
```javascript
export class MyFeature {
  // 私有字段（使用 # 前缀）
  #eventBus;
  #container;
  #logger;

  /** 功能名称 - 必须实现 */
  get name() {
    return 'my-feature';  // kebab-case，小写+连字符
  }

  /** 版本号 - 必须实现 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的功能 - 必须实现 */
  get dependencies() {
    return ['app-core'];  // 声明依赖的其他Feature
  }

  /** 安装功能 - 必须实现 */
  async install(context) {
    const { globalEventBus, scopedEventBus, logger, container } = context;

    this.#eventBus = scopedEventBus;  // 优先使用 scopedEventBus
    this.#container = container;
    this.#logger = logger;

    // 初始化逻辑...
    logger.info(`${this.name} installed successfully`);
  }

  /** 卸载功能 - 必须实现 */
  async uninstall(context) {
    // 清理资源...
    this.#logger.info(`${this.name} uninstalled`);
  }
}
```

**第二步：在Bootstrap中注册**
```javascript
// 文件: bootstrap/app-bootstrap-feature.js
import { MyFeature } from '../features/my-feature/index.js';

// 注册Feature
registry.register(new MyFeature());
```

**第三步：声明依赖关系**
```javascript
// ✅ 正确：在dependencies中声明
get dependencies() {
  return ['pdf-manager', 'annotation'];  // 依赖这两个Feature
}

// ❌ 错误：直接import其他Feature
import { PDFManagerFeature } from '../pdf-manager/index.js';  // 禁止！
```

---

### 6️⃣ 依赖注入规范（禁止硬编码）

**✅ 正确方式：通过Container获取依赖**
```javascript
class MyFeature {
  async install(context) {
    const { container } = context;

    // 从容器获取依赖
    const pdfManager = container.get('pdfManager');
    const navigationService = container.get('navigationService');

    if (!pdfManager) {
      this.#logger.warn('PDFManager not found');
      return;
    }
  }
}
```

**❌ 错误方式：硬编码依赖**
```javascript
// ❌ 禁止：直接import其他Feature
import { PDFManager } from '../pdf-manager/pdf-manager.js';

// ❌ 禁止：访问全局变量
const manager = window.pdfManager;

// ❌ 禁止：直接new实例
const service = new NavigationService();
```

---

### 7️⃣ 功能域模块化架构

**架构定义**: pdf-home和pdf-viewer采用统一的功能域模块化架构，每个功能作为独立可插拔模块。

**📖 深度解析**: `src/frontend/ARCHITECTURE-EXPLAINED.md`

**核心开发原则**:
1. **功能域隔离**
   - 每个Feature必须是独立目录 (`features/功能名/`)
   - Feature内部结构: `index.js`(入口) + `components/` + `services/` + `events.js`

2. **事件驱动通信**
   - Feature之间只能通过EventBus通信，禁止直接引用
   - 所有事件定义集中在 `common/event/constants.js`

3. **依赖注入**
   - Feature依赖必须通过DependencyContainer注入
   - 在`feature.config.js`声明依赖
   - 禁止直接import其他Feature的代码

**严格禁止**:
- ❌ Feature之间直接调用函数或访问属性
- ❌ 在Feature内部创建全局变量
- ❌ 硬编码依赖其他Feature的路径
- ❌ 绕过EventBus直接操作DOM或状态
- ❌ 复制粘贴代码，应提取到common/或创建新Feature

---

### 8️⃣ 重要参考文档

1. **添加新Feature** → `src/frontend/HOW-TO-ADD-FEATURE.md`
2. **EventBus完整指南** → `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md`
3. **架构深度解析** → `src/frontend/ARCHITECTURE-EXPLAINED.md`
4. **事件追踪调试** → `src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md`

## 模块职责
- pdf-home：列表/选择/动作的 UI；QWebChannel 前端侧管理；前端日志 → `logs/pdf-home-js.log`。
- pdf-viewer：渲染与控件 UI；按 pdf_id 输出日志 → `logs/pdf-viewer-<pdf-id>-js.log`；✅ **已完成重构 (2025-09-26)**。
- WebSocket 转发器：`src/backend/websocket/standard_server.py`（headless，仅路由）。
- HTTP 文件服务器：`src/backend/http_server.py`（仅文件传输，支持 Range，UTF-8 日志）。
- PDF 业务服务器（待实现）：`src/backend/services/pdf_business_server.py`（建议路径）。
- AI Launcher：`ai-scripts/ai_launcher/*`（ServiceManager / ProcessManager / CLI / 示例服务）。

## 现状快照（最近更新）
### 已完成（近期）
- ✅ **PDF中文渲染修复** (2025-09-30): 使用Vite别名@pdfjs简化CMap和标准字体路径。
- ✅ **PDF-Home添加/删除功能** (2025-10-01): 完整文件管理流程。参考提交: bf8b64d。
- ✅ **PDF-Viewer搜索按钮修复** (2025-10-03): 修复Feature架构缺陷，实现依赖注入。
- ✅ **侧边栏统一管理** (2025-10-04): SidebarManagerFeature + 流动布局 + 宽度拖拽。
- ✅ **插件隔离架构改进** (2025-10-04): EventBus规范、依赖注入完善。文档: EVENTBUS-USAGE-GUIDE.md。
- ✅ **数据库 Phase3** (2025-10-05): 四大插件完成（PDFInfo/Annotation/Bookmark/SearchCondition）。144个测试通过。
- ✅ **高亮标注交互增强** (2025-10-05): 悬停工具栏（删除/复制/换色/跳转/翻译）。
- ✅ **文本选择快捷操作** (2025-10-05): 非标注模式下四按钮（复制/标注/翻译/AI）。

### 待办（优先级）
- [ ] 实现最小版 PDF 业务服务器并接入 WS 转发。
- [ ] 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
- [ ] 为 Launcher 增加健康检查与 E2E 脚本。
- [ ] **PDF-Home 搜索端到端实施** (进行中，见下方)。

## 已知问题
### PDF列表双重更新 (2025-09-28)
- **描述**: `pdf:list:updated` 事件被触发两次。
- **根因**: PDFManager 的 `handleResponseMessage` 在处理响应时，如果包含 files 数组但没有 batch_id，会再次请求列表。
- **修复**: 在 `websocket-handler.js:215` 排除 `get_pdf_list` 类型响应。
- **验证**: 日志分析脚本 `AItemp/tests/analyze-get-pdf-list.ps1`。

---

## 2025-10-05 数据库 Phase3 - 四大插件 ✅ 完成
### 已完成插件
1. **PDFInfoTablePlugin** - PDF基础信息（标题/作者/标签/评分/统计）
2. **PDFAnnotationTablePlugin** - 标注管理（截图/高亮/批注/评论）
3. **PDFBookmarkTablePlugin** - 书签管理（层级/排序/递归/级联删除）
4. **SearchConditionTablePlugin** - 搜索条件（fuzzy/field/composite/排序配置）

### 测试覆盖
- 144 个单元测试全部通过
- 核心文件: `src/backend/database/plugins/`、`src/backend/database/plugins/__tests__/`
- 需求文档: `todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-*.md`

---

## 2025-10-05 PDF-Home 搜索端到端方案（进行中）
### 任务目标
前后端协同实现完整的搜索→筛选→排序→分页流程，替代现有浏览器内前端筛选。

### 现状评估
- ✅ PDFLibraryAPI 已有基础 CRUD
- ✅ 数据库插件层完成（pdf_info/search_condition）
- ❌ 缺少 `search_records` 接口（LIKE + 权重 + 筛选 + 排序 + 分页）
- ❌ WebSocket 路由未接入新搜索API
- ❌ 前端搜索未统一到 SearchService

### 拆分任务（6个并行规格）
1. **后端 LIKE SQL 搜索** (20251005195000) - PDFLibraryAPI.search_records + CTE查询 + 权重排序
2. **WebSocket 搜索路由** (20251005195100) - StandardWebSocketServer 接入新API
3. **前端 SearchService 重构** (20251005195200) - 统一请求入口 + payload 组装
4. **搜索结果分页 UI** (20251005195300) - 分页控件 + 页码/总数显示
5. **筛选条件序列化** (20251005195400) - Filter → SQL WHERE 子句
6. **测试与 QA 覆盖** (20251005195500) - 数据库/WebSocket/前端三层测试

### 技术决策
- 首版采用 **LIKE + 多 token + CASE 权重方案**（预留 FTS5 升级路径）
- 字段权重: title(10) > author(5) > keywords(3) > notes(2) > subject(1)
- 分页参数: `page`、`page_size`（默认 50）
- 返回结构: `{ records, total, page: { current, size, total_pages }, meta }`

### 进展
- ✅ 2025-10-05 21:00: 开始实施第一层 LIKE 搜索任务
- ✅ 排序面板修复: 改用全局事件 `search:sort:clicked` 触发，避免 DOM 绑定失败

### 关键文件
- 后端: `src/backend/api/pdf_library_api.py`、`src/backend/msgCenter_server/standard_server.py`
- 前端: `src/frontend/pdf-home/features/search/`、`src/frontend/pdf-home/features/filter/`
- 规格: `todo-and-doing/2 todo/20251005195xxx-*/`

---

## 2025-10-05 标注系统优化
### 高亮标注悬停工具栏 ✅ 完成
- **功能**: hover 高亮显示工具栏（删除/复制/换色/跳转/翻译）
- **实现**: HighlightActionMenu + HighlightRenderer 包围盒 + 颜色更新接口
- **测试**: highlight-action-menu.test.js + text-highlight-tool.test.js

### 文本选择快捷操作 ✅ 完成
- **功能**: 非标注模式下监听文本选择，弹出四按钮（复制/标注/翻译/AI）
- **实现**: TextSelectionQuickActionsFeature + selection-utils + quick-actions-toolbar
- **修复**: 复制后清空选择，避免工具栏重复定位

### Annotation 事件治理 ✅ 完成
- **问题**: 事件命名不规范、数据契约不一致、缺少常量定义
- **改进**:
  1. ScopedEventBus 替代 globalEventBus，区分局部/全局事件
  2. PDF_VIEWER_EVENTS 补充导航/侧边栏/通知常量
  3. 所有工具统一使用事件常量（删除 `id` 参数、跳转使用导航常量）
  4. 测试同步更新

### 标注UI表情优化（进行中）
- **需求**: 侧边栏工具按钮、卡片按钮使用 Unicode 表情
- **范围**: annotation-sidebar-ui、tools/、text-selection-quick-actions
- **注意**: 保留 tooltip 文字说明

---

## Worktree 状态（2025-10-06）
### Worktree A (feature-bookmark-fix) - 📚 书签API
- **功能**: `list_bookmarks()` + `save_bookmarks()` 完整实现
- **测试**: roundtrip + 树形结构 + region 完整性 ✅
- **状态**: 90% 完成，待提交

### Worktree B (feature/pdf-home-add-delete-improvements) - 🔍 搜索API
- **功能**: `search_records(payload)` 高级搜索（LIKE + 筛选 + 排序 + 分页）
- **测试**: 完整测试套件 9ac3385 ✅
- **状态**: 95% 完成，已合并到 main

### Worktree D (d-main-20250927) - ⚡ 数据库优化
- **功能**: 5个 LOWER() 索引（title/author/notes/keywords/subject）
- **性能**: 搜索提升 50-200%
- **状态**: 100% 完成，已合并到 main

---

## 历史任务归档
2025-09-27 到 2025-10-04 的已完成任务已移至 `context-archive-20251006.md`，包括：
- AI重复开发问题分析
- PDF.js 性能优化研究
- PDF-Viewer 模块拆分方案
- 日志系统清理
- QWebChannel 初始化分析
- pdf-viewer 架构重构 v002
- PDF 记录编辑功能
- 标注功能模块化（Phase 0-1）
- CommentTool Bug 修复系列

查看历史详情请参考归档文件。
