# Memory Bank - Context（精简版）

最后更新：2025-12-30（前端事件体系参考文档：防竞态）

## 2025-12-30 前端事件体系参考文档（防竞态）
- 文档：`docs/standards/event-system-reference.md`
- 目的：给后续 AI 一个“选事件前先看这里”的地图，避免误用事件造成竞态/时序冲突。
- 关键结论（高风险）：`PDF_VIEWER_EVENTS.RENDER.READY` 是状态型且默认只发一次；Resume 与 MsgCenter gate 导航若复用该事件，极易在 `NavigationService` 的互斥点发生竞态（表现为偶现跳转失败/跳错位置）。
- gate 注意：`gate.once` 是否能命中历史，取决于目标事件是否被写入 gate store（参见 `src/frontend/common/ws/ws-gate-runner.js` 与 `src/frontend/pdf-viewer/adapters/websocket-adapter.js`）。

## 2025-12-30 P0：前端单文件行数门禁（基线+增量）
- 目标：先止血，阻止前端单文件继续面条化；历史大文件允许逐步拆分，不要求一次性全部重构。
- 落地：
  - 脚本：`scripts/ci/frontend-line-limit.js`
  - 基线：`scripts/ci/baselines/frontend-line-limit.json`
  - 运行：`pnpm run ci:frontend-line-limit`
- 规则：
  - `src/frontend/**` 新增文件禁止 `>500` 行；
  - 对基线中已 `>500` 行的历史文件：禁止行数继续增长（允许减少）。
- 排除：`src/frontend/dist/**`、`**/__tests__/**`、`**/__smoke__/**`
- 备注：仓库全量 `pnpm run lint` 当前仍存在大量历史报错；本轮只保证新增脚本目录定向 lint 与最小 Jest 用例通过。

## 2025-12-30 P1：AnnotationSidebarUI 拆分（降低面条风险）
- 目标：从 `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js` 抽离大块逻辑，保持行为不变，降低回归定位成本。
- 已拆分：
  - 评论对话框：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/comment-dialog.js`
  - 标注卡片渲染：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/annotation-card.js`
- 继续拆分：
  - 工具栏控制器：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/toolbar-controller.js`
  - 确认弹窗：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/confirm-dialog.js`
  - 事件订阅集合：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js`
  - 跳转委托：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/jump-delegation.js`
  - 空态渲染：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/empty-state.js`
- 效果：主文件约 1760 行 → 993 行 → **485 行**；既有 Jest（annotation sidebar 相关）保持通过；行数门禁通过。

## 2025-12-30 前端面条代码分析 v2（量化 + 路线图）
- 报告：`AItemp/reports/20251230104550-frontend-noodle-analysis-v2.md`
- 关键数字（已跟踪前端文件，排除 dist/tests/smoke）：
  - 文件数 269，总行数 68331
  - >500 行文件 37（pdf-viewer 18 / common 10 / pdf-home 9）
- 建议优先拆分：annotation screenshot/text-highlight、ui-manager-core、ws-client/websocket-adapter、pdf-home filter-builder-v2 等（详见报告）。

## 2025-12-23 标注管理器开发进度小结
- 后端数据层：`PDFAnnotationTablePlugin` 已扩展 `title/is_key/importance` 元字段并接入默认标题生成与校验逻辑，`PDFAnnotationTagsTablePlugin` 与 `PDFAnnotationRelationTablePlugin` 已提供标签与关系的 CRUD 能力及防回归测试，为后续“标注网络化管理”提供基础数据模型。
- Hosted 启动链路：GUI Launcher 与 pdf-viewer 标注侧边栏 Header 方框按钮均可通过 `app-window:open:requested` 打开 `window_type="anno-manager"` 的 Hosted 窗口，BackendLauncher 使用 `ensure_anno_manager_hosted` + `WindowLifecycleManager` 管理 `client_id=\"anno-manager\"` 的生命周期。
- 前端 anno-manager 窗口：已实现基础骨架与布局（标题 + 窗口控制栏 + 搜索/筛选/排序/导入工具栏、左侧过滤/视图侧边栏、右侧结果区域）；当前以“独立打开”为基准：默认不加载标注，点击“从 PDF 导入/刷新”会弹窗选择 PDF 并请求 `annotation:list:requested`；跨 PDF 聚合查询与关系导图仍处于设计阶段。
- 窗口控制栏与关闭行为：anno-manager 现已复用统一的 `SimpleWebWindowApp + SimpleWindowBridge + WindowControlsComponent`，关闭按钮在前端会同时通过 WebSocket 发送 `app-window:close:requested` 并调用 QWebChannel 的 `requestCloseWindow`，修复了早期 Hosted 场景下“点击关闭无反应”的问题。
- 尚未完成的能力：标注管理器尚未接入“按标签/是否有关联卡片/时间范围”等高级筛选条件，也未真正落地“跨 PDF 聚合视图”“标注关系导图”和与新卡片规划器/定制复习器之间的双向跳转，目前主要完成的是单个 PDF 视角下的标注列表与基础窗口行为。
- 首开标注缺失修复：修复“GUI Launcher 打开 pdf-viewer 后首次标注侧边栏为 0 条且高亮/覆盖层不显示，需要 F5 刷新才出现”的问题；关键点为 `WSClient.request()` 在未连接排队时不应提前开始 timeout（否则会出现 request 超时但消息仍在队列、响应到达却无人结算），以及 `AnnotationManager` 加载标注时不应在 WS 未就绪时静默返回空数组导致 UI 误判“已加载完成(0条)”并阻止自动重试。
- 高亮跳转居中修复：后端 `pdf_annotation.validate` 持久化 `lineRects`（百分比矩形数组）用于跳转位置计算；前端对缺失 `lineRects` 的历史数据提供 DOM 兜底二次居中，并在 2025-12-24 修复了两点：① DOM 兜底算法（必须基于 `.text-highlight` 子块矩形求包围盒中心，不能用覆盖整页的 `.text-highlight-container` 自身 rect）；② 消除双滚动（text-highlight DOM 居中场景调用 `NavigationService.navigateTo({ scroll:false })`，避免先默认滚到 50%）。

## 2025-12-24 anno-manager 独立打开行为调整
- 不再使用 URL query 传递 `pdf-id`：`SimpleWebWindowApp` 仅透传 `client-id`；业务上下文应统一走 MsgCenter（本轮未实现跨模块 init/gate）。
- “从 PDF 导入/刷新”按钮行为：点击后请求 `pdf-library:list:requested` 获取列表，弹窗选择 PDF 后发送 `annotation:list:requested`（data: `{ pdf_uuid: <selected> }`）；默认不加载标注。
- 本轮未做：从 pdf-viewer 点 “□” 打开 anno-manager 后的自动导入/跳转门控。

## 2025-12-24 anno-manager 单例约束（MsgCenter/Launcher）
- anno-manager 必须为唯一窗口：重复收到 `app-window:open:requested`（window_type=anno-manager）时，只激活已有窗口，不再创建新实例。
- 严格约束：window_type=anno-manager 时 client_id 必须为固定的 `"anno-manager"`；任何自定义 client_id 视为错误并拒绝处理（Fail-Fast）。

## 2025-12-23 pdf-viewer 模块理解小结
- 规范入口：遵循 `docs/SPEC/SPEC-HEAD-pdf-viewer.json`，需结合结构/事件/PDFJS/QtWebEngine 适配与 WebSocket 契约等规范文档；模块 README、ARCHITECTURE/ARCHITECTURE-DIAGRAM 提供事件驱动 + Feature 插件化架构总览。
- 启动与配置：`main.js` 通过 `bootstrapPDFViewerAppFeature()` 启动；`bootstrap/app-bootstrap-feature.js` 解析 ws 端口（`resolveWebSocketPortSync` 默认 8765）与 `PDF_PATH`/`?file`，若已有 `pdf-id` 则跳过本地 auto-load，交由 URL Loader 触发；默认提升 Outline 与 WebSocketAdapter 日志级别并支持 `outlineLog` URL 参数调整，启动时 toast 提示“当前为 Outline 模式”。
- Feature 注册序列（全局 eventBus）：`infra-app` → `window-controls`（bridgeName=pdfViewerBridge，container=".toolbar-right"）→ `pdf-manager` → `infra-ui` → `infra-nav-core` → `pdf-search` → `pdf-url-loader` → `pdf-resume` → 强制 `pdf-outline` → `pdf-anchor` → `pdf-annotation` → `pdf-translator` → `pdf-quick-actions` → `pdf-card` → `ai-assistant` → `infra-sidebar`；安装完成后在 `window.pdfViewerApp` 暴露 registry/container/getFeature/test helper。
- 行为守卫：启动时禁用浏览器层 Ctrl+滚轮/快捷键页面缩放（转译为内部 zoom 事件，避免 devicePixelRatio 漂移）；WindowControlsFeature 复用 QWebChannel bridge `pdfViewerBridge`；默认启用 `showInfo("当前为 Outline 模式")` 提示。
- 日志与 WS：统一 Logger（PDFViewer）+ `setGlobalWebSocketClient`；遵循 `PDF-VIEWER-LOGGING-IMPLEMENTATION-001` 过滤噪音（含 “Console log recorded successfully”）并记录加载/渲染/交互/错误与性能指标。

## 新增任务快照（2025-12-03/12-05）
- 任务A：🧠 规划并实现“PDF 批量制卡 + 标注网络化管理”后端基础能力：
  - 概念与产品层（仅分析阶段，2025-12-03）：设计“新卡片规划器 / 标注管理器 / 导图（标注+PDF+卡片混合节点）”的整体能力，强调标注是一等实体并可与 Anki 卡片、PDF 文档形成图谱结构；
  - 数据库与插件层（实现阶段，2025-12-04）：在 `pdf_annotation` / `pdf_info` 基础上扩展标注的元字段（title/is_key/importance），并新增两张表：
    - `pdf_annotation_tags`：标注标签表，一标注多标签，结构与 `pdf_tags` 类似；
    - `pdf_annotation_relation`：标注关系表，抽象“标注 → 标注 / PDF / 卡片”的有向边，用于支撑导图中的混合节点与“全部链接+反向链接”展开。
  - 已落地的后端改动：
    - 扩展 `PDFAnnotationTablePlugin`：建表逻辑补充 `title/is_key/importance` 三列；插入时按“annotation-[截断书名]-p[页码]”规则生成默认标题（书名截断 15 字，超长加 `...`），并对 is_key/importance 做范围校验；查询结果中暴露这些元字段；
    - 新增 `PDFAnnotationTagsTablePlugin`：管理 `pdf_annotation_tags` 表，提供最小 CRUD 与 `list_tags/list_annotations_by_tag` 能力；
    - 新增 `PDFAnnotationRelationTablePlugin`：管理 `pdf_annotation_relation` 表，支持三种 target_type（annotation/pdf/card），并提供 `get_outgoing/get_incoming_for_annotation/get_relations_for_pdf/get_relations_for_card` 等查询；
    - 在 `PDFLibraryAPI` 与 `pdf_library/bootstrap` 中注册新插件，确保在 API 层初始化时自动建表并启用；
    - 为上述改动新增/扩展了后端测试：在原有 `test_pdf_annotation_plugin.py` 基础上覆盖默认标题生成与 meta 字段校验，新增标签/关系插件的 CRUD 与约束测试（级联删除、UNIQUE、防止非法 target 组合等）。
  - 前端 Viewer 侧边栏与“标注管理器”入口（2025-12-04）：
    - 在 `infra-sidebar` 中统一了侧边栏 Header 骨架：使用 `.sidebar-header` + `.sidebar-title` + `.sidebar-header-actions`，支持通过 `SidebarConfig.createHeaderExtraActions()` 在“关闭按钮左侧”插入单个方形图标按钮，避免各 Sidebar 自己拼 Header 导致样式与行为不一致。
    - 标注侧边栏 `annotation` 的配置中启用该扩展位：`createHeaderExtraActions` 返回一个 `button.sidebar-icon-btn.pdf-sidebar-annotation-manager-btn`，与关闭按钮共用一套尺寸/hover/active 样式（定义于 `sidebar-layout.css`），视觉上保持一致，仅图标为方框“□”以表示“打开管理器”。
    - 当前阶段点击该按钮会通过 `PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED` 发出“打开标注管理器窗口”的全局事件，事件 payload 中包含当前 URL 解析出的 `pdf-id`；`WebSocketAdapter` 监听该事件并调用 `wsClient.send({ type: WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_OPEN_REQUESTED, data:{ client_id:'anno-manager', window_type:'anno-manager', params:{ pdf_id }}})`，最终由 MsgCenter/BackendLauncher 统一调度 Hosted anno-manager 窗口。
    - 同时保留轻量级 toast 反馈 `showInfo("正在请求打开标注管理器...", 2000)`，提示用户点击已被处理；为上述链路新增 Jest 测试：`infra-sidebar/__tests__/annotation-sidebar-header-manager-button.test.js` 用于保证 Header 中仍只有一个关闭按钮且点击会发出 OPEN_WINDOW_REQUESTED 事件，并携带 `pdf-id`；`adapters/__tests__/websocket-adapter.anno-manager-window-open.test.js` 校验 WebSocketAdapter 收到事件后会向 MsgCenter 发送正确的 `app-window:open:requested` 消息。

