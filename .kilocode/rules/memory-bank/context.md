# Memory Bank（精简版 / 权威）

## 当前任务（20251008150500）
- 名称：稳定性治理（多 worktree 并行）
- 问题背景：
  - 5 个 AI 各自 worktree 并行开发，合并后出现历史功能失效与回归；
  - 部分测试落后无人维护，缺少“兼容性守护测试（Baseline Compatibility Test, BCT）”与强制门禁；
  - 已有插件隔离/事件总线/契约编程，但缺少“可执行契约 + 质量门禁 + 回归基线”的组合拳。
- 目标：
  - 事件/消息“Schema 化与版本化”，并以消费者驱动契约（CDC）保证 Producer/Consumer 协同；
  - 建立“关键用户旅程”回归基线（BCT），作为演进期间的稳定锚点；
  - 在 CI/合并流程上设置质量门禁（契约 + 基线 + 冒烟），小步合并、特性开关、灰度发布；
  - 强化可观测性（统一日志、关键指标与告警），快速定位回归根因。
- 相关模块与文件（非穷举）：
  - 前端：`src/frontend/common/event/event-constants.js`、`src/frontend/common/ws/ws-client.js`、各功能域 Feature（search/pdf-sorter/pdf-edit/pdf-bookmark/...）
  - 后端：`src/backend/msgCenter_server/standard_server.py`、`src/backend/msgCenter_server/standard_protocol.py`、`src/backend/api/pdf_library_api.py`
  - 规范：`docs/SPEC/*`（事件命名/消息格式/测试方法等）
- 执行步骤（原子化）：
  1) 事件与消息 Schema 化 + 版本策略：为事件负载与 WS 消息建立 JSON Schema（`docs/schema/events/*.schema.json`），命名与版本遵循 `FRONTEND-EVENT-NAMING-001` 与 `VERSION-CONTROL-001`；新增字段为向后兼容，移除/重命名需走弃用窗口。
  2) 消费者驱动契约测试（CDC）：在 `tests/contract/` 为每一类事件建立 Producer/Consumer 契约；变更前先跑下游消费者契约，失败即阻断合并。
  3) 兼容性守护测试（BCT）：在 `tests/bct/` 固化关键用户旅程（示例：搜索→分页→结果截断一致；双击打开 viewer；书签增删仅影响子树；pdf-edit 保存链路成功 Toast）。
  4) 质量门禁（CI）：合并前必须通过 契约+基线+BVT 冒烟 三类测试；核心插件组合走最小矩阵（pdf-home + pdf-viewer + ws-forwarder）。
  5) 合并策略：小步 PR、开启特性开关默认关闭；破坏式变更需 `compat:false + 开关关闭` 路径合并，并在下一版本内提供迁移与兼容期。
  6) 可观测性：统一结构化日志（UTF-8）、关键指标（事件失败率、消息 schema 校验失败计数）、快速回滚与告警；新增错误分类与速率限制配置。
- 验收标准：
  - 任一 PR/合并必须通过：契约（CDC）、基线（BCT）与冒烟三套测试；
  - Schema 变更遵循版本策略并通过向后兼容校验；
  - 回归基线一旦失败自动阻断合并；
  - 合并后 24 小时内无新增 P0/P1 错误；
  - `architecture.md`/`tech.md` 已记录方法论与操作要点。

## 当前任务（20251008061500）
- 名称：合并 worktree D (d-main-20250927) 到 main
- 背景：worktree D 包含侧边栏搜索结果截断、最近添加组件修复等改进，需要合并到主分支
- 执行步骤：
  1) 暂存当前未提交的 context.md 修改
  2) 执行 `git merge d-main-20250927 --no-ff`
  3) 解决 context.md 合并冲突（保留两个分支的所有历史任务）
  4) 提交合并并清理 stash
- 主要变更：
  * 修复侧边栏点击后搜索结果未按N条限制截断
  * SearchManager 缓存分页参数并在结果事件中附带 page 信息
  * SearchResults 对超量结果进行截断
  * UI 统计显示格式改为"显示 N / 共 M 条"
  * 最近添加组件行为修复：取消点击触发搜索，复用下拉选择器
  * 新增测试用例：search-results.limit.test.js
- 合并结果：
  * 冲突文件：.kilocode/rules/memory-bank/context.md（已解决）
  * 变更文件：8 files changed, 294 insertions(+), 439 deletions(-)
  * 提交 ID：90f1dbd
- 验证：合并成功，无冲突遗留

## 历史任务（20251007170045）
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

