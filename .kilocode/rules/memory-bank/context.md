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

---

## 2025-10-06 PDF书签WebSocket持久化 ✅ 完成

### 功能概述
实现PDF书签的远程持久化存储，前端书签通过WebSocket同步到后端数据库。

### 后端实现
- **PDFLibraryAPI 新增接口**:
  - `list_bookmarks(pdf_uuid)` - 查询书签并构建树形结构
  - `save_bookmarks(pdf_uuid, bookmarks, root_ids)` - 保存书签（支持覆盖）
  - 支持递归校验、排序、region 数据

- **WebSocket 服务器路由**:
  - `bookmark/list` - 列出书签
  - `bookmark/save` - 保存书签
  - 返回 `{bookmarks, root_ids}` / `{saved}` 数据结构

### 前端实现
- **BookmarkStorage 重构**:
  - 新增 `RemoteBookmarkStorage` 通过 WebSocket 持久化
  - `LocalStorageBookmarkStorage` 降级为缓存层
  - BookmarkManager 支持注入 `wsClient`

- **WSClient 增强**:
  - 新增 `request()` 方法统一请求/响应链路
  - `_settlePendingRequest` 处理异步响应

### 测试覆盖
- ✅ 119 个后端 API 测试
- ✅ 81 个 WebSocket 服务器测试
- ✅ 80 个前端存储测试

### 技术亮点
- 树形结构扁平化算法
- region 百分比坐标支持
- 事件驱动的前后端同步
- 完整的错误处理和边界情况覆盖

### 修改文件
13 个文件 (+1017, -101)

### 相关文档
- 详细工作日志: `AItemp/20251003181547-AI-Working-log.md`
- 页面跳转修复: `AItemp/20251003180103-AI-Working-log.md`
- 数据结构修复: `AItemp/20251003174421-AI-Working-log.md`

---

## 2025-10-05 数据库 Phase3（PDFInfo 表插件）
- ⏳ 阶段目标：完成数据库Phase3的首个数据表插件（PDFInfoTablePlugin），确保插件测试通过后继续实现文档中剩余功能。
- 当前状态：插件代码和测试已由上一轮开发完成但尚未复核，需要重新运行 `pytest src/backend/database/plugins/__tests__/test_pdf_info_plugin.py` 确认绿色。
- 关键路径：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-info.md`（包含字段约束、扩展方法、测试用例清单）。
  - 代码位置：`src/backend/database/plugins/pdf_info_plugin.py`（主实现）、`src/backend/database/plugins/__tests__/test_pdf_info_plugin.py`（单测）、`src/backend/database/plugins/__tests__/fixtures/pdf_info_samples.py`（样例数据，如存在）。
- 执行步骤（原子任务）：
  1. 阅读需求规范与现有实现，确认接口、事件、扩展查询覆盖的契合度。
  2. 运行上述pytest命令验证插件行为，若失败收集日志与失败案例。
  3. 根据需求文档补足缺失的功能/测试（例如高级查询、标签管理、统计等）。
  4. 测试全部通过后更新工作日志与memory bank，并准备继续Phase3后续（annotation/bookmark/search_condition）。
- 注意事项：所有文件读写显式UTF-8；遵循TablePlugin接口规范；开发前先补齐测试；如拆分多模块需考虑subagent。
## 当前任务 (2025-10-05 15:55)
- 合并 worktree A(feature-bookmark-fix) 与 worktree D(d-main-20250927) 到 main 分支
- 目标：同步侧边栏与 d-main 分支最新改动，保持主线最新
- 预计步骤：检查 git 状态 → 拉取两个分支最新提交 → 合并并解决冲突 → 基本验证
- 相关路径：worktree A=C:/Users/napretep/PycharmProjects/anki-linkmaster-A，worktree D=C:/Users/napretep/PycharmProjects/anki-linkmaster-D
### 2025-10-05 16:05 更新
- main 分支已合并 feature-bookmark-fix（f378ef4）与 d-main-20250927（399d04a），获取了 UI 布局优化与 PDF 卡片侧栏骨架
- d-main-20250927 新增 PDFCardFeature（卡片侧栏UI、feature.config、Sidebar注册时从容器延迟获取实例）已同步到主线
- 合并后保留反向链接侧栏占位（real-sidebars.js）及既有文档改动，需要后续功能实现时替换
- pnpm run test 受 WebGL/IndexedDB 依赖缺失影响失败（fake-indexeddb、canvas 未安装），后续定位前需补齐测试依赖


## 2025-10-05 数据库 Phase3（PDFAnnotation 表插件）
- ✅ 阶段目标：PDFAnnotationTablePlugin 已完成，支持截图 / 文本高亮 / 批注三类标注的建表、数据校验、CRUD、扩展查询、评论管理与事件发布。
- 当前状态：代码与测试位于 `src/backend/database/plugins/`；与 PDFInfo 插件联动（外键/事件）已验证通过。
- 关键资料：
  - 需求文档：`todo-and-doing/2 todo/20251005140340-backend-database-impl/v001-phase3-pdf-annotation.md`
  - 代码：`src/backend/database/plugins/pdf_annotation_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_annotation_samples.py`
- 主要实现要点：
  1. 数据验证区分 screenshot/text-highlight/comment 三类 payload，并校验 comments 数组。
  2. CRUD 及扩展方法（按 PDF/页码/类型查询、计数、批量删除、评论增删）。
  3. 事件统一使用 `table:pdf-annotation:*:*`，启用时订阅 `table:pdf-info:delete:completed` 实现级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` 共 76 项全部通过（含 pdf_info + pdf_annotation）。
