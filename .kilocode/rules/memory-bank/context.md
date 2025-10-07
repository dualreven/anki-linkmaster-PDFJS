# Memory Bank（精简版 / 权威）

 
## 当前任务（20251007190618）
- 名称：实现 pdf-home 侧边栏“最近阅读”（visited_at 降序）
- 问题背景：
  - 侧边栏 recent-opened 子功能为空实现，无法展示最近阅读列表；
  - 需求：按 visited_at 字段降序获取前 N 条记录显示书名；点击任一项，等同于“搜索全部内容，并按 visited_at 降序排列”。
- 相关模块与函数：
  - 前端：
    - `src/frontend/pdf-home/features/sidebar/recent-opened/index.js`（本次实现：请求、渲染、交互）
    - `src/frontend/pdf-home/features/sidebar/components/sidebar-container.js`（容器 DOM）
    - `src/frontend/pdf-home/features/search/services/search-manager.js`（需扩展：透传 sort/pagination）
    - `src/frontend/common/event/event-constants.js`（消息常量）
  - 后端：
    - `src/backend/msgCenter_server/standard_server.py::handle_pdf_search_request`（标准搜索）
    - `src/backend/api/pdf_library_api.py::search_records`（支持 payload.sort / pagination.limit=0）
- 执行步骤（原子化）：
  1) 设计测试：
     - 安装 RecentOpened 时，发送 `pdf-library:search:requested`，data.sort 包含 `{field:'visited_at',direction:'desc'}`，pagination.limit=显示条数
     - 收到 `search:completed` 响应后渲染列表（显示 title）
     - 点击任一项，发出 `search:query:requested`，携带 sort 与 pagination.limit=0（全量）
  2) 实现 RecentOpened：容器绑定、限数下拉、请求与渲染、点击触发；点击时携带 focusId
  3) 扩展 SearchManager：透传 `sort`、`pagination` 到 WS 消息，并在 `search:results:updated` 附带 `focusId`
  4) 运行并修复测试
  5) 回写本文件与 AI-Working-log，并通知完成
 
## 当前任务（20251007184430）
- 名称：修复 pdf-home 关闭 pdf-viewer 后再次打开需双击两次的问题
- 问题背景：
  - 在搜索结果列表中双击打开 pdf-viewer，随后关闭该 viewer 窗口；再次尝试打开同一条记录时，需要先双击一次（pdf-home 闪一下），再双击第二次才会真正打开。
  - 初步研判为 PyQt 窗口关闭未销毁导致的“旧引用残留”，`viewer_windows` 命中“已存在窗口，激活”分支但实际窗口已不可用。
- 相关模块与函数：
  - 前端：
    - `src/frontend/pdf-home/features/search-results/index.js`（双击打开逻辑 -> QWebChannelBridge）
    - `src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js`（桥接调用 `openPdfViewers(Ex)`）
  - PyQt：
    - `src/frontend/pdf-home/pyqt-bridge.py`（`viewer_windows` 映射与复用/重建逻辑）
    - `src/frontend/pdf-viewer/pyqt/main_window.py`（viewer 窗口生命周期、closeEvent）
- 执行步骤（原子化）：
  1) 设计最小化测试：前端双击仅调用一次桥接；记录预期行为
  2) 在 `pdf-viewer` MainWindow 构造中设置 `WA_DeleteOnClose`，确保关闭即销毁
  3) 保持 `pyqt-bridge` 的 `isVisible()` 失效清理与 `destroyed.connect` 清理并存
  4) 自测：打开-关闭-再次打开仅一次双击即可；检查 `logs/window-close.log` 与 `viewer_windows` 行为
  5) 更新文档（tech.md）与工作日志，并通知完成
 

## 当前任务（20251007045101）
- 名称：修复 pdf-home 的 PDF 编辑保存链路（前后端联通 + Toast 提示）
- 问题背景：
  - 前端 pdf-edit 功能域存在表单与提交逻辑，但保存后“跑不起来”：
    1) WEBSOCKET_MESSAGE_TYPES 缺失 `pdf-library:record-update:requested`，WSClient 拒绝发送（未注册的请求类型）。
    2) 保存流程未接入 Toast，用户缺少“更新中/完成/失败”状态反馈。
  - 后端 msgCenter 标准协议与 standard_server 已实现 `pdf-library:record-update:*`，可直接对接。