## 当前任务快照（2025-12-05）
- 任务1：🔍 分析 pdf-viewer 断点续读（resume）在高页码场景下的恢复页码偏差（例：关闭在 42 页，重开时在 39–40 跳动并最终停在 40 页）
- 任务2：📡 盘点 pdf-viewer 中 WS 消息重构的当前进度（仅做只读分析与阶段性结论）
- 任务3：🧩 梳理 pdf-viewer / pdf-home 在前端层面的「功能相同但各自实现」部分，并设计可抽象到 common 的组合式方案（包含 PyQt 窗口层）
- 任务4：🧱 盘点 pdf-viewer 内部 sidebar 系列（outline/anchor/annotation/card/translate/ai-assistant/backlink 等）的重复代码模式，输出只读分析报告，暂不落地重构
- 任务5：🧹 清理 `src/frontend/pdf-home` 与 `src/frontend/pdf-viewer` 目录下的所有 eslint 报错，为后续重构提供“lint 全绿”的基线（当前已完成一轮，两个目录在本次运行时 eslint 全绿）
- 任务6：⏱ 盘点“带 gate 条件的 WS 消息类型”当前实现情况（主要聚焦 pdf-viewer，兼顾 pdf-home 规范）
- 前序任务：压缩 context.md；多轮修复 PDF 页码跳转偏差 Bug + pdf-resume 模块化重构；WS 收发器与条件 gate 协议设计与 pdf-home 侧落地（详见归档与 AItemp 日志）

## 2025-12-09 快照：pdf-viewer 标注卡片编辑器保存链路修复
- 问题背景：pdf-viewer 中标注侧边栏的“卡片编辑器”（评论弹窗 + 标题/Tags 编辑区）在 UI 上可以修改标题、添加评论，但实际上只更新了前端内存与卡片 DOM，没有触发 `AnnotationManager` 的持久化逻辑，导致重新打开 PDF 或重新加载标注列表时看不到这些修改。
- 根因：弹窗提交时只发射了 `PDF_VIEWER_EVENTS.ANNOTATION.UPDATED`（语义为 “update:success” 的结果事件），而 `AnnotationManager` 只监听 `PDF_VIEWER_EVENTS.ANNOTATION.UPDATE`（`annotation:update:requested`），因此从未走到 `WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE` → MsgCenter → `PDFAnnotationTablePlugin` 的保存链路。
- 修复要点：
  - 在 `AnnotationSidebarUI.#showCommentDialog` 的 `submitComment()` 里，保留本地更新 `annotation.title` / `annotation.tagsText` / `annotation.addComment(...)` 的逻辑，但不再直接发 `ANNOTATION.UPDATED`；
  - 统一在有任何变更（标题 / Tags / 新评论）时发出一次 `PDF_VIEWER_EVENTS.ANNOTATION.UPDATE`，载荷形态为 `{ id: annotationId, changes: { title?: string|null } }`，由 `AnnotationManager` 接手调用 `annotation.update(changes)` 并通过 `ANNOTATION_SAVE` 消息把包含 `title + comments` 的完整 Annotation JSON 持久化到后端；
  - 评论新增仍然通过 `PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADDED` 通知其它监听者，但本地路径带 `skipUpdate: true`，防止重复 UI 更新。
- 相关模块与文件：
  - 前端：`src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js`（评论对话框提交逻辑与卡片 UI 更新）、`core/annotation-manager.js`（UPDATE → SAVE 持久化）、`common/models/annotation.js` + `comment.js`（Annotation/Comment 数据模型）、以及针对链路的 Jest 测试：
    - `features/pdf-annotation/__tests__/annotation-persistence.test.js`：新增用例覆盖 “LOAD + CREATE 之后的 UPDATE 会再次触发 ANNOTATION_SAVE，且 payload.annotation.title 为最新值”；
    - `features/pdf-annotation/components/__tests__/annotation-sidebar-ui.comment-dialog-update.test.js`：覆盖“评论对话框提交时会发出 ANNOTATION.UPDATE（含 id/changes），保证不会只停留在内存和 UI 层”。
  - 后端：`src/backend/msgCenter_server/handlers/pdf_viewer/annotation.py::save_annotation` 已经支持根据 Annotation JSON 中的 `title` 与 `comments` 更新 `pdf_annotation.title` 与 `json_data.comments`，此次修改只是补齐前端事件链路。
-. 验证结论：在开启 MsgCenter + PDFLibraryAPI 的环境下，通过侧边栏创建标注并在评论对话框中修改标题/添加评论后，重新加载该 PDF 时，标注列表会展示最新的标题与评论数量，且 `AnnotationManager.getStatus().mockMode === false` 时可在数据库中看到相应记录更新。
- 验证结论：在开启 MsgCenter + PDFLibraryAPI 的环境下，通过侧边栏创建标注并在评论对话框中修改标题/添加评论后，重新加载该 PDF 时，标注列表会展示最新的标题与评论数量，且 `AnnotationManager.getStatus().mockMode === false` 时可在数据库中看到相应记录更新。

### URL 导航能力的最终状态（2025-12-01 更新）

- 设计结论（对齐 pdf-url-loader README 与前端实现）：
  - 浏览器 URL 查询参数仅用于选择 PDF 文档（`pdf-id` / `title` 等），不再承担“导航到指定页码/位置/锚点/标注/大纲项”的语义。
  - 所有导航（包括 outline/annotation/anchor/resume 等）一律通过事件与 WebSocket 消息驱动：例如 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 由 WebSocketAdapter / Feature 发出，NavigationService 消费。
  - 冷启动/新窗口时，URL 只携带 `pdf-id`；后续导航由 Feature 在 `FILE.LOAD.SUCCESS` 之后发起，或由后端通过 WS 条件消息（带 gate）驱动。

- 本轮清理（2025-12-01）：
  - 移除了 PDFAnchorFeature 对 `NAVIGATION.URL_PARAMS.PARSED` 事件中 `anchorId` 的所有依赖，不再根据 URL 中的 `anchor-id` 启动锚点导航；对应测试 `anchor-url-parsed-gating.test.js` 改为断言“收到 URL 事件不再触发导航”。
  - 删除/收紧 pdf-viewer standalone launcher 及相关集成（`src/frontend/pdf-viewer/launcher.py`、`src/launcher/runner.py`、`src/integrations/anki_event_bridge.py`、`scripts/launch_anchor_from_db.py`）中通过 CLI 将 `page-at/position/anchor-id/annotation-id/outline-item-id` 拼入 URL 的逻辑，CLI 现在仅通过 `--pdf-id` 选择文档。
  - 更新 `docs/LAUNCHER-DUAL-MODE-GUIDE.md` 与 `docs/architecture/navigation.md`：去掉“URL 启动导航”示例与说明，明确标注“URL 导航功能已移除，导航统一由 Feature/WS 驱动，URL 只用于文档选择”。
  - 现有 `NAVIGATION.URL_PARAMS.*` 事件仅作为“导航事件命名空间”的一部分继续使用，不再与浏览器 URL 查询参数直接绑定。

- 防回归要点：
  - 任何新代码若尝试通过浏览器 URL 查询参数携带导航意图（page-at/position/anchor-id/annotation-id/outline-item-id），应被视为违反规范；导航入口必须通过事件/WS 统一封装。
  - 若确有需要在冷启动时导航，应通过“启动后发送导航消息（WS 或内部事件）”的方式实现，而不是扩展 URL 协议。

### NavigationService 同页位移行为（2025-12-02 更新）

- 核心结论：
  - `infra-nav-core` 中的 `NavigationService` 现在会订阅 `PDF_VIEWER_EVENTS.PAGE.CHANGING` 事件，维护一个内部的 `currentPageNumber`，用于识别“当前页内跳转”场景。
  - 当调用 `navigationService.navigateTo({ pageAt, position })` 且 `pageAt` 与最近一次 `PAGE.CHANGING` 事件中的页码相同（视为当前页），则视为“同页导航”：
    - 不再通过 `PDF_VIEWER_EVENTS.NAVIGATION.GOTO` 触发一次新的翻页（避免重复设置 `currentPageNumber` 和 PDF.js 内部滚动动画）；
    - 仍然会等待目标页 DOM 准备完成（`#waitForPageReady`），随后仅调用 `scrollToPosition(position, pageAt)` 执行平滑滚动；
    - position 为空时依旧默认滚动到该页 50% 位置，保证页面可见。
  - 当 `pageAt` 与当前页不同（跨页导航）时，行为保持不变：先发 `NAVIGATION.GOTO` 执行翻页，再在目标页就绪后调用 `scrollToPosition` 完成页内定位。
- 影响范围：
  - 所有通过 DI 获取 `navigationService` 的前端特性（如 pdf-outline、pdf-resume、pdf-annotation、pdf-url-loader 的“同文档内导航”等）都会自动获得这一“同页仅位移”的优化，无需修改调用代码。
  - 现有事件契约与函数签名未发生变化：
    - 调用方依旧只需要传入 `{ pageAt, position }`；
    - 成功返回结果结构保持 `{ success, actualPage, actualPosition, duration }`，便于现有调用方继续做日志或提示。
  - 防回归说明：
  - 新增测试文件 `src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.same-page.test.js`：
    - 覆盖“在当前页导航时不应再发 `NAVIGATION.GOTO`，但必须调用 `scrollToPosition`”这一行为；
      - 覆盖“跨页导航仍然发送 `NAVIGATION.GOTO` 并执行滚动”的原有行为，确保未被本次改动破坏。

### 前端 PyQt 窗口层复用统一（2025-12-05）

- 背景：随着 pdf-home / pdf-viewer / anno-manager / new-card-scheduler / custom-reviewer 等窗口持续增加，PyQt 启动与 JS 控制台日志记录在各模块中出现了多份相似实现，需要抽到公共层以减少重复与碎片化。
- 已有公共工具：
  - `src/frontend/common/pyqt/ports_utils.py`：统一解析 `runtime-ports.json` 并返回 `url_port/msgCenter_port/pdfFile_port`；
  - `src/frontend/common/pyqt/qt_app_runner.py`：提供 `init_qapplication(parent_app, logger, app_label)` 与 `run_event_loop_if_needed(app, mode, logger, app_label, cleanup_cb)`，由 pdf-home.launcher 与 SimpleWebWindowApp 复用；
  - `src/frontend/pyqtui/js_console_logger.py`：定义统一的 `BaseLoggingWebPage`，负责将 `javaScriptConsoleMessage` 写入 UTF-8 日志文件（强制 `\n`），并可选透传到 js_logger（如 pdf-viewer 的 JSConsoleLogger）。