- 后续衔接：继续 Phase3 其他表插件（bookmark / search_condition），复用同目录结构与事件命名规范。

## 2025-10-05 数据库 Phase3（PDFBookmark 表插件）
- ✅ 阶段目标：PDFBookmarkTablePlugin 已实现，支持层级书签、排序、递归扁平化与级联删除。
- 当前状态：`pdf_bookmark_plugin.py` 与测试、样例均落地，已通过插件测试全集（115 项）。
- 核心文件：
  - 代码：`src/backend/database/plugins/pdf_bookmark_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/pdf_bookmark_samples.py`
- 主要功能：
  1. 验证 `bookmark_id`、`pageNumber`、`region`、`children` 等字段，支持递归校验。
  2. CRUD + 扩展方法（按 PDF/页 查询、统计、批量删除、子节点增删、重排、扁平化）。
  3. 事件遵循 `table:pdf-bookmark:*:*`，监听 `table:pdf-info:delete:completed` 执行级联删除。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 115 Passed（含 info / annotation / bookmark 插件）。
- 后续衔接：Phase3 剩余表（search_condition）沿用相同目录与约定，注意事件命名和外键依赖。

## 2025-10-05 数据库 Phase3（SearchCondition 表插件）
- ✅ 阶段目标：SearchConditionTablePlugin 完成，实现筛选/排序条件的持久化、统计与事件发布。
- 当前状态：`search_condition_plugin.py`、测试与样例均落地，插件套件合计 144 用例全部通过。
- 核心文件：
  - 代码：`src/backend/database/plugins/search_condition_plugin.py`
  - 测试：`src/backend/database/plugins/__tests__/test_search_condition_plugin.py`
  - 样例：`src/backend/database/plugins/__tests__/fixtures/search_condition_samples.py`
- 主要功能：
  1. 支持 fuzzy / field / composite 三类条件递归校验，包含 sort_config 模式 0-3 验证。
  2. 扩展方法：`query_by_name`、`query_enabled`、`increment_use_count`、`set_last_used`、`activate_exclusive`、`query_by_tag`、`search_by_keyword`。
  3. 事件命名 `table:search-condition:*:*`，便于前端监听保存/更新/删除行为。