## 当前任务（20251008025747）
- 名称：优化侧边栏搜索性能 - SQL 层面截断记录
- 问题背景：
  - "最近阅读"和"最近添加"侧边栏每次点击都全量加载所有记录
  - 后端存在性能问题：visited_at 走优化分支（SQL LIMIT），created_at 走通用分支（全量查询+Python排序）
  - 当数据库记录增多时，通用分支会导致严重性能问题
- 相关模块与函数：
  - 后端插件：`src/backend/database/plugins/pdf_info_plugin.py`（query_all_by_visited, query_all_by_created）
  - 后端API：`src/backend/api/pdf_library_api.py`（search_records 方法的优化分支）
  - 前端：`src/frontend/pdf-home/features/sidebar/recent-opened/index.js`（最近阅读）
  - 前端：`src/frontend/pdf-home/features/sidebar/recent-added/index.js`（最近添加）
- 解决方案：
  - 在 PDFInfoTablePlugin 添加 `query_all_by_created()` 方法，SQL 层面按 created_at DESC 排序并 LIMIT
  - 在 search_records 添加 created_at 优化分支，条件：无 tokens + created_at desc + 无 filters
  - 与 visited_at 优化分支保持一致的优化策略
- 性能提升：
  - 优化前：全表扫描 + Python 排序 + Python 分页（O(N log N)）
  - 优化后：SQL LIMIT 查询（O(limit)）
  - 10,000 条记录取前 10 条：提升约 1000 倍
- 触发条件：无搜索关键词 + 无筛选 + 单字段降序排序（visited_at 或 created_at）+ 有分页
- 测试：2 个新增单元测试通过（test_search_records_optimizes_visited_at_desc, test_search_records_optimizes_created_at_desc）
- 影响范围：仅优化简单排序查询，不影响复杂搜索（关键词+筛选）的准确性

## 当前任务（20251008021430）
- 名称：修复 pdf-home "最近添加"侧边栏高亮一闪而过的问题
- 问题背景：
  - "最近阅读"点击后能正确高亮并持续显示
  - "最近添加"点击后高亮一闪而过，无法持续显示
  - 根因：事件时序错误，focus 请求在 DOM 渲染前发送，应用后立即清空，导致渲染完成后无法再次应用
- 相关模块与函数：
  - `src/frontend/pdf-home/features/sidebar/recent-added/index.js`（#triggerRecentSearch 方法）
  - `src/frontend/pdf-home/features/sidebar/recent-opened/index.js`（对比参考：成功的实现）
  - `src/frontend/pdf-home/features/search-results/index.js`（#applyPendingFocus 方法）
- 修复方案：
  - 改进时序控制：在搜索结果渲染完成后才发送 focus 请求
  - 监听 `search:results:updated` 事件确保结果已渲染
  - 使用 `requestAnimationFrame` 确保浏览器已完成 DOM 更新
  - 监听器执行后立即取消订阅，避免内存泄漏
- 修复前时序：search → 立即 focus（失败，DOM 未渲染）→ 清空 pendingFocusIds → 渲染 DOM（无法再次应用）
- 修复后时序：search → 监听 results:updated → 渲染 DOM → requestAnimationFrame → focus（成功，DOM 已渲染）
- 验证标准：点击"最近添加"后，搜索结果中的所有条目都被高亮（selected），第一条被聚焦（focused）并滚动到视图中，高亮持续显示不消失

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

## 历史任务（20251008000121）
- 名称：移除 pdf-home 页面中的 通信测试 按钮
- 变更：src/frontend/pdf-home/index.js 删除通信测试开发UI的导入与调用
- 验证：重启 pdf-home，按钮不再出现（dev/prod 均无）

## 历史任务（20251008000726）
- 名称：盘点并汇报冗余代码/配置，提出删除与改动建议
- 范围：pdf-home / pdf-viewer / common / 构建与依赖
- 原子步骤：
  1) 识别候选：未被引用的模块、开发占位、重复依赖、构建误配、遗留兼容代码
  2) 评估影响：列影响模块、UI/行为差异与回滚方案
  3) 形成建议：删除/移动/加特性开关/构建排除项
  4) 汇报并征求确认；后续根据确认再执行删除与重构

## 历史任务（20251008010127）
- 名称：第2阶段清理（删除通信测试工具与legacy代码）
- 变更：
  * 删除 pdf-home/utils/communication-tester.js
  * 移除 PDF-Viewer DOMElementManager 中 legacy DOM 创建/清理逻辑
  * 移除 sidebar-manager 旧事件监听（统一使用 sidebar:layout:updated）