- 本轮 PyQt 窗口层复用改动：
  1. **PdfViewerApp Qt 启动逻辑统一**  
     - 文件：`src/frontend/pdf-viewer/launcher.py`  
     - 将 `PdfViewerApp.run()` 中手写的 QApplication 创建/复用逻辑：  
       - 原来根据 `self.mode` 判断子进程/寄宿模式，手动调用 `QApplication(sys.argv)` 或直接复用 `parent_app` 并打印日志；  
       - 现改为统一调用 `init_qapplication(self.parent_app, logger, f"pdf-viewer[{self.pdf_id}]")`，并接收返回的 `(app, mode)`：  
         - 子进程模式：创建新的 `QApplication` 并设置 mode=`"subprocess"`；  
         - Hosted 模式：复用外部 `QApplication` 并设置 mode=`"hosted"`。  
     - 下游：事件循环仍然通过 `run_event_loop_if_needed(self.app, self.mode, logger, f"pdf-viewer[{self.pdf_id}]", cleanup_cb=self.cleanup)` 运行，保持与 pdf-home/SimpleWebWindowApp 一致的模式语义与退出日志，无行为变化。
     - 测试：新增 `src/frontend/pdf-viewer/__tests__/test_pdf_viewer_app_qt_init.py`，以契约方式约束 PdfViewerApp 必须通过公共 `init_qapplication` 完成 Qt 启动（测试在无真实 Qt 环境下通过 monkeypatch/_read_runtime_ports stub 干跑）。
  2. **pdf-home MainWindow 使用统一的 BaseLoggingWebPage**  
     - 文件：`src/frontend/pdf-home/main_window.py`  
     - 原实现：在 `_init_ui` 中定义本地的 `LoggingWebPage` 子类，手动实现 `javaScriptConsoleMessage`：  
       - 若存在 JSConsoleLogger，则透传 `log_message`；  
       - 否则使用 `with open(..., encoding='utf-8')` 写入简单的 `[ts][level][source:line] message` 格式日志；  
       - 针对 `"Console log recorded successfully"` 做专门过滤，避免心跳确认类消息污染 `pdf-home-js.log`。  
     - 新实现：  
       - 引入公共基类 `BaseLoggingWebPage`（`from src.frontend.pyqtui.js_console_logger import BaseLoggingWebPage`）；  
       - 定义轻量子类 `PdfHomeLoggingWebPage(BaseLoggingWebPage)`，仅覆盖 `javaScriptConsoleMessage`：  
         - 若 `message` 中包含 `"Console log recorded successfully"`，直接返回 `None`（过滤早期 Bridge 心跳日志）；  
         - 否则调用 `super().javaScriptConsoleMessage(...)`，复用统一的 UTF-8 + `\n` 日志写入与 js_logger 透传实现；  
       - `_init_ui` 中在 `self.web_view` 和 `page_cls` 可用时，改为：  
         - `self.web_page = PdfHomeLoggingWebPage(self.web_view, self._js_log_file, self.js_logger, pdf_id="pdf-home")`；  
         - `self.web_view.setPage(self.web_page)` 并记录一条 `"WebPage created and set on WebView (PdfHomeLoggingWebPage)"` 日志。  
     - 效果：  
       - pdf-home 与 pdf-viewer 现在在“JS 控制台转日志”的主逻辑上共用 `BaseLoggingWebPage`，后续调整日志格式/级别映射时只需修改一处；  
       - pdf-home 仍然保留对特定心跳确认日志的过滤行为，避免 `logs/pdf-home-js.log` 充斥无价值噪音；  
       - 所有文件写入继续显式使用 UTF-8，换行统一为 `\n`。  
     - 测试：新增 `src/frontend/pdf-home/__tests__/test_main_window_logging_page.py`：  
       - 动态导入 `pdf-home/main_window.py`，获取 `PdfHomeLoggingWebPage` 类型；  
       - 通过覆写 `src.frontend.pyqtui.js_console_logger.QWebEnginePage` 为一个 `_DummyQWebEnginePage` 替身，避免真实 Qt 依赖；  
       - 约束：  
         - `PdfHomeLoggingWebPage` 必须继承 `BaseLoggingWebPage`；  
         - 调用 `javaScriptConsoleMessage("InfoMessageLevel", "Console log recorded successfully", ...)` 时不应调用 `js_logger.log_message`；  
         - 对普通消息（如 `"[INFO] hello"`）则应调用一次 `js_logger.log_message`，由 BaseLoggingWebPage 完成透传逻辑。
  3. **基础校验**  
     - 运行 `python -m compileall -q src/frontend/common/pyqt src/frontend/pdf-home src/frontend/pdf-viewer/launcher.py src/frontend/pdf-home/__tests__/test_main_window_logging_page.py src/frontend/pdf-viewer/__tests__/test_pdf_viewer_app_qt_init.py`，确保改动模块在当前环境下语法正确且依赖解析正常。  
     - 由于本地环境未必安装完整的 PyQt/QtWebEngine，本轮未执行真实 GUI 集成测试；所有测试均采用“无 Qt 环境”契约式验证（通过 monkeypatch/stub 替代真实对象）。

后续建议：
- 若后续继续扩展 anno-manager / new-card-scheduler / custom-reviewer 的 PyQt Bridge 与窗口行为，可以直接复用 SimpleWebWindowApp + BaseLoggingWebPage；如需要更丰富的窗口控制（托盘、快捷键、菜单栏），可考虑为 common.pyqt 增加更通用的窗口骨架类，然后让 pdf-home/pfd-viewer/工具窗口分别继承。

### PyQt 无边框窗口与窗口控制统一（2025-12-05 更新）

- 目的：消除 pdf-home / pdf-viewer / 三个“工具窗口”（anno-manager / new-card-scheduler / custom-reviewer）在 PyQt 窗口层的重复实现，让“无边框窗口 + HTML 窗口控制（拖拽/最小化/最大化/关闭）”形成统一模式，后续扩展新窗口时直接复用。
- 新增公共工具：
  - `src/frontend/common/pyqt/window_style.py`：提供 `apply_frameless_window_flags(window, logger, label)`，统一设置 `Qt.WindowType.Window | FramelessWindowHint`，并按需记录日志；  
    - pdf-home 与 pdf-viewer 的 MainWindow 现在都通过该 helper 设置无边框样式，而不是各自直接导入 PyQt6.QtCore。
  - `src/frontend/common/pyqt/simple_window_bridge.py`：定义 `SimpleWindowBridge(QObject, WindowControlsMixin)`，仅承载窗口控制相关 slot（minimize/maximize/requestClose/start/stop drag），供 QWebChannel 注册为 `simpleWindowBridge`；  
    - 内部通过 WindowControlsMixin 复用已有窗口控制实现，不再为工具窗口单独写一套桥接类。
- SimpleWebWindowApp 改造（承载三类工具窗口的 PyQt 启动骨架）：
  - 文件：`src/frontend/common/pyqt/simple_web_window_app.py`。  
  - `SimpleWebWindow` 现在在构造时会：
    - 调用 `apply_frameless_window_flags(self, logger, label=f"simple-web-window[{title}]")`，让 anno-manager / new-card-scheduler / custom-reviewer 窗口默认无边框，标题栏完全交给 HTML + WindowControls 负责；  
    - 创建 `self.view = QWebEngineView(self)` 并配置基础 WebEngine 设置（JS/LocalStorage/禁止本地远程访问）；  
    - 尝试创建 `QWebChannel(self.view)`，实例化 `SimpleWindowBridge(parent=self)`，注册为 `"simpleWindowBridge"` 并调用 `self.view.page().setWebChannel(self.web_channel)`，使前端的 WindowControlsComponent 可以通过 QWebChannel 调用窗口控制方法；  
    - 最后加载 URL 并将 view 作为 central widget。
  - `_build_frontend_url(url_port)` 现支持从 `LaunchConfig.extra_params.client_id` 透传 clientId：  
    - 基础 URL 为 `http://localhost:<url_port>/<entry_path>/`；  
    - 若 `extra_params.client_id` 存在，则追加 `?client-id=<client_id>` 查询参数，便于前端识别窗口实例（尤其是 custom-reviewer 多实例场景）。  
    - 新增测试：`src/frontend/common/pyqt/__tests__/test_simple_web_window_url_client_id.py` 验证有/无 client_id 时 URL 构造行为。
- 后端 Hosted 启动器改造（Runner）：
  - 文件：`src/launcher/runner.py`。  
  - 在 `ensure_anno_manager_hosted` / `ensure_new_card_scheduler_hosted` / `ensure_custom_reviewer_hosted` 中，为 FE LaunchConfig 显式设置 `extra_params={"client_id": ...}`：  
    - anno-manager → client_id = `"anno-manager"`；  
    - new-card-scheduler → client_id = `"new-card-scheduler"`；  
    - custom-reviewer → 使用调用方传入的多实例 client_id（如 `"custom-reviewer-xxxx"`）。  
  - 这样前端就可以通过 URL 查询参数 `client-id` 还原出与 WindowLifecycleManager 一致的 clientId。
- 前端三类工具窗口接入 WindowControlsComponent：
  - 新增公共 Helper：`src/frontend/common/window/basic-window-controls.js`：  
    - 封装 `attachBasicWindowControls({ clientId, moduleName, bridgeName, containerSelector })`：  
      - 通过 `resolveWebSocketPortSync` + `WSClient` 创建到 MsgCenter 的 WebSocket 连接，identity 为 `{ client_name: clientId, client_id: clientId, module: moduleName }`；  
      - 构造 `WindowControlsComponent({ bridgeName, clientId, wsClient })` 并挂载到 `containerSelector`（默认 `#window-controls-slot`）；  
      - bridgeName 默认 `"simpleWindowBridge"`，与 SimpleWindowBridge 保持一致。  
  - anno-manager / new-card-scheduler / custom-reviewer 的 `main.js` 均在 bootstrap 中调用该 helper：  
    - anno-manager：`clientId="anno-manager"`，bridgeName `"simpleWindowBridge"`，挂载到 `#window-controls-slot`；  
    - new-card-scheduler：同上，clientId 为 `"new-card-scheduler"`；  
    - custom-reviewer：优先从 URL 查询参数 `client-id` 解析 clientId（由 Runner 透传）；若缺失则退回 `"custom-reviewer"`（仅作为 UI 层可识别 ID，用于 send 消息）。  
  - 三个 index.html 均补充 `<script src="/js/qwebchannel.js"></script>`，确保前端具备 `window.QWebChannel` 支持，与 pdf-home 的做法一致。
- 现状小结：
  - pdf-home / pdf-viewer / anno-manager / new-card-scheduler / custom-reviewer 现在都使用统一的 PyQt 层“无边框窗口 + WindowControlsMixin + QWebChannel”模式；  
  - 三个工具窗口前端通过 BasicWindowControls + WindowControlsComponent 获得与 pdf-home/pdf-viewer 一致的窗口控制体验（拖拽/最小化/最大化/关闭），差异仅在于功能骨架仍是“开发中”占位；  
  - 后续如果再新增 PyQt 前端窗口，可以直接复用：  
    1) SimpleWebWindowApp + SimpleWindowBridge + window_style.apply_frameless_window_flags；  
    2) basic-window-controls.js + WindowControlsComponent + WindowControlsFeature（如需接入 Feature 架构）。

### Anchor 激活会话态与侧边栏显示（2025-12-02 更新）

- 激活语义：锚点的“是否激活”是当前 pdf-viewer 窗口内的会话状态，不写入数据库。后端 `anchor_activate()` 只做存在性校验，page/position 仍通过 `ANCHOR.UPDATE` 持久化。
- 数据来源：WS 入站在 `anchor:list/get:completed` 时发出 `PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED`，payload 中可能包含历史 `is_active` 字段，但前端在标准化时一律忽略该字段，避免冷启动被旧数据污染。
- 状态源：`PDFAnchorFeature` 使用内部字段 `#anchorsById` 与 `#activeAnchorId` 维护会话内锚点列表和当前激活 ID，通过 `ANCHOR.ACTIVATE/ACTIVATED` 实现单选语义并刷新列表。
- UI 行为：`AnchorSidebarUI` 在接收 `ANCHOR.DATA.LOADED` 时只保留 `uuid/name/page_at/position`，渲染“是否激活”列时完全依据会话内的 `#activeId`（来自 `ANCHOR.ACTIVATED`），冷启动时所有行均显示为“否”，只有实际激活后对应行才会显示“是”。 

### Anchor 激活功能现状梳理（2025-12-02 仅检查）

- 结构与职责分工：
  - `PDFAnchorFeature`（`src/frontend/pdf-viewer/features/pdf-anchor/index.js`）是锚点领域的核心 Feature，负责：
    - 维护内存中的锚点列表 `#anchorsById` 与当前激活锚点 `#activeAnchorId`；
    - 消费/发出与锚点相关的领域事件：`ANCHOR.DATA.LOADED/LOAD/LOAD_FAILED/CREATE/UPDATE/DELETE/ACTIVATE/ACTIVATED/UPDATED/COPY/COPIED` 等；
    - 与 WebSocket 适配器协作完成列表加载与持久化（DATA.LOAD → WS → DATA.LOADED；CREATE/__fromFeature → WS 持久化）；
    - 在需要导航到某个锚点时，通过 `ANCHOR.NAVIGATE.REQUESTED` + `NAVIGATION.URL_PARAMS.REQUESTED` 事件与 URL 导航/NavigationService 协调。
  - `AnchorSidebarUI`（`src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js`）负责：
    - 渲染锚点侧边栏 UI（工具栏 + 表格），订阅 `ANCHOR.DATA.LOADED/UPDATED/ACTIVATED` 以刷新显示；
    - 将用户操作转成领域事件：例如“删除”“修改”“复制”“激活”等按钮对应 `ANCHOR.DELETE/UPDATE/COPY/COPIED/ACTIVATE` 事件；
    - 在激活按钮点击时，根据当前选中行 `#selectedId` 计算下一状态并发出 `ANCHOR.ACTIVATE`（带上 `active: true/false`）。