- 测试结论：`pytest src/backend/database/plugins/__tests__` → 144 Passed（info/annotation/bookmark/search_condition 全部插件）。
- 后续衔接：Phase3 已完成四个插件，可进入集成或 Stage4；若新增条件类型需在 `_validate_condition` 扩展。
## 当前任务 (2025-10-05 17:51)
- 目标：梳理并理解现有前后端通信链路，在保持统一消息协议的前提下设计与实现供前端调用的后端 API 层。
- 背景：数据库插件层（pdf_info/pdfs_annotation/pdf_bookmark/search_condition）已完成，需要通过统一通信架构向前端暴露受控接口。
- 相关模块：src/backend/pdfTable_server、src/backend/msgCenter_server、src/backend/database/plugins/*、src/backend/api/*、src/frontend/common/ws、src/frontend/pdf-home。
- 重要文档：docs/SPEC/SPEC-HEAD-communication.json、docs/SPEC/JSON-MESSAGE-FORMAT-001.md、todo-and-doing/2 todo/20250923184000-unified-communication-architecture/v001-spec.md。
### 拆解步骤
1. 阅读并整理现有通信架构代码/文档，明确消息流、事件命名及现有 API 空缺。
2. 根据数据库能力列出前端所需 API 场景，完成接口设计草案（消息类型、payload、响应结构）。
3. 为 API 层编写测试（优先覆盖查询/创建/更新/删除流程及错误分支）。
4. 实现 API 层代码，衔接数据库插件和通信层，确保事件发布/日志符合规范。
5. 运行测试并排查，确保新增逻辑与现有系统协同无回归。
6. 更新文档、memory bank 及工作日志，准备后续前端联调。

### 进展 2025-10-05 19:05
- 已实现 `PDFLibraryAPI`（数据库 → 前端）封装，提供 list/detail/update/delete/register_file 接口，并新增单元测试 `src/backend/api/__tests__/test_pdf_library_api.py`。
- WebSocket 服务器接入新 API：支持 `pdf/list` 消息、文件增删事件同步数据库并广播新版记录结构。
- 新逻辑保持原有 `pdf-home:get:pdf-list` 兼容，新增广播时同时发送旧版 `list` 与新版 `pdf/list`。
## 2025-10-05 PDF-Home 搜索端到端方案讨论
- 问题背景：前端 Search/Filter 组合目前在浏览器内对 @pdf-list/data:load:completed 缓存做模糊筛选，后端仅有 StandardPDFManager 基于文件列表的简易 search_files；数据库层尚未提供分词、筛选、排序一体化查询，无法满足一次 SQL 完成“搜索→筛选→排序”的要求。
- 相关模块：前端 src/frontend/pdf-home/features/search、src/frontend/pdf-home/features/filter、src/frontend/pdf-home/features/search-results；后端 src/backend/api/pdf_library_api.py、src/backend/msgCenter_server/standard_server.py、src/backend/pdfTable_server/application_subcode/websocket_handlers.py；数据库插件 pdf_info_plugin.py、search_condition_plugin.py。
- 现状评估：
  1. PDFLibraryAPI 已负责 pdf_info 记录映射但缺少搜索接口；pdf_info 表文本字段可通过 json_extract 访问，已有若干普通索引。
  2. FilterManager 能将 uzzy/field/composite 条件序列化；WS 常量已定义 pdf-home:search:pdf-files 但仍由旧 StandardPDFManager.search_files 处理。
  3. 搜索词拆分仅在前端按空格进行，无法满足“按非文本符号分割”的需求；也未对标签、笔记等字段做权重控制。
- 待解决要点：
  1. 设计多 token 匹配 + 权重排名 + 过滤约束的 SQL（可用 CTE + LOWER(... LIKE ?)/json_each 或引入 FTS5）并返回 match_score。
  2. 将 Filter 条件 JSON 翻译为 SQL where 子句（支持 AND/OR/NOT、标签包含、数值区间、布尔字段）。
  3. 统一消息流：Search/Filter 通过 WSClient 发出 pdf-home:search:pdf-files，StandardWebSocketServer 调用 PDFLibraryAPI.search_records，返回标准化结果事件供 SearchResults 渲染。
  4. 补齐测试：数据库层搜索单测、WebSocket handler 集成测，前端 SearchService/Jest 覆盖 payload 组装与结果派发。
- 下一步：编写详细方案文档，确认字段权重 & 排序策略，定义分页/排序 schema，并规划数据同步触发 FTS/索引更新。
- 用户确认前端搜索结果需要分页控件；方案需明确分页UI与请求参数。

### 2025-10-05 PDF-Home 排序面板修复
- 问题：排序按钮点击后无任何响应，原因是 pdf-sorter 功能域在安装阶段直接查找 DOM #sort-btn 并绑定 click，实际按钮由 SearchFeature 渲染且安装顺序靠后，导致绑定失败。
- 方案：改为监听全局事件 search:sort:clicked 与 header:sort:clicked 触发排序面板；仅当全局事件不可用时才启用 DOM 兜底，避免重复 toggle。
- 关键文件：src/frontend/pdf-home/features/pdf-sorter/index.js、src/frontend/pdf-home/features/pdf-sorter/__tests__/sorter-panel-events.test.js。
- 测试：pnpm test -- sorter-panel-events（覆盖 search/header 事件驱动排序面板展示）。
- 影响：排序面板与配置区可通过现有事件体系正常打开，未改变其他功能域事件命名，前端排序交互对齐架构规范。
### 2025-10-05 搜索任务拆分
- 已创建 6 个并行规格文档（todo-and-doing/2 todo/20251005195xxx-*），覆盖：
  1. 后端 LIKE SQL 搜索实现 20251005195000-pdf-search-like-sql
  2. WebSocket 搜索消息路由 20251005195100-pdf-search-ws-routing
  3. 前端 SearchService 重构 20251005195200-pdf-search-frontend-service
  4. 搜索结果分页 UI 20251005195300-pdf-search-pagination-ui
  5. 筛选条件序列化 20251005195400-pdf-search-filter-serialization
  6. 测试与 QA 覆盖 20251005195500-pdf-search-testing
- 关键决策：首版采用 LIKE + 多 token + CASE 权重方案，预留未来 FTS5 升级路径；前端必须通过 SearchService 统一发起请求并支持分页控件。
- 2025-10-05 21:00: 开始实施第一层 LIKE 搜索任务：目标是实现 PDFLibraryAPI.search_records、对应 SQL CTE、测试覆盖。

---

## 2025-10-06 加权排序公式构建器 (恢复)
- 背景: 用户回滚导致 WeightedSortEditor 回退为 textarea 版本，需重新交付按钮式构建器。
- 交付点:
  - 重写 `weighted-sort-editor.js`，提供字段/运算符/函数/数字面板按钮、令牌列表、函数参数提示、字段校验(`hasFieldReference`)；所有交互纯鼠标即可完成。
  - 恢复样式块（builder-chip、formula-token、number-pad 等），保证视觉反馈与布局。
  - 扩展 `feature.config.js` 的 `sortableFields`，涵盖书名/作者/关键词/备注/评分/复习次数/阅读时长/最后访问/截止日期等字段。
  - 同步 `SortManager` 公式上下文，追加 title/author/subject/keywords/notes/tags_count 等字段及 length/asc/desc/clamp/normalize 工具函数。
  - 新增 Jest 用例 `weighted-sort-editor.builder.test.js` 覆盖字段、函数、删除、事件 6 条交互路径。
- 测试: `pnpm test -- weighted-sort-editor.builder` ✅
- 后续: 如需支持撤销/重做或更多函数，可在当前令牌模型基础上扩展。

## 2025-10-06 搜索结果多列布局
- 背景: 用户希望在搜索结果区提供一栏/双栏/三栏多列视图切换按钮，纯前端控制展示。
- 实现: SearchResultsFeature 新增布局按钮 (layout-toggle)、本地偏好持久化与 `layout-single/layout-double/layout-triple` 容器类。
- 样式: search-results.css 引入网格布局与按钮样式；search-result-item 卡片高度填充、去除 margin；全局批量动作区域支持 wrap。
- 测试: `layout-toggle.test.js` 验证默认布局、按钮切换及 localStorage 恢复。

## 202510052139 标注卡片删除按钮
- 需求: 在标注侧边栏的卡片上新增删除按钮，统一触发 annotation 删除流程。
- 相关文件: src/frontend/pdf-viewer/features/annotation/components/annotation-sidebar-ui.js, 各工具 createAnnotationCard 实现。
- 约束: 按钮需复用现有删除事件 (PDF_VIEWER_EVENTS.ANNOTATION.DELETE)，遵循侧边栏样式规范。
- 原子任务:
  1. 梳理卡片渲染入口，决定统一处理或分工具扩展。
  2. 实现删除按钮 DOM & 事件，调用公共删除逻辑。
  3. 更新 UI/测试，验证操作。

## 202510052150 标注UI表情优化
- 需求: 在标注插件系统UI（侧边栏工具按钮、卡片按钮、快捷操作按钮等）使用Unicode表情取代纯文字标识。
- 关注范围: annotation-sidebar-ui, tools下的按钮, text-selection-quick-actions。
- 注意: 保留tooltip解释文字，确保表情含义直观。

### 2025-10-06 PDF-Home 添加流程回归
- 后端：`PDFLibraryAPI.add_pdf_from_file` 统一生成 12 位十六进制 UUID，并优先通过 `PDFLibraryAPI` 路径完成数据库写入；失败时回滚 `StandardPDFManager`，并保留旧 JSON 流程兜底。
- 同步更新 `StandardPDFManager._build_standard_file_info`，补充 `filepath`、`original_path`、`created_time/modified_time` 等字段以满足注册器校验。
- 新增 `DummyPDFManager` 测试桩覆盖成败分支，确保回退模式（禁用 pdf_manager）仍可落表。
- 前端 `pdf-list` 监听 `websocket:message:response` 时补充错误提示与单文件添加成功提示，用户可见反馈更加明确。
- 测试：`python -m pytest` 运行 `test_add_pdf_from_file_uses_pdf_manager`、`test_add_pdf_from_file_without_manager_inserts_record`、`test_add_pdf_from_file_propagates_manager_error`。
- WebSocket 服务器在处理 `pdf-home:add:pdf-files` 时优先调用 `PDFLibraryAPI`，失败将透传 `StandardPDFManager` 返回的实际错误文案，避免前端出现"上传失败"泛化提示。
- 调整 `PDFManager.add_file` 失败分支，直接抛出"文件已存在于列表中"，便于前端获得具体原因。

## 2025-10-06 新任务：pdf-home 搜索功能（v001）后端打通
- 任务背景：仅实现 search（不含 filter/sort）。输入按空格分词，多字段 LIKE 模糊匹配，字段默认包含 title/author/filename/tags/notes/subject/keywords，后续可配置。结果展示在 pdf-home 搜索结果列表。
- 相关模块/函数：
  - 前端：
    - SearchFeature（搜索 UI 与桥接）：src/frontend/pdf-home/features/search/index.js:1
    - SearchManager（请求/响应处理）：src/frontend/pdf-home/features/search/services/search-manager.js:1
    - SearchResultsFeature（渲染）：src/frontend/pdf-home/features/search-results/index.js:1
    - WSClient（发送/接收）：src/frontend/common/ws/ws-client.js:1
  - 后端：
    - 标准 WS 服务器：src/backend/msgCenter_server/standard_server.py:1（handle_pdf_search_v2）
    - API 门面：src/backend/api/pdf_library_api.py:269（search_records）
    - DB 插件：src/backend/database/plugins/pdf_info_plugin.py:480（search_records）
- 消息契约（v001）：
  - 请求：{ type: 'pdf/search', request_id, data: { search_text, search_fields?, include_hidden?, limit?, offset? } }
  - 响应：{ type: 'pdf/search', status: 'success'|'error', data: { records, count, search_text }, request_id }
- 原子步骤（v001）：
  1) 架构梳理与协议校验（步骤01）
  2) 后端 WS 路由与 API 打通（步骤02）
  3) 数据库搜索插件校验与用例（步骤03）
  4) 前端集成与事件流验证（步骤04）
  5) E2E 场景与验收测试（步骤05）
  6) 日志与诊断（步骤06）
- 参考规范：src/frontend/pdf-home/docs/SPEC/SPEC-HEAD-PDFHome.json:1；所有文件 I/O 必须显式 UTF-8，换行 \n。
- 备注：保留旧路径 pdfTable_server::'pdf-home:search:pdf-files' 兼容，不在本次修改范围。

## 2025-10-06 搜索实现执行记录（v001 实施）
- 代码变更：
  - 后端 DB：`src/backend/database/plugins/pdf_info_plugin.py:search_records`
    - 默认字段增加 `subject`、`keywords`
    - 所有 LIKE 条件添加 `ESCAPE '\\'`，并对 `%`、`_` 做转义，避免通配误匹配
  - 前端：`src/frontend/pdf-home/features/search/services/search-manager.js`
    - `search_fields` 默认包含 `subject`、`keywords`，提升首版检索覆盖面
- 测试：新增 `src/backend/database/plugins/__tests__/test_pdf_info_plugin_search_records.py`
  - 覆盖多关键词 AND、JSON 字段、tags、LIKE 转义与分页
  - 本地 `pytest` 通过
- 结论：pdf-home 基础搜索前后端链路符合 v001 规格；后端 SQL 转义更稳健，前端字段更全面。

## 2025-10-06 搜索语义更新
- 搜索语义明确为：空格 = 且（AND）。例如：`A B` 表示返回同时包含 `A` 与 `B` 的记录。
- 实现位置：
  - 后端：`PDFInfoTablePlugin.search_records` 对多个关键词使用 AND 连接，字段内 OR。
  - 前端：`SearchBar` 占位提示文案更新为"空格=且"。

## 2025-10-06 pdf-home 最近搜索插件（v1）
- 任务目标：实现侧边栏 RecentSearches 插件，记录并显示最近的搜索关键字，点击可再次发起搜索。
- 相关模块/文件：
  - 前端：
    - 插件类：`src/frontend/pdf-home/features/sidebar/recent-searches/index.js:1`
    - 插件配置：`src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js:1`
    - 样式：`src/frontend/pdf-home/features/sidebar/recent-searches/styles/recent-searches.css:1`
    - 容器：`src/frontend/pdf-home/features/sidebar/components/sidebar-container.js:1`（提供 DOM 容器）
  - 事件：
    - 全局监听：`search:query:requested`（与 SearchFeature 保持一致）
    - 本地触发：`search:clicked`、`limit:changed`
  - 本地存储：
    - 历史键名：`pdf-home:recent-searches`
    - 显示条数键名：`pdf-home:recent-searches:display-limit`
- 事件流：
  1) 用户在 SearchBar 输入并触发搜索 → 全局事件 `search:query:requested`
  2) RecentSearches 监听事件，写入/去重/上移并保存到 LocalStorage → 渲染列表
  3) 用户点击某条历史 → 插件发出本地 `search:clicked` + 全局 `search:query:requested`，驱动重新搜索
- UI：
  - 列表容器：`#recent-searches-list`（由 SidebarContainer 预先渲染）
  - 标题处附加“显示 N”下拉（5/10/20/50），更新显示条数并持久化
  - 空列表显示“暂无搜索记录”占位
- 原子步骤：
  1) 读取规范、确认事件名（三段式）与容器 DOM
  2) 先写 Jest 单测：存取、渲染、点击回放、去重置顶
  3) 实现插件：存储读写、渲染、事件桥接、显示条数
  4) 打开 Feature Flag：`recent-searches=true`
  5) 更新文档与工作日志
- 结果：
  - 新增测试：`src/frontend/pdf-home/features/sidebar/recent-searches/__tests__/recent-searches.test.js:1`
  - 实现逻辑：`index.js` 完成；`feature.config.js` 事件名与 SearchFeature 对齐
  - Feature Flag 已启用：`src/frontend/pdf-home/config/feature-flags.json:101`
  - 不涉及后端改动

## 2025-10-06 搜索消息类型兼容修复（已改为仅保留 v1）
- 现象：点击搜索出现“未知的消息类型: pdf/search”。
- 根因：当前运行的后端 `pdfTable_server` 仅识别旧类型 `pdf-home:search:pdf-files`，并统一以 `type=response` 返回；前端 `SearchManager` 发送了新类型 `pdf/search` 且仅处理新协议响应，导致报错。
- 最终决定：完全移除 v2（`pdf/search`）支持，只保留 v1：
  - 前端 SearchManager 仅发送 `pdf-home:search:pdf-files`（顶层 `search_text`），仅解析 `websocket:message:response`，读取 `data.files/total_count/search_text`。
  - 后端 MsgCenter 仅路由 `pdf-home:search:pdf-files` 并返回标准 `response` 包。
  - 移除了前端“协议自动适配/回退/记忆”等逻辑。
  - 受影响文件：
    - `src/frontend/pdf-home/features/search/services/search-manager.js:1`（删除 v2 相关逻辑）
    - `src/backend/msgCenter_server/standard_server.py:1`（仅保留 v1 搜索路由）
  - 预期：不会出现“未知的消息类型: pdf/search”；只有 v1 搜索链路生效。

## 2025-10-06 MsgCenter 搜索路由补全（standard_server）
- 现象：MsgCenter 日志显示对 `pdf-home:search:pdf-files` 与 `pdf/search` 均返回 `response`，且 message 为“未知的消息类型: ...”。
- 原因：`src/backend/msgCenter_server/standard_server.py` 未实现这两类搜索消息的路由分支，走了默认 unknown_message_type 分支。
- 处理：
  - 新增 `handle_pdf_search_request()`，支持两种消息：
    - v1: `pdf-home:search:pdf-files`（顶层 `search_text`）→ 返回标准 `response` 包，`data={ files, total_count, search_text, original_type }`
    - v2: `pdf/search`（`data.search_text` 等）→ 返回类型化消息 `type='pdf/search'`，`data={ records, count, search_text }`
  - 搜索实现优先使用 `pdf_library_api.search_records()`（若注入），否则回退到 `PDFManager` 内存搜索（空搜索=全部）。
- 受影响文件：`src/backend/msgCenter_server/standard_server.py:1`（新增分支与处理方法）
- 结果：前端不会再收到“未知的消息类型: pdf/search|pdf-home:search:pdf-files”的错误；`SearchManager` 的 v1/v2 双协议解析均可正常工作。

## 2025-10-06 PDF-Home 最近搜索长期存储（进行中）
### 问题与背景
- 目前 pdf-home 的“最近搜索”仅存于 LocalStorage，无法跨环境/长期保存。
- 目标：将最近搜索改为长期存储到文件 `data/pdf-home-config.json` 的 `recent_search` 字段，并在前端定期（防抖）推送更新。

### 涉及模块与文件
- 前端：`src/frontend/pdf-home/features/sidebar/recent-searches/index.js`
  - 安装时先从 localStorage 读取，再发送 `pdf-home:get:config` 请求，收到回执覆盖本地并渲染。
  - 每次新增/置顶搜索后，300ms 防抖发送 `pdf-home:update:config`，payload 中包含 `recent_search` 数组（元素形如 `{ text, ts }`）。
- 前端事件常量：`src/frontend/common/event/event-constants.js:WEBSOCKET_MESSAGE_TYPES`
  - 新增 `GET_CONFIG`、`UPDATE_CONFIG`。
- 后端：`src/backend/pdfTable_server/application_subcode/websocket_handlers.py`
  - 新增 `handle_get_config`、`handle_update_config`。
  - 配置文件路径：`data/pdf-home-config.json`（UTF-8 + 换行 `\n`）。

### 执行步骤（原子任务）
1. 新增事件常量（前端）
2. 编写前端单测（安装请求、更新发送、回执覆盖）
3. 改造 RecentSearchesFeature 读/写后端（含防抖）
4. 增加后端 WS 处理器（UTF-8 文件读写）
5. 运行前端测试并修正
6. 记录日志并通知完成

### 注意事项
- 文件读写统一使用 `encoding='utf-8'`，写入需 `newline='\n'`，JSON `ensure_ascii=False`。
- 事件命名严格 `module:action:object` 三段式。
- 仍保留 localStorage 作为 UI 立即可用的本地缓存；后端回执为权威数据源，覆盖本地。
- WebSocket 连接时序：Feature 安装可能早于 WS 连接建立；已修复 WSClient `#flushMessageQueue()` 保留完整消息（含 `request_id`），避免队列消息回执无法关联。

---

## 2025-10-06 任务：pdf-home“阅读”按钮直连打开 pdf-viewer（不经 launcher）

- 背景：用户要求在 pdf-home 中，对选中的搜索结果批量打开 pdf-viewer 主窗体；通过参数传递所需端口；关闭 pdf-home 时关闭这些子窗口；统一由字典管理。
- 相关模块/函数：
  - 前端：
    - `src/frontend/pdf-home/features/search-results/index.js` 为 `.batch-btn-read` 绑定点击，收集 `.search-result-checkbox:checked` 的 `data-id`，通过 QWebChannel 调用 PyQt。
    - `src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js` 新增 `openPdfViewers({ pdfIds })`。
  - PyQt（pdf-home）：
    - `src/frontend/pdf-home/pyqt-bridge.py` 新增 `openPdfViewers(pdf_ids:list)`，读取 `logs/runtime-ports.json`（UTF-8）获得 `vite_port/msgCenter_port/pdfFile_port`，实例化 `src/frontend/pdf-viewer/pyqt/main_window.py::MainWindow`，构建 URL 并 `show()`；维护 `parent.viewer_windows` 字典。
    - `src/frontend/pdf-home/main_window.py` 新增 `viewer_windows` 字典；在 `closeEvent` 中依次关闭已登记的子窗口，并写入 `logs/window-close.log`（UTF-8, `\n`）。
  - 纯函数与测试：
    - `build_pdf_viewer_url(vite, ws, pdf, pdf_id, page_at?, position?)`（pyqt-bridge.py 顶层函数）
    - `src/frontend/pdf-home/__tests__/test_pyqt_bridge_url.py` 覆盖 URL 构建与编码/范围限制
- 约束与偏离说明：
  - 规范建议统一通过 `ai_launcher.py` 管理窗口与端口；本任务按用户要求在 pdf-home 内直接启动 pdf-viewer 窗口（不经 launcher）。
  - 端口来源依然遵循 `logs/runtime-ports.json` 作为单一真相源，确保与现有服务保持一致。
- 原子步骤：
  1) 先编写并通过 URL 构建函数的单元测试
  2) 增加 PyQt 桥接方法与窗口管理字典
  3) 前端按钮绑定与 QWebChannel 桥接打通
  4) 在 closeEvent 中关闭子窗口并清理
  5) 更新记忆库与工作日志
- 风险控制：
  - 多窗口 JS 调试端口冲突 → 简单按 `9223 + 已开窗口数` 线性分配；后续可引入端口检测器。
  - 重复打开同一 pdf-id → 代码优先激活已存在窗口而非重复创建。
### 2025-10-06 更新：pdf-home 启动 viewer 的 has_host 标记
- 为避免子窗体关闭影响宿主：
  - 在 `src/frontend/pdf-viewer/pyqt/main_window.py` 增加 `has_host` 参数，默认 False。
  - 当 `has_host=True` 时，`closeEvent` 跳过 `ai_launcher.py stop`，仅做前端进程跟踪清理与日志。
- 在 `src/frontend/pdf-home/pyqt-bridge.py` 中：
  - 打开 viewer 时传入 `has_host=True`。
  - 解析 pdf-id → 文件路径（复用 viewer/launcher 的 resolver），URL 附带 `file` 参数以确保启动即加载。