- 相关模块与函数：
  - 前端：
    - `src/frontend/pdf-home/features/pdf-edit/index.js`（保存逻辑、WS 提交、现有全局错误容器）
    - `src/frontend/common/event/event-constants.js`（消息常量定义）
    - `src/frontend/common/ws/ws-client.js`（请求白名单 ALLOWED_OUTBOUND_TYPES 收集）
    - `src/frontend/common/utils/thirdparty-toast.js`（标准 toast 适配器）
  - 后端：
    - `src/backend/msgCenter_server/standard_server.py::handle_pdf_update_request`
    - `src/backend/msgCenter_server/standard_protocol.py::MessageType.PDF_LIBRARY_RECORD_UPDATE_*`
- 执行步骤（原子化）：
  1) 补充前端常量：在 `WEBSOCKET_MESSAGE_TYPES` 中加入 `PDF_LIBRARY_RECORD_UPDATE_REQUESTED/COMPLETED/FAILED`
  2) 在 pdf-edit 保存流程中接入第三方 toast：提交前 `pending('更新中')`，成功 `success('更新完成')`，失败 `error('更新失败-原因')`
  3) 设计最小化测试：断言 WSClient.ALLOWED_OUTBOUND_TYPES 含 `record-update:requested`
  4) 本地联调验证：点击编辑-保存，观察后端日志与前端 toast
  5) 回写本文件与 AI-Working-log，并通知完成

## 总体目标
## 当前任务（20251007195740）
- 名称：修复 pdf-viewer 书签删除误删其它非子书签
- 问题背景：
  - 现象：删除某个书签后，除其子书签外，其他非子书签也被一起删除（或丢失）。
  - 影响：用户误丢书签，列表刷新后出现缺失。
  - 初步研判：前端 BookmarkManager 的保存/加载与后端期望不一致。saveToStorage 传输了所有 Map 节点而非根节点树；后端 save_bookmarks 会将列表中的每一项当作根节点进行扁平化与覆盖写入；同时 loadFromStorage 仅把根节点写入 Map，导致对子节点的操作/查找不稳定。
- 相关模块与函数：
  - 前端：
    - src/frontend/pdf-viewer/features/pdf-bookmark/services/bookmark-manager.js（saveToStorage/loadFromStorage/deleteBookmark/reorder）
    - src/frontend/pdf-viewer/features/pdf-bookmark/services/bookmark-storage.js（Remote/Local 存储协议）
  - 后端：
    - src/backend/api/pdf_library_api.py（save_bookmarks/list_bookmarks 期望根节点列表）
- 执行步骤（原子化）：
  1) 设计删除回归测试：构建 A,B,C 三个根节点，B 含子 b1，删除 B 后仅 A/C 存活；删除 b1 时仅 b1 消失，B 保留。
  2) 修复 saveToStorage：仅序列化根节点树（rootIds -> tree），不再序列化 Map 全量。
  3) 修复 loadFromStorage：递归写入 Map（根与所有子孙），确保 getBookmark 可命中任意层级。
  4) 自测：本地 LocalStorage 与远端存储（如可）路径，验证删除后刷新仍保持非子树完好。
  5) 更新日志并通知完成。
- 验收标准：
  - 删除任意根节点，仅其子树被移除；其他根节点不受影响。
  - 删除任意子节点，仅该节点（及其子孙）被移除；其父及同级其他节点不受影响。
  - 刷新后（loadFromStorage 或远端 round-trip）仍满足以上。
- 前端（pdf-home、pdf-viewer）为纯 UI 模块，复用共享基础设施（EventBus / Logger / WSClient），仅在必要时通过 QWebChannel 与 Python 通信。
- 后端分三类：WebSocket 转发器（仅收发转发）、HTTP 文件服务器（仅文件传输）、PDF 业务服务器（独立、接收指令执行业务）。
- 日志分层：前端控制台经 DevTools 捕获写入 UTF-8 文件；后端统一用 Python logging（文件覆盖写，UTF-8）。
- AI Launcher 模块化：服务短小、可 start/stop/status，模块可独立运行与测试。

