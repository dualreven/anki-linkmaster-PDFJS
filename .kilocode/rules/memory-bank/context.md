# Memory Bank（精简版 / 权威）

## 当前任务（20251007170045）
- 名称：移除 Header 功能域，启用并验证排序面板
- 背景：旧版按钮来自 Header 渲染；现决定完全删除 Header，仅保留搜索栏工具区。
- 已完成：
  - 删除 Header 目录与全部文件；
  - 移除 `pdf-home-app-v2.js` 中 Header 的导入与注册；
  - 从 `feature-flags.json` 移除 `header` 配置块；
  - 验证 `SearchFeature` 的“🔃 排序”按钮通过 `search:sort:requested` 触发 `PDFSorterFeature` 面板切换（监听位于 `features/pdf-sorter/index.js:371-379`）。
- 新增修复：
  - 由于全局事件白名单限制，`search:sort:requested` 未在白名单中导致被拦截；
  - 已在 `src/frontend/common/event/event-constants.js` 中加入：
    - `SEARCH_EVENTS.ACTIONS.SORT_REQUESTED = 'search:sort:requested'`
    - `SEARCH_EVENTS.ACTIONS.ADD_REQUESTED = 'search:add:requested'`
    - `FILTER_EVENTS.ADVANCED.OPEN = 'filter:advanced:open'`
    - `FILTER_EVENTS.PRESET.SAVE = 'filter:preset:save'`
    - `FILTER_EVENTS.PRESET.SAVED = 'filter:preset:saved'`
  - 使排序/添加/筛选等按钮的全局事件不再被阻断。

## 当前任务（20251007174000）
- 名称：实现排序模式1（默认）为按标题字母升序，并作为默认排序
- 实施：
  - `features/pdf-sorter/feature.config.js`：`defaultSortField='title'`, `defaultSortDirection='asc'`；
  - `features/pdf-sorter/index.js`：实现 `applySort()` 实际应用排序；在 `#handleModeChange(0)` 时重置并应用默认排序；在 `@pdf-list/table:readiness:completed` 与 `@pdf-list/data:load:completed` 钩子中调用 `applySort()`；
- 冲突规避（Filter）：排序仅用 Tabulator `setSort`，不会改变过滤条件；数据刷新后自动重应用当前排序，避免筛选覆盖排序。

## 当前任务（20251007180500）
- 名称：修复“默认排序未生效”（Tabulator实例未注入）
- 背景：Sorter 监听 `@pdf-list/table:readiness:completed`，但事件未携带表格实例，导致 `setTable()` 未执行。
- 实施：
  - `pdf-list/services/list-lifecycle-service.js` 在发出 `TABLE_READY` 时附带 `{ table: this.#tabulator }`；若失败回退为空负载。
  - Sorter 原有监听逻辑在收到后 `setTable()` 并 `applySort()`，从而生效。

## 当前任务（20251007175200）
- 名称：为“默认排序”模式提供 Tooltip（不改文案）
- 实施：
  - `features/pdf-sorter/components/mode-selector.js` 默认模式标签增加 `title="默认排序：按标题字母升序；与筛选互不冲突"`；
- 说明：
  - 保持原 UI 文案不变，仅通过悬浮提示传达默认排序规则；

## 当前任务（20251007182000）
- 名称：将排序下沉到 SQL 层（标题字母升序），并与 Sorter 模式1 打通
- 实施：
  - 后端：
    - `database/plugins/pdf_info_plugin.py`：
      - `query_all()` 默认 `ORDER BY title COLLATE NOCASE ASC`
      - `search_with_filters()` 添加 `ORDER BY` 构建：无 sort_rules → 默认标题升序；支持 `title/author/filename/created_at/updated_at/page_count/file_size`
    - `api/pdf_library_api.py::search_records()` 默认排序改为 `title asc`，并保留内存二次排序一致性；
  - 前端：
    - `features/search/services/search-manager.js`：允许 `search:query:requested` 携带 `sort` 并下发至 WS；当未提供 searchText 时沿用当前词；
    - `features/pdf-sorter/index.js`：模式0（默认排序）时触发一次 `search:query:requested`，携带 `sort: [{field:'title',direction:'asc'}]`；
- 结果：
  - 默认和模式1均由 SQL 执行“标题字母升序”排序；
  - 与 Filter 不冲突，数据经过筛选后再按 SQL 排序返回；

## 当前任务（20251007183500）
- 名称：多级排序（后端）
- 实施：
  - SQLite 插件 `pdf_info_plugin.py` 新增 `_build_order_by(sort_rules)`，支持多字段与字段白名单（含同义词与 JSON 数值 CAST），`query_all/search_with_filters` 应用；
  - API `pdf_library_api.py::search_records()` 传递 `sort_rules` 给 `search_with_filters`；
  - DefaultSearchService 传递 `sort_rules` 并默认 `title asc`；
  - 前端 `pdf-sorter/index.js` 在 `data.type==='multi'` 时 emit `search:query:requested` 携带 sort 数组；
- 说明：
  - 关键词为空或未指定排序 → 默认 `title asc`；
  - 含“match_score”等非 SQL 字段仍在内存层保底排序；
- 待办/后续：
  - 若仍需标题区，将来以“纯标题”轻量组件替代 Header，不包含任何操作按钮；
  - 如需，精简 pdf-sorter 测试中对 `header:sort:requested` 的兼容断言（可保留）。