- 激活链路（代码层面）：
  1. 用户在 AnchorSidebarUI：
     - 点击表格行 → 仅更新 `#selectedId` 与行高亮（`#highlightSelection`），不直接改变激活状态（保持“选择”和“激活”概念分离）；
     - 点击工具栏中的“激活”按钮：
       - 读取当前选中锚点 `#selectedId`，根据该锚点的 `is_active` 计算 `nextActive`；
       - 发出 `PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE`，payload 为 `{ anchorId, active: nextActive }`，actorId 为 `"AnchorToolbar"`。
  2. PDFAnchorFeature 订阅 `ANCHOR.ACTIVATE`：
     - 查找内存中的锚点记录（若不存在则创建一个只含 uuid 的占位对象）；
     - 设置该锚点的 `is_active = nextActive` 并写回 `#anchorsById`；
     - 若 `nextActive === true`，则遍历其它锚点，将它们的 `is_active` 统一置为 false，实现“单选”语义；
     - 发出 `ANCHOR.ACTIVATED` 事件，payload `{ anchorId, active }`，用于让 UI/其它特性感知某个锚点的激活状态变更；
     - 调用 `#emitList()` 再次发出一轮 `ANCHOR.DATA.LOADED`（带完整 anchors 数组），用于驱动 Sidebar 刷新整表并确保“只有一行高亮”；
     - 当 active=true 时：更新 `#activeAnchorId`，并通过滚动诊断/心跳相关逻辑，在用户滚动时把当前激活锚点的位置持续回写到后端（本轮未改动，仅确认存在）。
  3. AnchorSidebarUI 订阅 `ANCHOR.ACTIVATED` 与 `ANCHOR.DATA.LOADED`：
     - 收到 `ANCHOR.ACTIVATED` 时，会更新内部 `#anchors` 数组中对应项的 `is_active` 字段，并重新渲染表格；
     - 同时，`#renderAnchors` 内部会根据 `is_active` 和当前 `#selectedId` 设置高亮行，保证前端视觉上“只有一个激活项”。
- 测试覆盖情况：
  - `anchor-activation.single-select.test.js`：
    - 通过直接对 EventBus 发出 `ANCHOR.DATA.LOADED` 注入两条锚点，随后依次发出 `ANCHOR.ACTIVATE`（先 A 后 B）；
    - 断言：
      - 至少有一次 `ANCHOR.ACTIVATED` 事件针对 A 和 B；
      - 最新一次列表（来自 `ANCHOR.DATA.LOADED`）中 `is_active === true` 的锚点数量恰好为 1，且该唯一激活项为 B。
  - `anchor-auto-activate.on-navigate-requested.test.js`：
    - 预注入两个锚点后发出 `ANCHOR.NAVIGATE.REQUESTED`（目标为 B）；
    - 验证：Feature 会自动发出 `ANCHOR.ACTIVATE` 并最终产出 `ANCHOR.ACTIVATED` 与只含一个激活项的列表，确保“按 ID 导航”路径也遵守单选语义。
  - 结合以上测试，可以确认：
    - 激活语义为“单选”，并通过事件/列表刷新得到严格验证；
    - UI 并不直接依赖内部 Map，而是通过监听 `ANCHOR.DATA.LOADED/ACTIVATED` 来同步状态，契约清晰。
- 健康度结论（截至本次检查）：
  - 从实现与测试来看，“anchor 激活”链路在以下方面工作正常：
    - 单选语义：任一时刻最多只会有一个锚点标记为 active，且测试中已验证此行为；
    - 事件广播：激活操作会发出 `ANCHOR.ACTIVATED` 以及更新后的列表（`ANCHOR.DATA.LOADED`），Sidebar UI 使用这两类事件刷新视图；
    - 自动激活：通过 `ANCHOR.NAVIGATE.REQUESTED` 触发的“按锚点导航”会自动激活目标锚点，并保持单选；
    - UI 交互：AnchorSidebarUI 工具栏中的“激活”按钮以当前选中项为基础切换 active 状态，同时更新高亮行。
  - 当前没有在代码或测试中看到明显的逻辑错误或契约冲突；如用户在实际使用中观察到“多行同时高亮”“激活状态与跳转不同步”等问题，更可能来自样式覆盖或与其它特性并发操作的 UI 现象，需要结合具体复现场景进一步排查。
  - 为了让“当前会话的激活锚点”更加直观，AnchorSidebarUI 的表格新增了一列“是否激活”，根据锚点对象上的 `is_active` 布尔字段显示“是/否”，并在接收 `ANCHOR.ACTIVATED` / `ANCHOR.DATA.LOADED` 后重新渲染，使用户可以一眼看到当前哪一条锚点处于激活状态；相关测试 `anchor-sidebar-ui.test.js` 已同步更新列头断言。

### Anchor 激活状态与 resume 门控改造（2025-12-02 更新）

- 激活状态不再写入数据库：
  - `pdf_bookanchor` 表仍保留历史上的 `json_data.is_active` 字段与唯一索引，但新的业务约定为：**激活状态仅在前端会话内生效，不再持久化**。
  - 后端 `PDFLibraryAPI.anchor_activate()` 已调整为“存在性校验 + 返回布尔值”，不再执行任何 SQL 更新 `json_data.is_active` 或 `visited_at` 字段；对应 MsgCenter 仍会返回 `anchor:activate:completed` 作为协议级确认。
  - 新增测试 `src/backend/api/__tests__/test_anchor_activation_state.py`，验证调用 `anchor_activate()` 前后 `anchor_get()` 返回的 `json_data` 中都不包含 `is_active` 字段，防止未来回归。
- WS anchor.activate 消息的前端语义：
  - `src/frontend/common/event/event-constants.js` 中的 `ANCHOR_ACTIVATE` 仍代表 WS 消息类型 `anchor:activate:requested`，但语义变为“向指定 viewer 发送激活指令”，不再承担 DB 状态更新含义。
  - 在 pdf-viewer 端，`ws-inbound-bridge` 对 `ANCHOR_ACTIVATE_COMPLETED` 的处理已改为：
    - 不再直接发出 `PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED`；
    - 而是发出 `PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED`，payload `{ anchorId, source: "ws-anchor-activate" }`，由 `PDFAnchorFeature` 统一处理激活与导航。
  - 新增测试 `src/frontend/pdf-viewer/adapters/__tests__/ws-inbound-anchor-activate-bridge.test.js`，保证 inbound 行为为“只发 NAVIGATE.REQUESTED，不发 ACTIVATED”。
- 与 resume 门控的串联：
  - `PDFAnchorFeature` 新增字段：`#useResumeGate` 与 `#gateResumeDone`，并监听 `PDF_VIEWER_EVENTS.RESUME.FLOW.DONE`：
    - 当收到 `RESUME.FLOW.DONE` 时，标记 `#gateResumeDone = true`，并尝试再次执行挂起的导航；
    - 对从 WS 激活路径进入的导航（source === "ws-anchor-activate"），会将 `#useResumeGate` 置为 `true`，要求在 `RESUME.FLOW.DONE` 触发前不会发出导航事件。
  - 原有的 `#tryNavigateWhenGatesReady()` 逻辑从“需要 `gateAnchorReady && gateRenderReady`”扩展为：
    - 在 `#useResumeGate === true` 时，额外要求 `#gateResumeDone === true`，从而实现“resume 完成后再执行导航”的门控；
    - 对本地 UI 触发的导航（source 为空或非 ws-anchor-activate）保持原有仅依赖 Anchor/Render 就绪的行为。
  - 新增测试 `src/frontend/pdf-viewer/features/pdf-anchor/__tests__/anchor-activate-resume-gate.test.js`，验证：
    - 在 `FILE.LOAD.SUCCESS` + `RENDER.READY` 已触发但尚未收到 `RESUME.FLOW.DONE` 的情况下，来自 `ws-anchor-activate` 的导航不会产生任何 `NAVIGATION.URL_PARAMS.REQUESTED`；
    - 只有在随后发出 `RESUME.FLOW.DONE` 并推进定时器后，才会发出一次 `NAVIGATION.URL_PARAMS.REQUESTED`，payload 中 `pageAt` 与锚点记录一致。

### URL 导航能力的最终状态（2025-12-01 更新）

- 设计结论（对齐 pdf-url-loader README 与前端实现）：
  - 浏览器 URL 查询参数仅用于选择 PDF 文档（`pdf-id` / `title` 等），不再承担“导航到指定页码/位置/锚点/标注/大纲项”的语义。
  - 所有导航（包括 outline/annotation/anchor/resume 等）一律通过事件与 WebSocket 消息驱动：例如 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 由 WebSocketAdapter / Feature 发出，NavigationService 消费。
  - 冷启动/新窗口时，URL 只携带 `pdf-id`；后续导航由 Feature 在 `FILE.LOAD.SUCCESS` 之后发起，或由后端通过 WS 条件消息（带 gate）驱动。

- 本轮清理（2025-12-01）：
  - 移除了 PDFAnchorFeature 对 `NAVIGATION.URL_PARAMS.PARSED` 事件中 `anchorId` 的所有依赖，不再根据 URL 中的 `anchor-id` 启动锚点导航；对应测试 `anchor-url-parsed-gating.test.js` 改为断言“收到 URL 事件不再触发导航”。
  - 删除/收紧 pdf-viewer standalone launcher 及相关集成（`src/frontend/pdf-viewer/launcher.py`、`src/launcher/runner.py`、`src/integrations/anki_event_bridge.py`、`scripts/launch_anchor_from_db.py`）中通过 CLI 将 `page-at/position/anchor-id/annotation-id/outline-item-id` 拼入 URL 的逻辑，CLI 现在仅通过 `--pdf-id` 选择文档。
  - 更新 `docs/LAUNCHER-DUAL-MODE-GUIDE.md` 与 `docs/architecture/navigation.md`：去掉“URL 启动导航”示例与说明，明确标注“URL 导航功能已移除，导航统一由 Feature/WS 驱动，URL 只用于文档选择”。
  - 现有 `NAVIGATION.URL_PARAMS.*` 事件仅作为“导航事件命名空间”的一部分继续使用，不再与浏览器 URL 查询参数直接绑定。