## 统一规范
- 目录命名：统一 kebab-case（示例：`pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 文件 I/O：所有读写显式 UTF-8；确保换行 `\n` 正确。
- 前端依赖：统一使用 `src/frontend/common/*`（EventBus / Logger / WSClient）。

## 当前任务 - pdf-home Filter 功能分析（2025-10-07）
- 描述：Filter 功能“未运作”，仅做代码与事件流分析，不修改代码。
- 目标：定位未生效的原因，明确事件链路与缺口，给出验证与后续实现建议。
- 相关模块/文件：
  - `src/frontend/pdf-home/features/filter/index.js`
  - `src/frontend/pdf-home/features/filter/components/filter-builder-v2.js`
  - `src/frontend/pdf-home/features/filter/services/filter-manager.js`
  - `src/frontend/pdf-home/features/filter/services/filter-tree.js`
  - `src/frontend/pdf-home/features/filter/services/filter-condition-factory.js`
  - `src/frontend/pdf-home/features/search-results/index.js`
  - `src/frontend/pdf-home/features/pdf-list/index.js`
  - `src/frontend/common/event/event-constants.js`
- 结论（现状）：
  - FilterFeature 本地缓存了 `@pdf-list/data:load:completed` 的数据，接入了搜索事件并能发布 `filter:results:updated`。
  - SearchResultsFeature 监听 `filter:results:updated` 渲染结果卡片。
  - FilterBuilder(V2) 的 `applyFilter()` 未将条件提交至 FilterManager，也未发布结果事件（按钮点击后无实际筛选行为）。
  - PDFList 的 `setFilters()` 仅更新 state 并发布 `filter:change:completed`，表格侧未实现实际过滤应用。
- 事件流（期望 vs 现状）：
  - 期望：高级筛选 → 生成条件 → 应用（FilterManager.applyFilter）→ 发出 `filter:results:updated` → SearchResults 展示 或 Tabulator 行过滤。
  - 现状：高级筛选仅日志与隐藏，无应用动作；导致用户无可见结果变化。
- 原子步骤（执行记录）：
  1. 收集最近 8 个 AI 日志（完成）
  2. 创建本次 AI 工作日志（完成）
  3. 阅读 memory bank 与规范头文件（完成）
  4. 定位 Filter 相关代码与依赖（完成）
  5. 梳理事件链路（完成）
  6. 识别核心缺口与容器冲突风险（完成）
  7. 给出验证与后续实现建议（完成）
  8. 更新 context 与工作日志（完成）
  9. 通知任务完成（待执行）

## 当前任务 - 在SQLite内完成“先搜索后筛选”的检索（2025-10-07）
- 描述：将搜索与筛选下沉到 SQLite（WHERE 条件）完成，前端以 WS 传入 `filters`，后端负责候选集收敛与兼容 `match_score` 计算。
- 设计要点：
  - tokens：字段内 OR，关键词间 AND；字段含 title/author/filename/tags/notes/subject/keywords。
  - filters：`composite(AND/OR/NOT)` 与 `field`（rating gte / is_visible eq / tags has_any / total_reading_time gte）。
  - SQL：通过 `json_extract` 提取 JSON 字段，`tags` 采用 LIKE 近似匹配（'%"tag"%'）。
  - 排序：保留 Python 端的 `match_score` 排序逻辑，SQL 仅负责 WHERE 收敛；分页在排序后再应用。
- 变更点：
  - 后端插件：`pdf_info_plugin.search_with_filters`（新增）。
  - API/Service：`PDFLibraryAPI.search_records` 与 `DefaultSearchService` 优先调用新方法。
  - WS 路由：`standard_server.handle_pdf_search_request` 透传 `filters/sort/search_fields`。
  - 前端：`SearchManager` 发送 `filters`；`FilterBuilder` 构建条件并发出 `filter:apply:completed`；`FilterFeature` 转发到 `search:query:requested`。
- 验证：后端单测 14 通过；功能最小路径可用。

## UI 修复 - Filter 面板定位（2025-10-07）
- 问题：FilterBuilder 面板被固定顶部的搜索栏覆盖。
- 方案：`.filter-container` 设为绝对定位，设置 `top: var(--search-panel-height, 88px)` 与左右撑满；`.filter-builder-wrapper` 增加 `margin-top: 12px`；z-index 低于搜索栏（1000→本容器900），通过 top 保证不重叠。
- 文件：`src/frontend/pdf-home/features/filter/styles/filter-panel.css`

---

## 当前任务 - 侧边栏展开推开搜索结果避免遮挡（2025-10-07）
- 描述：pdf-home 页面中，左侧侧边栏为 fixed 悬浮，展开时覆盖右侧搜索结果区域（`.main-content`）；期望点击展开按钮时将搜索结果“推开”而非遮挡。
- 相关模块/文件：
  - `src/frontend/pdf-home/features/sidebar/components/sidebar-container.js`（收起/展开按钮与交互）
  - `src/frontend/pdf-home/index.html`（`.sidebar` 与 `.main-content` DOM 结构）
  - `src/frontend/pdf-home/style.css`（侧边栏宽度 280px）
- 方案（最小改动，遵循事件架构）：
  - 在 SidebarContainer 内新增私有方法 `#updateMainContentLayout(collapsed)`，在展开时对 `.main-content` 设定 `margin-left: 280px; width: calc(100% - 280px)`，在收起时清空样式；
  - 在 `render()` 完成后按当前状态应用一次，避免初始遮挡；
  - 在点击切换时分别调用，保持布局同步；
  - 保持既有事件 `sidebar:toggle:completed` 不变（仅用于状态广播）。
- 原子步骤：
  1) 设计测试：构造最小 DOM（`.sidebar` + `.main-content`），渲染 `SidebarContainer`，断言首次渲染推开；点击折叠恢复；再次展开再推开。
  2) 编写 Jest 用例至 `features/sidebar/__tests__/sidebar-layout-push.test.js`。
  3) 在 `sidebar-container.js` 实现私有方法并挂接到 `render()` 与点击逻辑。
  4) 运行测试并通过（3/3）。
  5) 更新本文件与工作日志，并通知完成。


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

**日志治理能力**:
- 全局/模块级级别覆盖：`setGlobalLogLevel(level)`、`setModuleLogLevel(module, level)`
- 限流：按"模块+级别"固定窗口限流（默认 120 条/秒）
- 重复折叠：相同消息在 500ms 内仅首条输出
- 事件采样与裁剪：`logger.event()` 支持采样（默认 100%/生产20%）

**运行时配置**（localStorage）:
- `LOG_LEVEL`: `debug|info|warn|error`
- `LOG_EVENT_SAMPLE_RATE`: `0~1` 浮点数

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

# 停止所有服务
python ai_launcher.py stop
```

---

### 3️⃣ EventBus 事件命名规范（严格遵守）

**格式**: `{module}:{action}:{status}` （必须正好3段，用冒号分隔）

**✅ 正确示例**:
```javascript
'pdf:load:completed'          // PDF加载完成
'bookmark:create:requested'   // 请求创建书签
'sidebar:open:success'        // 侧边栏打开成功
```

**❌ 错误示例**:
```javascript
'loadData'                    // ❌ 缺少冒号
'pdf:list:data:loaded'        // ❌ 超过3段
'pdf_list_updated'            // ❌ 使用下划线
```

**⚠️ 不符合格式会导致 EventBus 验证失败，代码无法运行！**

---

### 4️⃣ 局部事件 vs 全局事件（严格区分）

#### 🔹 局部事件（Feature内部通信）
**使用方法**: `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`
- 仅在同一Feature内传递

```javascript
// 发布局部事件
scopedEventBus.emit('data:load:completed', data);
// 实际事件名: @my-feature/data:load:completed
```

#### 🌐 全局事件（Feature间跨模块通信）
**使用方法**: `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀
- 所有Feature都可以监听

```javascript
// 发布全局事件（其他Feature可监听）
scopedEventBus.emitGlobal('pdf:bookmark:created', bookmark);

// 监听全局事件（来自其他Feature）
scopedEventBus.onGlobal('pdf:file:loaded', (data) => {
  this.#loadBookmarks(data);
});
```

---

### 5️⃣ Feature 开发标准流程

**📖 完整文档**: `src/frontend/HOW-TO-ADD-FEATURE.md`

**Feature类必须实现**:
- `name` getter: 功能名称（kebab-case）
- `version` getter: 版本号
- `dependencies` getter: 依赖的其他Feature
- `install(context)`: 安装功能
- `uninstall(context)`: 卸载功能

**在Bootstrap中注册**:
```javascript
// 文件: bootstrap/app-bootstrap-feature.js
import { MyFeature } from '../features/my-feature/index.js';
registry.register(new MyFeature());
```

---

### 6️⃣ 依赖注入规范

**✅ 正确方式：通过Container获取依赖**
```javascript
const { container } = context;
const pdfManager = container.get('pdfManager');

## 当前任务 - 侧边栏「最近添加」实现（2025-10-07）
- 描述：在 pdf-home 侧边栏实现“最近添加”功能，捕捉后端添加完成回执，持久化并渲染最近添加列表，点击可打开 PDF。
- 背景：侧边栏容器（v2）已渲染出 `#recent-added-section` 与 `#recent-added-list`，但 `recent-added/index.js` 仍为占位；需要补齐逻辑，遵循事件白名单与三段式命名。
- 相关模块/文件：
  - `src/frontend/pdf-home/features/sidebar/recent-added/index.js`
  - `src/frontend/common/event/event-constants.js`（使用 `WEBSOCKET_MESSAGE_TYPES`）
  - `src/frontend/common/ws/ws-client.js`（路由响应到 `websocket:message:response`）
  - 侧边栏容器：`features/sidebar/components/sidebar-container.js`
- 事件链路：
  1) 后端完成添加 → WebSocket 推送 `pdf-library:add:completed`（WSClient 路由为 `websocket:message:response`）
  2) RecentAddedFeature 监听 `websocket:message:response`，在 `type===add:completed & status===success` 时提取 `data.file | data.files` → 写入本地（LocalStorage：`pdf-home:recent-added`）、更新 UI。
  3) 用户点击侧边栏项 → 通过 `websocket:message:send` 发送 `pdf-library:viewer:requested`（`data.file_id`）。
  4) 应用启动 → 发送 `pdf-library:search:requested`，参数 `sort=[{field:'created_at',direction:'desc'}]` 和 `pagination.limit = maxItems`；收到 `pdf-library:search:completed` 后渲染列表。
- 数据结构：`{ id, filename, path, ts }`；去重规则：优先按 `id`，否则按 `(filename + path)`；最大条数 `maxItems=50`；显示条数保存在 `pdf-home:recent-added:display-limit`。
- 展示规则：优先显示 `title`（书名）；若尚未获取详情，则暂以 `filename` 展示，待 `pdf-library:info:completed` 回执后更新为书名。
- 原子步骤：
  1. 设计并新增 Jest 测试（首次安装占位、添加后渲染、点击打开、去重提升）
  2. 实现 `index.js`：加载/保存、渲染、监听 WS 回执与点击、显示条数选择器、启动即从DB加载
  3. 运行测试验证；
  4. 更新本文件与工作日志；如需可在 `feature-flags.json` 中启用功能。

— 本段遵循 UTF-8 编码与 \n 换行 —
```

**❌ 错误方式：硬编码依赖**
```javascript
// ❌ 禁止：直接import其他Feature
import { PDFManager } from '../pdf-manager/pdf-manager.js';
```

---

### 7️⃣ 功能域模块化架构

**📖 深度解析**: `src/frontend/ARCHITECTURE-EXPLAINED.md`

**核心原则**:
1. **功能域隔离**: 每个Feature独立目录 (`features/功能名/`)
2. **事件驱动通信**: Feature间仅通过EventBus通信
3. **依赖注入**: 通过DependencyContainer注入依赖

**严格禁止**:
- ❌ Feature之间直接调用函数
- ❌ 硬编码依赖其他Feature的路径
- ❌ 绕过EventBus直接操作DOM

---

### 8️⃣ 契约编程实践

契约编程强调在编码前先定义清晰的接口契约，并通过文档、测试等方式固化。

**核心原则**:
1. **契约优先**: 编码前先定义接口契约
2. **契约验证**: 通过测试用例验证
3. **契约文档**: 以文档形式固化
4. **契约隔离**: 模块间只通过契约通信

---

## 模块职责

### 前端（pdf-home / pdf-viewer）
- 纯 UI 模块，负责渲染和用户交互
- 通过 WebSocket 与后端通信
- 使用共享基础设施（EventBus / Logger / WSClient）

### 后端
1. **WebSocket 转发器**: 仅收发转发消息
2. **HTTP 文件服务器**: 仅负责文件传输
3. **PDF 业务服务器**: 独立运行，执行 PDF 相关业务逻辑

---

## 最近完成的功能（2025-10）

1. **Toast 通知系统**: 集成 iziToast 第三方库，统一右上角堆叠提示
2. **日志治理**: 实现限流、折叠、采样等高级日志管理功能
3. **搜索功能**: PDF-Home 搜索端到端方案，支持多条件搜索
4. **PyQt 桥接**: 完善 QWebChannel 桥接，支持前后端通信
5. **书签持久化**: WebSocket 书签持久化功能完成
6. **数据库 Phase3**: 四大插件（PDFInfo、PDFBookmark、PDFAnnotation、SearchCondition）完成

---

## Worktree 状态

- **Worktree A** (`feature-bookmark-fix`): 书签修复相关
- **Worktree B** (`feature/pdf-home-add-delete-improvements`): 已合并到 main
- **Worktree C** (`feature-pdf-processing`): 已合并到 main
- **Worktree D** (`d-main-20250927`): 主线开发分支

---

## 关键技术决策

### Toast 方案（2025-10-07）
- 采用 iziToast 作为统一 Toast 方案
- 废弃原有 DOM 元素方式
- 位置：右上角堆叠提示

### 日志策略（2025-10-07）
- 统一关闭发布/订阅日志
- 高频事件采样输出（10%）
- 生产环境默认 WARN 级别

### 并行开发（2025-10-07）
- 采用 Schema-first 策略
- 前后端基于契约并行开发
- 所有消息符合 JSON Schema

---

## 参考文档

- **架构文档**: `src/frontend/ARCHITECTURE-EXPLAINED.md`
- **Feature 开发**: `src/frontend/HOW-TO-ADD-FEATURE.md`
- **EventBus 使用**: `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md`
- **技术变更**: `.kilocode/rules/memory-bank/tech.md`
- **架构变更**: `.kilocode/rules/memory-bank/architecture.md`

## 当前任务（20251007194500）
- 名称：修复 pdf-viewer 侧边栏打开时未推动 PDF 渲染区的问题（避免遮挡）
- 问题背景：
  - 事件白名单与实现不一致：侧边栏管理器发布 `sidebar:layout:changed`，但白名单与常量仅允许 `sidebar:layout:updated`；
  - 事件总线对未注册的全局事件会阻断发布/订阅；
  - `PDFLayoutAdapter` 订阅的也是旧事件名，导致无法接收布局变化，从而 `#viewerContainer` 未右移。
- 相关模块与函数：
  - `src/frontend/pdf-viewer/features/sidebar-manager/index.js`（发布布局事件与容器创建）
  - `src/frontend/pdf-viewer/features/sidebar-manager/pdf-layout-adapter.js`（订阅布局事件并设置 `.pdf-container.style.left`）
  - `src/frontend/common/event/pdf-viewer-constants.js`（`SIDEBAR_MANAGER.LAYOUT_UPDATED` 常量）
  - `src/frontend/common/event/event-bus.js`（全局事件白名单与验证）
- 执行步骤（原子化）：
  1) 设计测试：触发 `SIDEBAR_MANAGER.LAYOUT_UPDATED` 后 `#viewerContainer.style.left === totalWidth + 'px'`
  2) 添加单测 `__tests__/pdf-layout-adapter.test.js`，覆盖移动与复位两种场景
  3) 修复代码：
     - 订阅与发布统一使用 `PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED`
     - `open:completed` 事件名更正为 `opened:completed`（与常量一致）
     - 兼容历史 `sidebar:layout:changed`（保留订阅，便于平滑过渡）
  4) 运行 Jest 测试；如失败则回滚并修正
  5) 更新本文件与工作日志，并通知完成

## 当前任务（20251007213000）
- 名称：启动 pdf-viewer（a7a8bbd39787）出现空白页的调查与修复
- 现象与日志：
  - JS 日志出现两次 `Uncaught ReferenceError: require is not defined`；Vite 已连接；随后窗口退出。
  - Launcher 传入 URL 正常，含 `file=.../data/pdfs/a7a8bbd39787.pdf`，后端端口解析正常。
- 根因：
  - 前端多处使用 `pdfjs-dist/build/pdf`（UMD/CJS 包）在 QtWebEngine 环境下会触发 `require is not defined`；
  - 应使用 ESM 入口 `pdfjs-dist` 并将 worker 指向 `@pdfjs/build/pdf.worker.min.mjs`；
- 相关模块：
  - `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js`
  - `src/frontend/pdf-viewer/features/pdf-reader/services/pdf-manager-service.js`
  - `src/frontend/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js`
- 执行步骤：
  1) 统一改为 ESM 入口 `pdfjs-dist`；
  2) 保持 workerSrc 指向 `@pdfjs/build/pdf.worker.min.mjs`（mjs 版）
  3) 启动验证：确保日志不再出现 `require is not defined`，并能看到 PDF.js 初始化成功日志；
  4) 更新本文件与工作日志，并通知完成。
---

## 状态更新（20251007185127）
- 修复目标：pdf-home 关闭 pdf-viewer 后再次打开需双击两次。
- 关键改动：在 `pdf-viewer` PyQt MainWindow 中设置 `WA_DeleteOnClose`，并维持 `pyqt-bridge` 的可见性检查与 `destroyed` 清理同时存在。
- 预期效果：viewer 关闭即销毁，`viewer_windows` 映射自动清理；再次打开一次双击即可生效，不再出现“闪一下”。### 回归兼容（2025-10-07）
- loadFromStorage 增加“无 rootIds 旧格式”重建逻辑：按 parentId 重组树与根序；防止打开PDF后书签为空。
- saveToStorage 仍仅保存根树，逐步将旧数据迁移为标准结构。
### 书签编辑改进（2025-10-07）
- 立即刷新：编辑成功后先本地刷新，再异步持久化与回读，避免远端回读延迟导致视觉“未更新”。
- 防御性同步：更新时同步父.children 的引用，防止序列化根树时遗漏子节点更新。
### 拖动排序修复（2025-10-07）
- 根因：排序模式事件未在白名单，`emit` 被拦截，UI 收不到，导致 `draggable=false`。
- 修复：新增 `PDF_VIEWER_EVENTS.BOOKMARK.SORT.MODE_CHANGED`，并全量替换发射与监听位置。
- 现状：排序模式可切换，拖动排序可用；保存后刷新保持顺序。
### 排序引擎稳健性（2025-10-07）
- `reorderBookmarks()` 先预校验：父存在性、环路（沿父链上溯）；
- 计算目标 siblings 与 index，考虑同父移动“移除后索引左移”；
- 原子更新：安全移除→插入→同步根 order；
- 失败不改动；成功再持久化与回读。

## 当前任务（20251007223412）
- 名称：合并 worktree A/C/D 已提交代码到 main
- A: feature-bookmark-fix（发生冲突，已在 context.md 合并任务条目）
- C: feature-pdf-processing（已最新）
- D: d-main-20250927（冲突：search-results/index.js、search-manager.js；已融合 focusId 与 pendingFocus）
- 备注：保持 UTF-8 与 \n；冲突均按保留双端能力的原则解决
---

## 当前任务（20251007201657）
- 名称：保存搜索条件到配置文件并在侧边栏展示/应用
- 背景：
  - 现有“已存搜索条件”功能（SavedFiltersFeature）仅有UI桩，未实现持久化与应用逻辑。
  - 侧边栏已有“+”按钮，期望用于添加当前搜索条件；搜索栏上的“保存条件”按钮需要移除。
  - 后端标准协议已支持 pdf-library:config-read/write，我们复用该配置文件(data/pdf-home-config.json) 持久化 saved_filters。
- 相关模块：
  - 前端：
    - src/frontend/pdf-home/features/sidebar/saved-filters/index.js（实现保存/渲染/点击应用）
    - src/frontend/pdf-home/features/search/components/search-bar.js（移除“保存条件”按钮）
    - src/frontend/pdf-home/features/search/services/search-manager.js（已支持透传 filters/sort/pagination）
  - 后端：
    - src/backend/msgCenter_server/standard_server.py（扩展 config 读写，增加 saved_filters 字段）
- 原子步骤：
  1) 设计测试：
     - 安装后发送 GET_CONFIG；点击“+”后发送 UPDATE_CONFIG(data.saved_filters 数组)
     - 模拟 GET_CONFIG 回执包含 saved_filters；点击某项发出 search:query:requested，包含 searchText/filters/sort
  2) 后端：在 handle_pdf_home_get_config / handle_pdf_home_update_config 增加 saved_filters 的读写与校验
  3) 前端：完成 SavedFiltersFeature
     - 加载本地(localStorage)并向后端同步；
     - 监听 filter:state:updated 持久化最近 filters；
     - 监听 @pdf-list/sort:change:completed 持久化最近排序；
     - 点击“+”保存 {id,name,searchText,filters,sort,ts}；
     - 列表渲染与点击应用：设置搜索框文本 -> emit filter:state:updated -> emit search:query:requested(透传 filters/sort)
  4) 前端：移除搜索栏“保存条件”按钮（保留原弹窗代码但不可达）
  5) 编写 jest 用例并跑通
- 交付标准：
  - 侧边栏“已存搜索条件”可添加/显示/点击应用；
  - 后端配置文件包含 saved_filters 字段；
  - 搜索栏不再显示“保存条件”按钮；
  - 全过程 UTF-8 与 \n 规范。

### 追加：保存条件命名对话框（2025-10-07）
- 点击侧边栏“＋”时弹出对话框，填写名称并展示当前快照：
  - 关键词、筛选逻辑、排序规则
- 确认后以输入的名称保存；取消或点击遮罩关闭对话框。

### 追加：已存搜索条件管理对话框（2025-10-07）
- 在“＋”旁新增“⚙️ 管理”按钮；点击弹出管理对话框：
  - 支持拖动排序、重命名、复制、删除
  - 点击“确定”后保存顺序与名称变更，并更新后端配置（config-write）
  - 对话框复用 `.preset-save-dialog` 样式；列表项支持 HTML5 拖拽

## 当前任务（20251008000121）
- 名称：移除 pdf-home 页面中的 通信测试 按钮
- 变更：src/frontend/pdf-home/index.js 删除通信测试开发UI的导入与调用
- 验证：重启 pdf-home，按钮不再出现（dev/prod 均无）

## 当前任务（20251008000726）
- 名称：盘点并汇报冗余代码/配置，提出删除与改动建议
- 范围：pdf-home / pdf-viewer / common / 构建与依赖
- 原子步骤：
  1) 识别候选：未被引用的模块、开发占位、重复依赖、构建误配、遗留兼容代码
  2) 评估影响：列影响模块、UI/行为差异与回滚方案
  3) 形成建议：删除/移动/加特性开关/构建排除项
  4) 汇报并征求确认；后续根据确认再执行删除与重构