## 当前任务（20251007185247）
- 名称：修复“搜索后结果未按多级排序”，仅在点击“应用排序”后前端排序才生效的问题；要求多级排序在 SQL 层执行。
- 问题背景：
  - 前端 SearchManager 在用户发起搜索时，未默认携带最近一次（或当前面板配置的）多级排序 `sort[]`；
  - 后端 `DefaultSearchService` 与 `PDFLibraryAPI.search_records` 在 SQL 已 `ORDER BY` 的情况下，仍对返回集进行内存层二次排序，覆盖 SQL 顺序；
  - 体感表现为：搜索出来的结果不是按多级排序；点击“应用排序”按钮（前端本地排序+携带 sort 再次请求）后才正确。
- 涉及模块/函数：
  - 后端：
    - `src/backend/api/pdf-home/search/service.py::DefaultSearchService.search_records`
    - `src/backend/api/pdf_library_api.py::search_records`
    - `src/backend/database/plugins/pdf_info_plugin.py::search_with_filters`、`_build_order_by`
  - 前端：
    - `src/frontend/pdf-home/features/search/services/search-manager.js`（事件监听、WS载荷构建）
    - `src/frontend/pdf-home/features/pdf-sorter/index.js`（应用排序时 emit `search:query:requested` 携带 sort）
- 决策与方案：
  1) SearchManager 持久化最近一次排序配置 `#currentSort`；当 `search:query:requested` 未显式给出 `sort` 时，自动将 `#currentSort` 注入 WS 载荷，实现“搜索默认沿用当前多级排序”。
  2) 后端仅在存在“非SQL可排序字段”（如 `match_score`）时才在内存层进行排序；若 `sort` 全为 SQL 白名单字段，则完全信任 SQL 的 ORDER BY，不做二次排序。
- 执行步骤：
  1) 增加 SearchManager 对 `sort` 的记忆，并在 `#buildMessage` 缺省回填；
  2) 后端两处 search_records 增加 `needs_memory_sort` 判定；
  3) 保持默认：无 tokens 且无 sort → SQL 默认 `title ASC`；有 tokens 且无 sort → 内存 `match_score DESC, updated_at DESC`；
  4) 验证“多列排序（如 rating desc, updated_at desc）”在不包含 `match_score` 时完全由 SQL 层排序；
- 备注：
  - 该变更不影响筛选 WHERE 行为；仅改变排序的归属层级与一致性。

### 最小验证路径（人工）
- 配置多级排序：rating 降序、updated_at 升序；
- 在搜索框输入任意关键字触发搜索；
- 观察结果顺序：应与 SQL ORDER BY 一致，无需再次点击“应用排序”。

### 变更文件
- 后端：
  - src/backend/api/pdf-home/search/service.py:39, 72, 96
  - src/backend/api/pdf_library_api.py:173, 217
  - src/backend/database/plugins/__tests__/test_pdf_info_plugin_sorting_sql.py:1
- 前端：
  - src/frontend/pdf-home/features/search/services/search-manager.js:1

## 当前任务（20251007162030）
- 名称：修复 pdf-home 中 Header 排序按钮失灵（触发排序面板）
- 问题背景：
  - 用户反馈：pdf-home 顶部 header 的“🔃 排序”按钮无法打开排序面板。
  - 现状排查：
    1) HeaderFeature 存在但未实现渲染与事件绑定；
    2) feature-flags.json 中 header 功能被禁用，导致 UI 不出现；
    3) pdf-sorter 功能监听的事件为 `header:sort:requested` / `search:sort:requested`；
    4) 旧测试仍使用 `*:clicked` 命名，已与三段式规范不一致。
- 相关模块与文件：
  - 前端：
    - `src/frontend/pdf-home/features/header/index.js`（HeaderFeature 安装/卸载）
    - `src/frontend/pdf-home/features/header/components/header-renderer.js`（Header 渲染与按钮事件）
    - `src/frontend/pdf-home/config/feature-flags.json`（功能开关）
    - `src/frontend/pdf-home/features/pdf-sorter/index.js`（监听 header/search 的 sort 请求）
    - 测试：
      - `src/frontend/pdf-home/features/header/__tests__/header-sort-button.test.js`
      - `src/frontend/pdf-home/features/pdf-sorter/__tests__/sorter-panel-events.test.js`
- 执行步骤（原子化）：
  1) 设计测试：新增 Header 排序按钮事件测试；将 pdf-sorter 旧事件测试由 clicked→requested。
  2) 开发实现：
     - 实现 HeaderRenderer.render() 渲染 DOM 与按钮点击 emit 事件；
     - 在 HeaderFeature.install() 中注入并渲染 Header；
  3) 启用功能：开启 `feature-flags.json` 中 `header.enabled = true`；
  4) 验证：运行单测（jest）验证事件触发及面板切换；
  5) 更新文档：修正 search README 的事件名为 `*:requested`；
  6) 回写本文件与 AI-Working-log，并通知完成。

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
'sidebar:open:success'        
```

**❌ 错误示例**:
```javascript
'loadData'                     // 只有1段
'pdf:list:data:loaded'         // 超过3段
'pdf_list_updated'            // 使用下划线
'pdfListUpdated'              // 驼峰命名
'pdf:loaded'                  // 只有2段
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