- 防回归要点：
  - 任何新代码若尝试通过浏览器 URL 查询参数携带导航意图（page-at/position/anchor-id/annotation-id/outline-item-id），应被视为违反规范；导航入口必须通过事件/WS 统一封装。
  - 若确有需要在冷启动时导航，应通过“启动后发送导航消息（WS 或内部事件）”的方式实现，而不是扩展 URL 协议。*** End Patch***```  পাছEassistantریشنassistant to=functions.apply_patchожу json-input-invalid error: Could not parse JSON input. Please check for formatting errors. Use double quotes for property names and strings, and ensure the input is valid JSON. Use the JSON repair tool if needed. Let's  rectify the issues and try again. Repairing JSON... to=functions.apply_patch￣奇米影视assistant to=functions.apply_patch სფერобходимости ***!

### 任务4：pdf-viewer 内部 sidebar 重复代码盘点与首轮组合式抽象（2025-11-29～30）

> 范围说明：仅关注 `src/frontend/pdf-viewer` 模块内部，与 sidebar 相关的 Feature/UI/infra 代码（包括 infra-sidebar、outline/anchor/annotation/card/translator/ai-assistant/backlink 等），不涉及与 pdf-home 的跨模块对比。2025-11-29 先完成只读分析，2025-11-30 在确保 lint 通过与行为等价的前提下，进行了小步的组合式抽象重构。

- 相关文件概览（结构保持不变，部分实现已开始组合化重构）
  - infra 层：`src/frontend/pdf-viewer/features/infra-sidebar/*`  
    - `real-sidebars.js`：注册 anchor/outline/annotation/card/translate/ai-assistant/backlink 等真实侧边栏，以及 `createRealSidebarButtons` 创建切换按钮。  
    - `sidebar-config.js`：集中管理 sidebar 配置基础结构（id/title/contentRenderer/宽度/是否可拉伸等）。  
    - `styles/sidebar-layout.css`：侧边栏布局与样式。  
  - 业务侧栏 UI：  
    - 锚点：`features/pdf-anchor/components/anchor-sidebar-ui.js`  
    - 标注：`features/pdf-annotation/components/annotation-sidebar-ui.js`  
    - 卡片：`features/pdf-card/components/card-sidebar-ui.js`  
    - 翻译：`features/pdf-translator/components/TranslatorSidebarUI.js`  
    - AI 助手：`features/ai-assistant/components/ai-assistant-sidebar-ui.js`  
    - 大纲（新）：`features/pdf-outline/components/outline-sidebar-ui.js`  
    - 大纲（经典）：`ui/outline-sidebar-ui.js`（OutlineSidebarUIClassic）

- 发现的主要重复模式与首轮组合式抽象落地情况
  1. **侧边栏容器骨架样式高度重复 → 抽出 pdf-viewer 级 sidebar-shell 纯函数**  
     - 多个 SidebarUI 类在 `initialize()` / `#createContent()` 中手动创建根容器 `div`，并重复设置类似的内联样式：  
       - `"height:100%;display:flex;flex-direction:column;box-sizing:border-box;"`（AnchorSidebarUI / CardSidebarUI / OutlineSidebarUIClassic 等）；  
       - 或 `"display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;background:#fff"`（AnnotationSidebarUI 等）。  
     - 这些类的职责本质上都是“提供一个顶部工具栏 + 下方滚动区域”的侧栏内容骨架，只是各自 copy 了一套 flex 布局与样式串。  
     - 2025-11-30 进展：在 `src/frontend/pdf-viewer/shared/sidebar-shell.js` 中新增纯函数 `createSidebarRoot({ className, extraStyle })`，统一“100% 高度 + flex column + box-sizing:border-box”的壳子样式；  
       - `features/pdf-anchor/components/anchor-sidebar-ui.js` 与 `features/pdf-card/components/card-sidebar-ui.js` 已改为通过 `createSidebarRoot()` 创建根容器，其余 DOM 结构保持不变；  
       - 抽象范围仅限 pdf-viewer 内部，后续如模式稳定可考虑上升到 common/ui。

  2. **事件订阅/解除订阅模式重复 → 接入 subscription-bag 组合管理**  
     - 原状：AnchorSidebarUI / AnnotationSidebarUI / TranslatorSidebarUI / OutlineSidebarUI / OutlineSidebarUIClassic 等，都维护类似的 `#unsubs = []` 数组：  
       - 通过 `this.#unsubs.push(this.#eventBus.on(...))` / `onGlobal(...)` 收集订阅；  
       - 在 `destroy()` 中遍历调用 `unsub()` 或 `u()`，再清空数组。  
     - 这一模式与前面为 WebSocketAdapter 抽象的 `createSubscriptionBag` 十分接近。  
     - 2025-11-30 进展：在不改变对外行为的前提下，已将以下类改为使用 `createSubscriptionBag` 组合管理订阅：  
       - `features/pdf-anchor/components/anchor-sidebar-ui.js`（AnchorSidebarUI）  
       - `features/pdf-annotation/components/annotation-sidebar-ui.js`（AnnotationSidebarUI）  
       - `features/pdf-card/components/card-sidebar-ui.js`（CardSidebarUI）  
       这些类内部不再显式维护 `#unsubs = []` 数组，统一通过 `subscriptions.add(fn)` / `subscriptions.clear()` 管理订阅生命周期，减少重复 try/catch 代码。其余 Sidebar/Feature 后续可视情况逐步迁移。  
     - 补充：在非 sidebar 的 `PDFTranslatorFeature` 中，也将事件订阅收敛到 `createSubscriptionBag`，并新增专门的订阅释放单元测试（`pdf-translator-feature.subscriptions.test.js`），用于验证 install/uninstall 会触发所有 unsubscribe。  

  3. **Outline 侧边栏存在“新旧双实现”并行的功能重复**  
     - 新版：`features/pdf-outline/components/outline-sidebar-ui.js`（类 `OutlineSidebarUI`），使用 `OutlineToolbar` + jsTree + 全局事件；  
     - 旧版：`ui/outline-sidebar-ui.js`（类 `OutlineSidebarUIClassic`），同样使用 `OutlineToolbar` + jsTree + OUTLINE.LOAD/SELECT/REORDER 事件；  
     - 注册逻辑：`features/infra-sidebar/real-sidebars.js` 中优先从容器获取 `outlineSidebarUI`，缺失时退回 `new OutlineSidebarUIClassic(eventBus)`。  
     - 两者在职责上都是“展示 PDF 大纲树 + 处理选择/拖拽/复制 ID 等交互”，只是实现细节和日志/事件使用上有所差异。当前处于“兼容期的双轨实现”，属于明确的功能级重复。后续若确认新实现稳定，可在 infra 层统一为单实现，并将旧实现降级为示例/文档代码。

  4. **real-sidebars 中各业务侧栏注册逻辑模板化重复**  
     - `real-sidebars.js` 为 anchor/annotation/card/translate/ai-assistant/backlink 等侧栏创建配置时，大致遵循同一模式：  
       - 在外层定义 `let XxxUIInstance = null;`；  
       - 在 `contentRenderer` 内部首次访问时从容器 `container.get("xxxSidebarUI")` 获取并缓存；  
       - 若未成功获取，则渲染占位 DOM（多处使用 `"padding: 20px; color: #999; text-align: center;"` 或相似样式）；  
       - 最后传入 `createSidebarConfig`，并设置 `defaultWidth/minWidth/maxWidth/resizable`。  
     - 按钮创建部分 `createRealSidebarButtons(eventBus)` 也采用统一模板：定义 `buttons` 数组（id/label/title），再为每个按钮拼接相似的 inline 样式和点击事件逻辑。  
     - 这一块可以被视为“注册/按钮工厂”已经自带的模板，后续若要减少重复，可以考虑：  
       - 抽象出 `createLazySidebarConfig({ id, title, tokenName, placeholder })`；  
       - 抽象出 `createSidebarToggleButtons({ eventBus, containerId, buttons })`。当前仅记录为潜在重构方向。

  5. **占位 UI 与“开发中”文案重复**  
     - CardSidebarUI / real-sidebars 中的 backlink 占位 / 部分未启用 sidebar（如 translation 在容器缺失时）都渲染了类似的“功能开发中/未启用”提示：  
       - 使用中心对齐的图标 + 标题 + 功能列表说明；  
       - 文案风格与样式（padding/颜色/字号）高度一致。  
     - 目前这些占位 UI 分散在多个文件中维护，如果将来要统一视觉或批量修改文案，需要逐个文件调整。后续可以考虑增加一个通用的 `createFeaturePlaceholder({ icon, title, lines })` helper 或 CSS 组件，减少重复。

- 说明
  - 本轮只读分析未改动任何 sidebar 相关业务代码，因此不会主动修复 lint 中已有的错误（例如 `outline-sidebar-ui.js` 中的缩进问题、部分工具文件中的 `no-empty`/`custom/no-silent-catch` 报错）；  
  - 运行 `pnpm exec eslint src/frontend/pdf-viewer --ext .js,.cjs,.mjs` 当前会报出若干历史问题，已在本次 AItemp 日志中记录为现状说明，而非本轮任务的一部分。  
  - 若后续决定对上述重复模式做抽象或重构，需要：  
    1) 在 `todo-and-doing/2 todo/` 新建对应需求目录与规范；  
    2) 为抽象出的 helper/组件补齐单元测试与契约测试；  
    3) 在 `architecture.md` / `tech.md` 中补充 sidebar 统一骨架/订阅模式的设计记录。


### 本次分析结论（pdf-resume 恢复页码 42→40 问题）
- 现象复述：用户在第 42 页关闭 pdf-viewer 后重新打开，同一文档会在 39–40 页之间短暂跳变，最终稳定停在第 40 页，而不是预期的 42 页。
- 关键链路：
  - 保存阶段：`PDFResumeFeature` 通过两条路径更新 resume：  
    1) `PAGE.CHANGING` 事件（由 `PDFViewerManager` 桥接 PDF.js 的 `pagechanging`），直接调用 `ResumeUpdater.setPage(pageNumber) + flush()`；  
    2) `PositionTracker` 基于 `viewerContainer` 视口中心，使用 `getCurrentPageAndPosition()`（内部调用 `detectCenterPageNumber` + `measureYPercent`）做滚动采样，同样调用 `setPage(pageAt) + flush()`。
  - 恢复阶段：`PDFResumeFeature.#applyLoadedResume()` 在收到后端的 `json_data.resume` 后，先恢复视图状态（缩放/布局/旋转），再通过 `NavigationService.navigateTo({ pageAt: resume.page, position: resume.y_percent })` 触发两步导航（`NAVIGATION.GOTO`→PDF.js 内部跳转 + `scrollToPosition` 二次平滑滚动）。
- 主要成因拆解：
  1. **保存阶段“当前页”定义不一致**  
     - PDF.js 的 `currentPageNumber` 与我们在 `pdf-page-detection-utils.detectCenterPageNumber()` 中使用的“视口中心页”不完全等价，尤其是在接近文档底部时：  
       - 用户通过页码输入或快捷跳转到第 42 页后，PDF.js 往往将第 42 页顶部对齐到视口上缘；  
       - 此时 `viewerContainer` 的**中心点**可能仍落在第 40～41 页区域（因为视口高度有限，底部无法完全再向下滚动）；  
       - 结果：`PAGE.CHANGING` 曾经发出过 `pageNumber = 42`，但用户继续微调滚动后，最后一个触发 resume 的事件往往来自 `PositionTracker`，其基于“中心页”检测出的 `pageAt` 可能是 40 或 41，而不是 42。  
     - `ResumeUpdater.flush()` 采用“最后一次 setPage 为准”的策略：如果最近一次调用来自 PositionTracker（`pageAt = 40`），则最终写入的 resume.page 就是 40，即使 PDF.js 内部的 `currentPageNumber` 仍为 42。
  2. **两步导航 + 位置测量的边界效应**  
     - 恢复时，`NavigationService.navigateTo()` 会：  
       1) 通过 `NAVIGATION.GOTO` 事件驱动 PDF.js 跳转到 `pageAt` 页面（内部有自己的滚动动画）；  
       2) 等待 `#waitForPageReady(pageAt)` + 额外 100ms，随后在我们的 DOM 层执行 `scrollToPosition(position, pageAt)`：  
          - 该方法尝试把“目标页中 y_percent 对应的点”放到视口中心；  
          - 但若目标页接近文档底部，理论上的中心位置会超出文档最大 `scrollTop`，代码里会被 `maxScrollTop` 截断；  
          - 被截断后，实际视口中心会偏上（落在上一两页的中部），这进一步放大了“保存阶段用中心页”的偏差。  
     - 从用户感知来看，这种“PDF.js 自己滚一段 + 我们再滚一段 + 边界截断”组合，很容易表现为：打开时先看到 39 页附近一闪，再滑到 40 页附近稳定下来，看不到 42 页，给人的直观印象就是“在 39–40 之间抖动，最后停在 40 页”。
  3. **中间状态写回的问题在上一轮已通过冻结机制缓解，但仍会放大上述偏差**  
     - 之前的 bug：在恢复导航过程中，PDF.js 的 `pagechanging` 会依次发出如 39→40→41→42 的中间页码；旧版本的 `PDFResumeFeature` 会立刻把这些中间页码写入 resume，导致“刚跳到 42，立刻又把 40 写回数据库”。  
     - 当前代码中已在 `PDFResumeFeature.#applyLoadedResume()` 中对 `PositionTracker` 调用 `freezeFor(3000)`，并在 `PAGE.CHANGING`/`ZOOM.CHANGING` 处理器里检查 `isFrozen`，避免恢复期间的中间状态被回写，这一块已经基本锁死。  
     - 但这只解决了“恢复期间写错”的问题，并**没有改变**“平时阅读时最后一次滚动由中心页检测驱动”的策略，因此在高页码 + 底部边界场景下，**保存下来的 resume 本身就有页码偏差（42 → 40）**，恢复逻辑只是在忠实执行这个“错误的真相”。  

- 结论：  
  - 当前 42→40 问题不是单一函数的 off-by-one，而是 **“中心页检测 + 两步导航 + 底部滚动边界 + 以最后一次 PositionTracker 写入为准”** 叠加造成的系统性偏差：  
    - 在文档中部时，中心页 ≈ 当前页，行为正常；  
    - 在接近末尾时，中心页倾向于落在倒数第二、第三页，导致 resume.page 往前飘；  
    - 再加上恢复时的两步滚动动画，用户会明显看到“先在 39–40 抖一阵，最后停在 40”，而从未真正停在 42。  
  - 之前增加冻结（freeze）的修复主要阻止了“恢复过程把中间页码写回 resume”的回归风险；本次分析进一步确认了**保存策略本身在高页码场景下对“当前页”的定义存在误差**，这是用户现在仍然能复现 42→40 现象的根本原因。

### 追加思路记录：事件状态字典 + once/on 条件触发（2025-11-28）
- 背景：用户希望在 MsgCenter 仅做“干净转发”的前提下，为 pdf-viewer 端的 WS 消息增加“带条件执行”的能力，例如：  
  - 在 pdf-viewer 打开并完成初始渲染（RENDER.READY）之后，再执行 outline 跳转或其它导航。  
- 约束：  
  - MsgCenter 只做转发，不理解 UI 事件；  
  - 条件判断逻辑应放在 pdf-viewer 这一端的 WebSocket 客户端上（ws-client / WebSocketAdapter），由前端自行决定“何时执行真正导航”。  
- 提议的机制：**事件状态字典 + waitForEventOnce / waitForNextEvent helper**  
  1. 由 pdf-viewer 维护一个统一的事件状态表，例如：  
     - `window.pdf_viewer_status.events[eventName] = { fired: boolean, count: number, lastPayload, lastAt }`；  
     - 每次通过 EventBus 观察到某个事件（如 `pdf-viewer:render:ready`）时，调用一个集中封装的 `markEventFired(name, payload)` 去更新字典：  
       - `fired = true`、`count += 1`、`lastPayload = payload`、`lastAt = Date.now()`。  
  2. 在 pdf-viewer WebSocket 客户端侧，扩展 WS 消息协议：  
     - 例如增加一个可选字段 `gate`：  
       - `gate: { once: "pdf-viewer:render:ready" }` 表示：若 READY 已经发生过则立即执行，否则等待**首次** READY 再执行一次；  
       - `gate: { on: "pdf-viewer:render:ready" }` 表示：无论之前 READY 是否发生过，都等待**下一次** READY 事件后执行。  
  3. 为避免“先读状态再订阅”带来的竞态，所有“等待某事件后执行”的逻辑必须集中封装，例如：  
     ```js
     function waitForEventOnce(eventName) {
       return new Promise((resolve) => {
         const off = eventBus.on(eventName, (payload) => {
           off();
           resolve(payload);
         });
         const status = window.pdf_viewer_status?.events?.[eventName];
         if (status?.fired) {
           off();
           resolve(status.lastPayload);
         }
       });
     }
     ```  
     - 先订阅，再检查 `status.fired`，可以保证：  
       - 如果事件在 helper 调用之前就已经发出，状态字典会显示 `fired=true`，helper 会同步 resolve；  
       - 如果事件在 helper 调用之后发出，则 listener 会捕获，不会“错过” READY。  
     - `waitForNextEvent(eventName)` 则只订阅，不看状态，用于语义上的 `on`。  
  4. 一次性/状态型事件的重置：  
     - 对 `RENDER.READY` 一类事件，每次新 PDF 加载（`FILE.LOAD.REQUESTED` 或 `FILE.LOAD.SUCCESS` 前）应重置对应的状态：  
       - `window.pdf_viewer_status.events[PDF_VIEWER_EVENTS.RENDER.READY] = { fired: false, count: 0, lastPayload: null, lastAt: null }`；  
     - 对生命周期长的状态（例如 client 注册成功）可在整个 viewer 生命周期内保持为 true。  
- 使用上的建议：  
  - “事件状态字典”可以对所有事件记录 fired/count/lastPayload，以便调试和统计；  
  - 但 `once` 的实际业务语义主要针对“状态型事件”（ready / registered / loaded），对高频动作型事件（例如 PAGE.CHANGING）通常只需要 `on`；  
  - 所有依赖 READY 才执行的逻辑（例如基于 WS 的 outline 跳转）应统一经由 helper，而不是到处手写 `if (status) { ... } else { on(...) }`。

---

### 本次分析结论（2025-11-29：pdf-viewer / pdf-home 重复功能与抽象方向）

> 目标：识别前端 pdf-viewer 与 pdf-home 中「功能相同但各自实现」的部分，以便后续抽象到 `src/frontend/common/**`，优先采用“组合优于继承”的模式。

1. 应用容器与 WSClient 生命周期管理：模式相同，具体实现各写一套  
   - pdf-viewer：`src/frontend/pdf-viewer/container/app-container.js`  
     - 提供 `createPDFViewerContainer({ wsUrl, enableValidation, logger })`，内部负责：  
       - 基于 `event-bus` 单例和 `WSClient` 创建基础设施；  
       - 管理 `connect/disconnect/reloadData/dispose/updateWebSocketUrl` 等生命周期；  
       - 通过 `setGlobalWebSocketClient` 暴露 WSClient；  
       - 内建与 ConsoleWebSocketBridge 的禁用逻辑，避免日志循环。  
   - pdf-home：`src/frontend/pdf-home/container/app-container.js`  
     - 提供 `createPDFHomeContainer({ root, wsUrl, logger, enableValidation })`，内部负责：  
       - 基于 `DependencyContainer` 注册 `logger/eventBus/wsClient` 等核心服务；  
       - 暴露 `connect/disconnect/reloadData/dispose/getDependencies/initialize/isInitialized`；  
       - 通过 `ensureUI/ensureEventBridges` 挂载 UI 管理器与业务事件桥接；  
       - 同样使用 `buildWsUrlFromQuery` 和共享的 `eventBusSingleton/WSClient`。  
   - 结论：两边在“容器 + WSClient 生命周期 + getDependencies/initialize”层面高度相似，只是：  
     - pdf-viewer 手写对象 + ConsoleBridge 管理；  
     - pdf-home 走通用 `DependencyContainer` 路线。  
   - 抽象方向（建议）：在 `src/frontend/common/containers/` 下强化 `app-container-base.js`：  
     - 提取“事件总线 + WSClient + initialize/connect/disconnect/updateWebSocketUrl”的公共骨架；  
     - 通过「选项 + 钩子」的组合方式让子模块注入：  
       - `resolveWsUrl()`（例如从 URL 参数解析 `msgCenter` 端口）；  
       - `registerGlobalServices(container)`（pdf-home 用 DI，pdf-viewer 用 setGlobalWebSocketClient）；  
       - `onConnected/afterConnected`（用于触发首轮 list 请求或其他初始化操作）。  
     - pdf-viewer / pdf-home 的具体容器只保留最小差异和 UI 相关逻辑。  

2. 基础设施 Feature：infra-app 模式在两个模块中重复实现  
   - pdf-viewer：`src/frontend/pdf-viewer/features/infra-app/index.js`（AppCoreFeature）  
     - 职责：  
       - 创建并初始化 `createPDFViewerContainer`；  
       - 通过 `setupWsInfra` 安装 `WebSocketAdapter` + `WebSocketAdapterViewer`；  
       - 将 `wsClient` 注册到根容器供其他 Feature 使用；  
       - 安装 `WebSocketErrorHandler` 做统一错误 toast。  
   - pdf-home：`src/frontend/pdf-home/features/infra-app/index.js`（PDFHomeInfraAppFeature）  
     - 职责：  
       - 通过 `setupWsInfra` 安装 `WebSocketAdapterHome`；  
       - 负责适配器的生命周期（install/uninstall 调用 WsInfra.dispose）。  
   - 结论：两边都实现了“基础设施 Feature（infra-app）+ WsInfra 安装适配器 + 统一错误处理”的模式，只是：  
     - pdf-viewer infra-app 额外负责创建容器和注册 wsClient；  
     - pdf-home infra-app 更轻，只管适配器安装。  
   - 抽象方向（建议）：在 `common/features/ws-infra/` 下增加一个“Feature 模板”工厂，例如 `createInfraAppFeature({ name, resolveContainer, adapterFactories, withErrorHandler })`：  
     - 内部统一处理 install/uninstall、WsInfra 安装/销毁、WebSocketErrorHandler 注册；  
     - 调用方只负责提供 `adapterFactories` 和容器获取方式；  
     - pdf-viewer / pdf-home 分别通过该工厂创建自己的 infra-app，实现“同一模式、不同组合配置”。  

3. 模块专属 WebSocketAdapter：注册身份逻辑已统一到基类，但业务处理仍分散  
   - pdf-viewer：`WebSocketAdapterViewer`（`src/frontend/pdf-viewer/adapters/websocket-adapter-viewer.js`）  
     - 继承 `WebSocketAdapterBase`，主要负责：  
       - 从 URL 解析 `pdf-id`；  
       - 生成 `client_id = pdf-viewer-{pdf-id or viewerInstanceId}`；  
       - 填充 `client_type` / `capabilities` / `metadata`（包含迁移标记与调试字段）。  
   - pdf-home：`WebSocketAdapterHome`（`src/frontend/pdf-home/adapters/websocket-adapter-home.js`）  
     - 同样继承基类，负责：  
       - 固定 `client_id = pdf-home`；  
       - `client_type = [\"window:pdf-home\",\"singleton\"]`；  
       - 填充 library-management/search/file-operations 能力与 window_type 元数据。  
   - 结论：  
     - “模块专属适配器 + 继承 WebSocketAdapterBase + 提供 _getRegistrationConfig” 已经是共享模式；  
     - 当前无需再抽象，只需要在新增模块时继续沿用这一模式（组合点已经落在 WsInfra Feature 上）。  
   - 抽象方向（偏规范）：在 tech/SPEC 中明确：  
     - 所有前端窗口（pdf-home/pdf-viewer/将来新模块）都应通过“专属 Adapter + WebSocketAdapterBase + WsInfra”组合实现注册，不再直接在容器或业务代码中手写 `client_id`/`client_type`。  

4. WS 消息 → 领域事件映射：pdf-home 已集中到 common，pdf-viewer 仍在模块内适配器  
   - pdf-home：  
     - `src/frontend/common/pdf/websocket-handler.js` 提供统一的 WS → 领域事件桥接（例：record-update:completed/failed → `PDF_MANAGEMENT_EVENTS.EDIT.*`）；  
     - pdf-home Feature（如 `features/pdf-edit/index.js`）只关心 `PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED/FAILED`，不再直接处理裸 WS 消息。  
   - pdf-viewer：  
     - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`：  
       - 在同一个类中处理 outline/anchor/navigation/resume 等多个域；  
       - 直接订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`，根据 `WEBSOCKET_MESSAGE_TYPES.*` 发射 `PDF_VIEWER_EVENTS.*`；  
       - 在适配器层承担了较多业务路由和诊断日志职责。  
   - 结论：职责相同（协议→领域事件），落点不同（pdf-home 已抽象在 common，pdf-viewer 仍在模块内），这属于“可以进一步抽象”的重复模式。  
   - 抽象方向（建议）：  
     - 在 `src/frontend/common/pdf/` 下进一步引入“viewer 侧 WS handler 模板”，例如：  
       - `viewer-websocket-outline-handler.js`、`viewer-websocket-anchor-handler.js`，内部只关心：  
         - 各自域的 WEBSOCKET_MESSAGE_TYPES 与 PDF_VIEWER_EVENTS 映射；  
         - 与 gate-runner（`common/ws/ws-gate-runner.js`）和 ws-gate-utils 的协同；  
       - WebSocketAdapter 只负责：  
         - 订阅 WS 消息并按“域”分发给这些 handler；  
         - 做少量跨域调度与队列管理。  
     - 这样 pdf-viewer 也能与 pdf-home 一样，通过 common handler 复用样板逻辑，降低适配器文件体积与重复代码。  

5. Feature Registry + 事件驱动架构：两侧已经共享相同基础设施  
   - pdf-home：`core/pdf-home-app-v2.js` 使用 `createAppContainer` + `createFeatureRegistry` + `StateManager` + `FeatureFlagManager` 组合，注册 `PDFHomeInfraAppFeature`、搜索/筛选/侧边栏/编辑等多个 Feature。  
   - pdf-viewer：`bootstrap/app-bootstrap-feature.js` + `features/README.md` 同样通过 `createAppContainer` + `createFeatureRegistry` 组织 Feature，注册 `AppCoreFeature`、PDFManagerFeature、Outline/Annotation/Resume/WindowControls 等。  
   - 结论：在架构模式层面已统一到 common micro-service 体系，此处不需要再做抽象。  

6. 抽象策略小结：组合优于继承  
   - 优先级高的抽象点：  
     1) 容器层骨架：在 `common/containers` 强化基类/工厂，通过 options + hook 组合出 pdf-viewer/pdf-home 的差异；  
     2) infra-app Feature 工厂：在 `common/features/ws-infra` 提供创建 infra-app Feature 的工厂方法，子模块只提供 adapterFactories / 容器 getter；  
     3) WS→领域事件 handler 拆分到 common：把 pdf-viewer 适配器里按业务域拆开的映射逻辑迁移到 `common/pdf/**` 的独立 handler 中。  
   - 继承仅保留在：  
     - WebSocketAdapterBase → WebSocketAdapterHome / WebSocketAdapterViewer 这一层，用来实现“模块身份”的自定义注册。  
   - 这样可以在不打破现有 Feature 架构与测试的前提下，逐步减少 pdf-viewer / pdf-home 内部“看起来相似、实则各写一份”的基础设施代码。  

### 2025-11-30 WS 条件消息（gate）类型与实现现状盘点

> 目标：整理当前“带 gate 条件的 WS 消息类型”在前端代码中的实际使用情况，明确哪些消息已经接入 gate.once/on/timeout_ms 语义，哪些仍停留在规范文档层面，方便后续扩大 gate 应用范围时参考。

- 公共工具层（common/ws）
  - `src/frontend/common/ws/ws-gate-utils.js`：提供 `validateGateConfig(rawGate)`，统一校验与规范化 WS 消息上的 `gate` 字段，支持：
    - `gate.once: string`：等待某“状态型事件”已发生或下一次发生（常用于 pdf-viewer:render:ready 这类 READY 事件）；
    - `gate.on: string`：等待某动作型事件的下一次发生（不关心历史）；
    - `gate.timeout_ms?: number`：可选超时（毫秒，正整数）；非法配置一律抛错（Fail-Fast），禁止兜底。
  - `src/frontend/common/ws/ws-gate-runner.js`：基于 EventBus 与内存状态字典实现 gate 执行逻辑：
    - `createEventStatusStore()`：创建 `{ events: { [eventName]: { fired,count,lastPayload,lastAt } } }` 结构，用于记录 READY 类事件的触发历史；
    - `markEventFired(store, eventName, payload)`：在状态型事件发生时更新 store；
    - `runWithGate({ eventBus, store, rawGate, run })`：统一解释 `gate.once/gate.on/timeout_ms`，在条件满足后执行 `run(payload)`，未配置 gate 时直接执行 run。
  - 对 gate 工具有独立单元测试：`src/frontend/common/ws/__tests__/ws-gate-utils.test.js` 验证各种合法/非法 gate 结构；ws-gate-runner 的行为在 pdf-viewer 端测试中覆盖（见下文）。

- pdf-viewer 端：当前唯一实际应用 gate 的消息类型
  - 适配器：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`
    - 在处理 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED` 时，使用 `runWithGate` 包裹导航逻辑：
      - 入口：`case WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED: { ... runWithGate({ eventBus, store: this.#eventStatusStore, rawGate: message?.gate, run: async () => this.#handleViewerNavigate(message, correlationId) }) ... }`；
      - 若 gate 执行抛错（包括 timeout）则发送 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED`，错误码为 `"GATE_FAILED"`，并记录日志 `"[Navigate] gate execution failed"`。
    - 为 gate 提供状态事件观测入口：`#setupGateStatusObservers()` 中订阅 `PDF_VIEWER_EVENTS.RENDER.READY`：
      - 每次 READY 触发时调用 `markEventFired(this.#eventStatusStore, PDF_VIEWER_EVENTS.RENDER.READY, payload)`，这样 `gate.once: PDF_VIEWER_EVENTS.RENDER.READY` 能够利用历史事件立即执行或等待下一次 READY。
  - 单元测试：
    - `src/frontend/pdf-viewer/adapters/__tests__/event-gate-runner.test.js`：直接针对 runWithGate 语义做测试（once 有历史 & 无历史、on 仅下一次触发、timeout 超时抛错等），验证公共 gate-runner 行为；
    - `src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-gate.test.js`：从适配器层验证 `VIEWER_NAVIGATE_REQUESTED` 携带/不携带 gate 时的行为：
      - 无 gate：立即执行导航，不等待 READY；
      - `gate.once: PDF_VIEWER_EVENTS.RENDER.READY`：在 READY 之前发来的请求会挂起，直到 READY 事件触发后才执行导航；
      - 携带超时时间且迟迟未 READY：触发 `VIEWER_NAVIGATE_FAILED`，error.code 为 `"GATE_FAILED"`。
  - 规范文档：
    - `src/frontend/pdf-viewer/docs/SPEC/PDF-VIEWER-WEBSOCKET-CONTRACT-001.md` 中已经将 `gate` 字段作为 pdf-viewer WS 消息的通用条件执行约定，并给出示例：
      - 例如 `{"type":"pdf-viewer:navigate:requested", "data":{...}, "gate":{"once":"pdf-viewer:render:ready","timeout_ms":2500}}`。
    - 文档建议所有需要“等待渲染完成再执行”的 WS 请求统一使用该格式。

- pdf-home 端：目前仅在规范层面定义 gate，尚未有实际代码接入
  - 文档：`src/frontend/pdf-home/docs/SPEC/PDFHOME-WEBSOCKET-INTEGRATION-001.md` 复用了与 pdf-viewer 相同的 gate 约定：
    - 同样说明 `gate.once/on/timeout_ms`，并给出发向 pdf-viewer 的导航请求示例；
    - 要求 pdf-home 在发起“受前端状态约束”的 WS 请求（例如需要确认目标 viewer 已 render:ready）时使用统一 gate 格式。
  - 代码现状：截至本次扫描，pdf-home 的前端实现中尚未发现对 `gate` 字段或 `runWithGate` 的实际调用，说明：
    - pdf-home 目前仍将 gate 视为“对 pdf-viewer 的调用契约”，自身并未发出带 gate 的条件 WS 请求；
    - 一旦后续需要由 pdf-home 主动发起需要等待 viewer READY 的请求，可以直接复用 common/ws 层的 gate 工具。

- 其他模块与消息类型
  - 除 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED` 外，当前前端代码中没有其他 WS 消息类型实际携带 `gate` 字段参与条件执行；
  - Anchor/Outline/Resume 等业务场景虽然在规范和测试中与导航行为相关，但并未单独定义新的“条件消息类型”，而是依附于导航请求本身：
    - 例如 Outline 导航最终也通过 viewer 端 `VIEWER_NAVIGATE_REQUESTED` 消息触发实际页面跳转，因此其条件执行能力由导航消息的 gate 实现承担；
    - Resume 写入/应用目前仍走各自既有链路，未启用 gate。

- 总结（当前阶段性结论）
  - 公共 gate 工具（validateGateConfig + runWithGate + 事件状态存储）已经抽象到 `common/ws`，并通过单元测试验证；
  - **实际落地的“带 gate 条件的 WS 消息类型”目前只有一个：`WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED`**，由 pdf-viewer WebSocketAdapter 在 inbound 处理时应用 gate：
    - 支持 once/on/timeout_ms；
    - READY 事件通过 `PDF_VIEWER_EVENTS.RENDER.READY` 统一观测；
    - 失败场景统一回 `VIEWER_NAVIGATE_FAILED`，error.code = "GATE_FAILED"。
  - pdf-home 端目前仅在规范中声明 gate 协议，尚未在具体代码中发出带 gate 的 WS 请求；未来如需要，可以直接依赖 `common/ws/ws-gate-utils.js` 与 `ws-gate-runner.js`，避免重复造轮子。

## 2025-12-01：前端结构图分析任务记录

- 已基于 src/frontend 目录结构与 ARCHITECTURE-EXPLAINED.md 生成《前端结构图与架构说明》（AItemp/reports/frontend-architecture-20251201120842.md），总结 common/pdf-home/pdf-viewer 的分层与模块关系，供后续重构和答复用户使用。

## 2025-12-01：后端架构 Mermaid 图记录

- 已在 AItemp/reports/backend-architecture-20251201131315.md 中补充后端整体结构 Mermaid 图（launcher/launcher_core/msgCenter_server/pdfFile_server/api/database/pdf_manager/logging/linters 关系），可与前端结构图报告配套使用。

## 2025-12-01：维护清理指南文档

- 已新增 docs/MAINTENANCE-CLEANUP-GUIDE.md，用于规范“过时代码清理”和“过时文档清理”的流程（识别依据、小步清理步骤、归档与 Memory Bank 记录方式、自检清单），后续涉及重构/归档时应优先参考该文档。

## 2025-12-01：清理过时文档目录 docs/TODO

- 初步检查 docs 下文档后，确认 docs/TODO 目录为空且在仓库中无任何引用，同时实际任务管理流程已统一使用根目录 todo-and-doing/，故将 docs/TODO 视为过时目录并直接删除；后续如需查看任务规划，请以 todo-and-doing 为准。

## 2025-12-01：文档与代码实现对齐（首轮）

- 使用 AItemp/attempts/doc_scan_paths.py 扫描 docs/**.md 中的 src/tests 路径，对比当前代码，标记出若干仅存在于旧版 pdf-home v1 或早期集成方案中的路径；对相关索引与规范文档（如 docs/index/frontend/modules/*、WEBSOCKET-INTEGRATION、部分 SPEC/TESTING 文档）增加“历史/规划性说明”，以免读者误以为这些路径仍然存在或已经落地实现。

## 2025-12-02：pdf-resume DOM 事件层现状梳理

- 现有“DOM 事件层”相关抽象：
  - `src/frontend/pdf-viewer/shared/position-tracker.js` 为 pdf-viewer 提供统一的滚动位置追踪工具：在 `viewerContainer` 上集中监听 `wheel` / `scroll` / `click` 事件，做去抖动（`debounceMs`）、冻结（`freezeFor`）、位置采样（`getCurrentPageAndPosition`）和重复过滤，最终通过回调暴露 `{ pageAt, position }`，目前被 `PDFResumeFeature` 作为“位置变更源”使用。
  - `src/frontend/pdf-viewer/ui/keyboard-handler.js` 统一处理键盘快捷键（箭头翻页、Home/End、Ctrl+F/Ctrl+0 等），将键盘输入转换为 `PDF_VIEWER_EVENTS.NAVIGATION.*` / `PDF_VIEWER_EVENTS.ZOOM.*` 等域事件；`UIManagerCore` 在初始化时负责安装/移除该键盘监听，等价于“键盘 → EventBus”的适配层。
  - `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js` 还在 `viewerContainer` 上挂载了滚轮监听，用于 Ctrl/Cmd+Wheel 触发缩放事件，与 PositionTracker 共享同一 DOM 容器但职责不同（UIManagerCore 负责缩放，PositionTracker 负责阅读位置采样）。
- 与 resume 触发条件的关系：
  - 当前 `PDFResumeFeature` 已经使用 PositionTracker 作为 DOM 事件入口：`onPositionChange` 仅调用 `ResumeUpdater.setPage(pageAt)` 更新内存中的“最近阅读页”，不直接写入数据库；真正的持久化仍由 `#startHeartbeat()` 创建的 3 秒定时器驱动，在 `#performHeartbeatSync()` 中读取 PositionTracker 快照或 `pdfViewerManager.currentPageNumber` 后再调用 `ResumeUpdater.flush()`。
  - 因此，从架构角度看：**滚动/点击/滚轮事件已经被 PositionTracker 统一抽象为“位置变更回调”，但“何时写入 DB”仍是独立的 3 秒心跳逻辑，而不是事件驱动。**
- 缺失点与后续改造空间（供本轮任务使用）：
  - 仓库中目前没有一个专门命名为“DOM 事件管理层”的独立模块，最接近用户设想的层次是 PositionTracker（DOM → 位置变更）与 KeyboardHandler（键盘 → EventBus）这两个适配器。
  - 若要实现“鼠标/滚轮/键盘事件触发 + 每秒最多写入一次”的 resume 行为，更合理的方案是：复用 PositionTracker 作为鼠标/滚轮/滚动的 DOM 源头，在 `PDFResumeFeature` 内将 3 秒心跳改为“基于 PositionTracker 的位置变更回调 + 1 秒节流的 ResumeUpdater.flush”，并视需要订阅导航事件（由 KeyboardHandler/NavigationService 触发）来覆盖纯键盘翻页场景，而不是额外新建一层散射的 DOM 事件管理模块。

## 2025-12-02：自动文档生成方案设计

- 新增 docs/engineering/AUTO-DOC-GENERATION.md，说明如何基于现有 JSDoc（前端）和 Python docstring（后端）使用 jsdoc/pdoc 生成 HTML 文档，当前仅提供配置与命令建议，不直接修改 package.json 或 requirements.txt，由维护者按需落地。

- 后端自动文档：可使用 tools/generate_backend_docs.py 调用 pdoc，为 standard_server/embed_fileserver/launcher 生成 HTML 文档（输出到 AItemp/docs/backend-api）；需要先在虚拟环境中安装 python -m pip install pdoc。

## 2025-12-03：pdf-anchor 取消激活、位置更新与导航闸门重构

- 会话态设计：anchor 激活状态仅存在于当前前端会话内，不写入数据库，也不通过 URL 恢复；PDFAnchorFeature 使用内部字段 `#activeAnchorId` 作为唯一激活源，所有从后端返回的锚点列表（`ANCHOR.DATA.LOADED`）在进入特性层时都会被标准化为“忽略 payload 中的 is_active，仅根据 `#activeAnchorId` 决定 is_active 标记”，以保证冷启动时所有锚点均为未激活。
- 前端取消激活链路：AnchorSidebarUI 工具栏提供“取消激活”按钮，在当前有选中锚点时会发出 `PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE`，payload 为 `{ anchorId, active: false }`；PDFAnchorFeature 订阅该事件后，会更新内部 Map 中对应锚点的 `is_active` 字段，并在需要时清空 `#activeAnchorId`，从而让后续的滚动/位置追踪不再对任何锚点写回位置；同时依次广播 `ANCHOR.ACTIVATED(active:false)` 与刷新列表的 `ANCHOR.DATA.LOADED`，侧边栏通过订阅 ACTIVATED 事件维护会话内 `#activeId` 并用以驱动“是否激活”列的展示。
- WebSocket 协作：同一个 `ANCHOR.ACTIVATE(active:false)` 事件还会被 WebSocketAdapter 转发为 `anchor:activate:requested`，后端经 `activate_anchor()` 校验成功后发出 `anchor:activate:completed(active:false)`；ws-inbound-bridge 将其桥接为 `ANCHOR.ACTIVATED(active:false)`，从而保证在多窗口/多实例场景下，其他前端在收到该消息时也能同步清除本地“激活”显示，但数据库层面不保存激活态。
- 位置更新机制统一：anchor 与 pdf-resume 均复用 `PositionTracker` 作为滚动/点击/滚轮的 DOM 事件源；PDFAnchorFeature 在存在 `#activeAnchorId` 时才响应 `onPositionChange(pageAt, position)` 回调，并以“1 秒节流 + 每次回调只写一次”的方式发出 `ANCHOR.UPDATE/ANCHOR.UPDATED`（持久化 `page_at/position`）；导航触发时通过 `positionTracker.freezeFor(3000)` 冻结 3 秒内的回调，避免刚跳转完成就被新的采样位置覆盖；不再使用内部心跳定时器与自建滚动诊断监听。
- 导航闸门重构（废弃旧 gate 实现）：
  - 旧实现中 PDFAnchorFeature 维护了 `#useGateNav/#gateAnchorReady/#gateRenderReady/#gateNavDone/#pendingNav` 等字段，并在 FILE.LOAD.SUCCESS / RENDER.READY / ANCHOR.DATA.LOADED / ANCHOR.NAVIGATE.REQUESTED 之间通过 `#tryNavigateWhenGatesReady()` 做二次“并发闸门”；该逻辑最初为 URL 启动导航设计，在 URL 导航能力被彻底移除后，其价值与复杂度不再匹配。
  - 2025-12-03 起，pdf-anchor 中这套 gate 字段与 `#tryNavigateWhenGatesReady()` 已彻底移除，改为：
    - 新增私有方法 `#navigateToAnchor(anchorId)`，统一执行“根据锚点 page_at/position 计算百分比 → 发出 ANCHOR.ACTIVATE(active:true) 激活锚点 → 发出 NAVIGATION.URL_PARAMS.REQUESTED 导航事件，并记录 #lastNav / 冻结心跳写回”；
    - `ANCHOR.NAVIGATE.REQUESTED` 收到请求后：若锚点已在本地 `#anchorsById` 中，则直接调用 `#navigateToAnchor(anchorId)`；若尚未加载，则记录 `#pendingAnchorIdForNavigate` 并发出 `ANCHOR.DATA.LOAD`，待 `ANCHOR.DATA.LOADED` 中识别到该锚点后再调用 `#navigateToAnchor` 完成一次导航；不再依赖渲染/文件 gate。
    - FILE.LOAD.SUCCESS 与 RENDER.READY 现在只负责拉取列表与安装滚动诊断，不再为 anchor 导航维护额外的 gate 状态，渲染就绪的条件执行统一由 WebSocketAdapter + NavigationService 的 gate 机制负责。
- Bug 修复：此前由于 `#gateNavDone` 在首次导航后被永久置为 true，导致“取消激活后再次点击激活”时不会再调用 `NAVIGATION.URL_PARAMS.REQUESTED`，表现为只更新激活状态和滚动采样但不跳转。随着旧 gate 被移除，`ANCHOR.NAVIGATE.REQUESTED` 每次都会调用 `#navigateToAnchor`，已经修复“第二次激活不跳转”的问题。
- 测试覆盖：
  - 继续保留 `anchor-activation.single-select.test.js`（单选激活语义）与 `anchor-auto-activate.on-navigate-requested.test.js`（通过 ANCHOR.NAVIGATE.REQUESTED 自动激活目标锚点）的既有用例，确认在移除 gate 后激活行为不变；
  - 新增 `anchor-reactivate.after-deactivate.test.js`：构造一个锚点，依次触发 `ANCHOR.NAVIGATE.REQUESTED → ANCHOR.ACTIVATE(active:false) → ANCHOR.NAVIGATE.REQUESTED`，断言 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 共被发出两次且 anchorId 一致，防止“只能跳一次”的回归。
\n\n## 2025-12-03 git 提交记录\n- 任务：统一 pdf-anchor 与 pdf-resume 的位置追踪/写回机制，并提交当前改动。\n- 操作：\n  - 按规范读取最近 8 条 AI 工作日志与 memory bank（architecture/context/tech）。\n  - 新建两条工作日志记录本次任务目标与执行结果。\n  - 运行 pnpm lint，确认目前存在大量历史 ESLint 问题（未在本轮处理）。\n  - 使用 git add -A 暂存全部改动，并执行一次提交。\n- 提交信息：eat(pdf-anchor): unify anchor position tracking and update mechanism。\n- 影响范围：pdf-viewer/pdf-anchor Feature、WS inbound bridge、memory-bank 文档与若干测试/工具脚本。\n

## 2025-12-03 AnnotationSidebarUI 管理器按钮接入
- 为 pdf-viewer 新增通用侧边栏 Header 工具 shared/sidebar-shell-header.js，统一提供‘标题 + 可选方框按钮 + 关闭按钮’布局（默认方框按钮隐藏）。
- 在 AnnotationSidebarUI 中集成该 Header：
  - 标注侧边栏启用方框按钮（方框按钮位于关闭按钮左侧）。
  - 点击关闭按钮时，通过 PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSE_REQUESTED 发出关闭 annotation 侧边栏的全局事件。
  - 首期点击方框按钮仅调用 common toast 工具 showInfo 提示按钮已被点击（开发中），后续再接入 MsgCenter 启动标注管理器事件。
- 在 AnnotationSidebarUI 测试中新增用例：
  - 验证启用 enableManagerButton 选项时会渲染 .pdf-sidebar-square-btn。
  - 验证 Header 关闭按钮点击会通过 eventBus.emitGlobal 发出 SIDEBAR_MANAGER.CLOSE_REQUESTED 事件。
- 相关单测：src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.test.js 全部通过。

## 2025-12-03 AnnotationSidebarUI 管理器按钮位置调整
- 根据实际 UI 反馈，将“标注管理器”方框按钮从 AnnotationSidebarUI 内部 header 移除，改为通过 SidebarManagerFeature 在外层通用 sidebar header 中渲染。
- SidebarConfig 新增可选字段 createHeaderExtraActions，允许特定侧边栏（目前为 annotation）在标题右侧、关闭按钮左侧注入自定义按钮。
- real-sidebars.js 中为 annotationConfig 提供 createHeaderExtraActions：创建类名为 pdf-sidebar-annotation-manager-btn 的方框按钮，点击时调用 common notification.showInfo 提示按钮已被点击（开发中）。
- AnnotationSidebarUI 恢复为只负责内部工具栏和内容区域，不再创建额外 header 或重复关闭按钮，避免出现多个“关闭”控件。
- 新增测试：features/infra-sidebar/__tests__/annotation-sidebar-header-manager-button.test.js，验证 annotation 侧边栏 header 中存在方框按钮、仅有一个 sidebar-close-btn，并且点击方框按钮会触发 showInfo。

## 2025-12-04 标注管理器 / 新卡片规划器 / 定制复习器 窗口需求补充
- Custom Reviewer（定制卡片复习器）：
  - 允许多实例并存，每个窗口拥有独立 client_id（例如 custom-reviewer-<uuid>），以便 MsgCenter 精确路由。
  - 窗口划分为三大区域：
    - a) 卡片队列侧边栏：展示和管理当前复习队列，可按 deck/tag/pdf 等维度分组。
    - b) 卡片主显示区域：负责渲染卡片正反面内容，需预留“复用 Anki 卡片 HTML 片段”的 API（按 card_id 获取可嵌入的 HTML 片段）。
    - c) [回答|编辑|导航] 按钮栏：处理记忆评价提交、跳转到 Anki 编辑界面，以及跳转到对应 PDF 标注或标注网络视图。
- 新卡片规划器（Batch Card Planner）：
  - 面向跨 PDF 的批量制卡，基于“卡片-面-内容节点”的抽象，支持多种布局：树结构（卡片节点→正面/背面→标注/大纲/锚点）、文件浏览器式视图、表格视图等。
  - 必须支持拖放标注/大纲/锚点到规划区，以及通过 Ctrl+V 粘贴文本自动识别 annotation_id / outline_id / anchor_id 并转为节点。
  - 所有布局共享同一数据模型和操作 API，避免出现“某布局可编辑、某布局只读”的割裂现象。
- 标注管理器（Annotation Manager）：
  - 汇总来自 PDF 的标注、Anki 卡片中的标注引用，以及标注之间的关系对象，提供统一的搜索 / 筛选 / 排序入口。
  - 支持多种布局：列表视图（按 PDF/tag/时间/是否关联卡片等维度）、树状视图（PDF→章节→标注）、导图视图（与 3.3 Graph View 集成），并预留更多布局（如按专题/任务的分组视图）。
  - 标注管理器本身只负责标注与关系数据，不直接操作 PDF 渲染或卡片编辑；跳转与复习相关操作通过事件/MsgCenter 委托给 viewer / Custom Reviewer / Anki。

## 2025-12-04 三个前端工具窗口骨架与 gui_launcher 按钮
- 新增三个前端入口目录：src/frontend/anno-manager、src/frontend/new-card-scheduler、src/frontend/custom-reviewer，各自只有极简骨架：
  - anno-manager：左侧过滤/视图侧边栏 + 主列表区域（标注管理器占位），暂仅展示窗口已启动的提示。
  - new-card-scheduler：左侧布局/工具侧边栏 + 中部卡片规划工作区占位，用于后续承载卡片-面-内容节点布局。
  - custom-reviewer：左侧复习队列侧边栏 + 中部卡片主显示区域 + 下方[回答|编辑|导航]按钮栏，当前仅展示占位文本。
- 更新 vite.config.js：在 rollupOptions.input 中新增 anno-manager / new-card-scheduler / custom-reviewer 三个 HTML 入口，支持 dev/build 同时构建三个工具窗口。
- 在 gui_launcher.py 的主窗口中新增三颗 Hosted 按钮：
  - '启动 标注管理器 (Hosted)' → _start_anno_manager_hosted()；
  - '启动 新卡片规划器 (Hosted)' → _start_new_card_scheduler_hosted()；
  - '启动 定制复习器 (Hosted)' → _start_custom_reviewer_hosted()。
- 三个启动方法均复用现有 MsgCenter 通路：从 runtime-ports.json 解析 msgCenter_port，检查端口监听情况后，通过 StandardMessageHandler 发送 type='app-window:open:requested', to='backend' 的消息；
  - anno-manager 与 new-card-scheduler 暂使用固定 client_id（'anno-manager' / 'new-card-scheduler'）；
  - custom-reviewer 每次启动都会生成独立 client_id（custom-reviewer-<uuid前缀>），为后续多窗口定制复习提供前提。
- 当前阶段仅完成前端骨架与 gui_launcher→MsgCenter 的消息发送，后端 BackendLauncher 仍只识别 pdf-home/pdf-viewer 的 window_type；对新 window_type 的 Hosted 窗口加载需要在后续任务中扩展 launcher_core/runner 和静态资源挂载。

## 2025-12-04 BackendLauncher 集成 anno-manager / new-card-scheduler / custom-reviewer Hosted 窗口骨架
- 新增通用 PyQt 简易窗口启动器：src/frontend/common/pyqt/simple_web_window_app.py，提供 SimpleWebWindowApp + SimpleWebWindow，用 LaunchConfig + runtime-ports.json 解析 url_port/msgCenter_port/pdfFile_port，使用 QWebEngineView 加载指定 entry 路径（如 /anno-manager/），子进程模式进入事件循环，Hosted 模式只创建窗口不阻塞。
- 在 src/frontend/anno-manager/launcher.py 中为三个工具窗口定义薄包装：AnnoManagerApp / NewCardSchedulerApp / CustomReviewerApp，全部继承 SimpleWebWindowApp，分别加载 /anno-manager /new-card-scheduler /custom-reviewer 并设置中文标题。
- 在 src/launcher/runner.py 中新增 ensure_anno_manager_hosted / ensure_new_card_scheduler_hosted / ensure_custom_reviewer_hosted：
  - 统一通过 resolve_component_root + importlib 加载 anno-manager/launcher.py；
  - 使用 LaunchConfig 构造前端启动参数（url_port/msgCenter_port/pdfFile_port/logs_dir 等），并创建对应 App 实例；
  - Hosted 模式下调用 app.run() 并将窗口注册到 WindowLifecycleManager（client_id 为 anno-manager、新卡片规划器为 new-card-scheduler，CustomReviewer 使用调用方传入的 client_id）。
- 在 src/backend/launcher_core/pyqt_launcher.py 中：
  - 扩展 app-window:open:requested 的分支，新增 window_type=anno-manager/new-card-scheduler/custom-reviewer，对应调用上述 ensure_*_hosted，并在日志中打印 Hosted 启动结果。
  - 将 EmbedFileServer.mounts 扩展为在 dist/static 下存在相应子目录时挂载：/anno-manager、/new-card-scheduler、/custom-reviewer → static/<name>，以便生产模式下通过 HTTP 静态资源访问这三个入口。
- 由于 Jest 当前配置未包含 src/gui_launcher 路径，本轮仅尝试运行现有测试并记录‘No tests found’结果，暂未为新 Hosted 分支添加 Python 端集成测试；后续可以在 src/gui_launcher/__tests__ 或 src/launcher/__tests__ 中补充针对 ensure_*_hosted 与 window_type 分支的契约测试。