- 回滚：9b65f48 基线

## 历史任务（20251008001859）
- 名称：修复 pdf-viewer 标注持久化（annotation persistence）
- 问题背景：AnnotationManager 存在 Mock 模式，未连接 wsClient；且未在 PDF 加载后触发标注加载。
- 相关模块与函数：
  - 前端：src/frontend/pdf-viewer/container/app-container.js（WSClient创建）、src/frontend/common/ws/ws-client.js（导出）、
    src/frontend/pdf-viewer/features/annotation/index.js（安装与事件）、src/frontend/pdf-viewer/features/annotation/core/annotation-manager.js（CRUD与WS）、
    src/frontend/common/event/event-constants.js（消息契约）
  - 后端：src/backend/msgCenter_server/standard_server.py（ANNOTATION_* handlers）、src/backend/database/plugins/pdf_annotation_plugin.py
- 执行步骤（原子化）：
  1) 设计测试：构造 ScopedEventBus + Mock wsClient，验证 CREATE 触发 annotation:save:requested
  2) 修复 ws-client.js 导出：补充 export default WSClient，确保容器可实例化
  3) 在 AnnotationFeature 安装时监听 FILE.LOAD.SUCCESS，解析 pdf-id 或 filename，发出 ANNOTATION.DATA.LOAD
  4) 运行并修复测试
  5) 更新文档与工作日志并通知完成
### 本次修复要点
- 根因：app-container 使用默认导入 WSClient，但 ws-client.js 未提供默认导出，导致 wsClient 未创建，AnnotationManager 落入 Mock 模式，无法持久化
- 补救：在 ws-client.js 增加 export default WSClient，保证容器可实例化 wsClient 并注册到 DI 容器
- 自动加载：AnnotationFeature 监听 pdf-viewer:file:load-success，解析 pdf-id 或 filename，发出 annotation-data:load:requested
- 后端：standard_server.py 已实现 ANNOTATION_LIST/SAVE/DELETE，无需调整
- 测试：新增注释持久化最小化单测（当前 Jest ESM 配置导致已有用例无法整体跑通，建议后续统一 ESM 配置）
- 追加修复：删除 ws-client.js 重复 export default 导致的 Babel 错误
- 备注：AnnotationManager.remote-save/remote-load 失败时降级处理，UI 乐观更新不受阻

## 历史任务（20251008001139）
- 名称：设计新表 pdf_bookanchor（锚点：uuid -> 页码/精确位置）
- 问题背景：
  - 需要一个"活动书签/锚点"实体，外部只需锚点 uuid，即可解析到所属 PDF 的页码与精确位置；还需展示友好名称 name。
  - 项目已有层级书签表 `pdf_bookmark`（json_data 持久化 + json_extract 索引），新表需延续相同风格与事件体系，避免重复实现。
- 相关模块与函数：
  - 数据库：
    - `src/backend/database/plugins/pdf_info_plugin.py`（pdf 基础信息表，外键引用）
    - `src/backend/database/plugins/pdf_bookmark_plugin.py`（现有书签插件，命名/校验/索引风格参考）
    - （新）`src/backend/database/plugins/pdf_bookanchor_plugin.py`
  - 服务/API：
    - `src/backend/api/pdf_library_api.py`（可扩展解析接口：anchor_uuid -> page+position）
    - `src/backend/msgCenter_server/standard_server.py`（WS 路由，新增消息类型）
  - 前端：
    - `src/frontend/pdf-viewer/*`（消费解析结果并跳转定位）
- 执行步骤（原子化）：
  1) 读取历史与规范（已完成）：AItemp 最近 8 条 + SPEC-HEAD
  2) 调研现有书签/DB 插件（进行中）：统一字段/索引/事件风格
  3) 产出字段与 `position` 结构草案（本次目标）：核心列、json_data schema、索引与约束
  4) 征求确认：主键命名（uuid/anchor_uuid）、position 单位、是否首批支持 textRange 等
  5) 拆分实现计划：DB 插件 -> API/WS -> 前端消费 -> 测试
  6) 回写工作日志与本文件，通知完成
### 追加：pdf_bookanchor 表（2025-10-08）
- 已创建插件：`src/backend/database/plugins/pdf_bookanchor_plugin.py`
- 表字段（SQL）：`uuid, pdf_uuid, page_at, position, visited_at, created_at, updated_at, version, json_data`
  - `position`：REAL，0~1（页内百分比高度）；`page_at`：INTEGER，>=1
  - `visited_at`：转由 SQL 字段承载，不写入 json_data
- 约束与索引：外键 pdf_info(uuid) 级联删除；`pdf_uuid`、`created_at`、`(pdf_uuid, page_at)`、`visited_at` 索引
- json_data 建议：`name`(必填)、`description`、`is_active`、`use_count` 等
### 追加：修复 pdf-viewer 标题覆盖（2025-10-08）
- 现象：通过 pdf-home 启动时，窗口标题先为元数据 title，后被替换为文件名。
- 方案：在 `src/frontend/pdf-viewer/pyqt/main_window.py:__init__` 中引入"标题锁定"。
  - 重写 `setWindowTitle` 记录 `_locked_title`；
  - 绑定 `self.web_view.titleChanged` 到 `_on_page_title_changed`，若与锁定值不一致则恢复；
  - 宿主（pdf-home）后续设置的展示名将更新锁定值，确保标题稳定。
- 验证：从 pdf-home 打开 viewer，标题在加载后不再被文件名覆盖。
### 追加：修复 HTML 标题覆盖（2025-10-08）
- 位置：`src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js`
- 根因：URL 解析时未记录首选标题，文件加载成功后用 filename 覆盖 header。
- 修复：
  - 引入 `#preferredTitle`；
  - `URL_PARAMS.PARSED` 记录并应用；
  - `FILE.LOAD.SUCCESS` 优先使用 `#preferredTitle`，否则用 filename。
- 验证：带 `&title=` 时 header 不再被文件名覆盖。

## 历史任务（20251008033805 - 来自 worktree D）
- 名称：修复侧边栏点击后搜索结果未按N条限制截断
- 问题背景：
  - 点击"最近阅读/最近添加"条目应触发空关键词搜索 + 指定排序 + 分页limit=N；
  - 实际渲染出现18条（疑似全量），与侧边栏选择N=5不符；
  - 初步推测：部分路径（或并发搜索）导致后端未应用limit；前端需要兜底保证只渲染前N条。
- 相关模块与函数：
  - 前端：
    - src/frontend/pdf-home/features/search/services/search-manager.js（结果事件附带page信息）
    - src/frontend/pdf-home/features/search-results/index.js（按page.limit截断显示）
  - 后端（背景）：
    - src/backend/msgCenter_server/standard_server.py::handle_pdf_search_request（已接入pagination，未回传page）
    - src/backend/api/pdf_library_api.py::search_records（visited_at/created_at优化分支已具备SQL层LIMIT）
- 执行步骤（原子化）：
  1) 为 SearchManager 的 pending 请求缓存 pagination（limit/offset）
  2) 在 search:results:updated 事件中附带 page 信息（若WS无page，用pending中pagination代替）
  3) SearchResults 接收到 page.limit>0 时，对 records 执行 slice(0, limit) 再渲染
  4) 增加测试：SearchManager请求负载与SearchResults截断逻辑
  5) 更新本context与AI-Working-log
— 本段UTF-8，换行\n —

### 结果（2025-10-08 03:42:27）
- 前端已对超量结果进行截断，保障显示条数与侧边栏选择一致；若后端严格应用 LIMIT，将不会影响当前逻辑。
- 建议后续：服务器响应中回传 page(limit/offset)，当前已兼容此字段。
— UTF-8 / \n —
### 追加（日志分析后措施）
- 根据 logs/pdf-home-js.log：搜索请求的 data.pagination.limit=5 已正确发送；
- 但结果事件可能缺少 page 字段或存在竞态导致未截断渲染，已在 SearchResults 中增加"记录最近一次 limit 并兜底截断"的逻辑。
- 预期：点击侧栏项后，无论响应是否携带 page，最终渲染条数均与 N 保持一致。
— UTF-8 / \n —
### UI 统计修正
- 头部统计由"共 X 条"改为"显示 N / 共 M 条"，N=当前渲染条目数（可能受分页limit截断），M=总条数（服务端统计）。
- 这样当仅显示5条而总计18条时，提示一致且不误导。
— UTF-8 / \n —
### 最近添加 组件行为修复
- 取消标题/列表点击触发搜索，保持与"最近阅读"一致
- 复用 SidebarPanel 渲染的下拉选择器，避免重复 select 导致的状态分裂
- SidebarPanel 不再直接在 limit 变化时重渲染 added/opened 列表，由子功能自身渲染
- 期望：点击"显示10个"仅侧栏显示变为10条，不触发搜索，不改变结果背景色
— UTF-8 / \n —
