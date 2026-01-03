# Context 归档 - 2025年12月第1周（12-01 ~ 12-07）

**归档日期**：2025-12-31
**来源**：从 context.md 迁移的历史记录

---

### 2025-12-01
- 原标题：2025-12-01：前端结构图分析任务记录

- 已基于 src/frontend 目录结构与 ARCHITECTURE-EXPLAINED.md 生成《前端结构图与架构说明》（AItemp/reports/frontend-architecture-20251201120842.md），总结 common/pdf-home/pdf-viewer 的分层与模块关系，供后续重构和答复用户使用。

### 2025-12-01
- 原标题：2025-12-01：后端架构 Mermaid 图记录

- 已在 AItemp/reports/backend-architecture-20251201131315.md 中补充后端整体结构 Mermaid 图（launcher/launcher_core/msgCenter_server/pdfFile_server/api/database/pdf_manager/logging/linters 关系），可与前端结构图报告配套使用。

### 2025-12-01
- 原标题：2025-12-01：维护清理指南文档

- 已新增 docs/MAINTENANCE-CLEANUP-GUIDE.md，用于规范“过时代码清理”和“过时文档清理”的流程（识别依据、小步清理步骤、归档与 Memory Bank 记录方式、自检清单），后续涉及重构/归档时应优先参考该文档。

### 2025-12-01
- 原标题：2025-12-01：清理过时文档目录 docs/TODO

- 初步检查 docs 下文档后，确认 docs/TODO 目录为空且在仓库中无任何引用，同时实际任务管理流程已统一使用根目录 todo-and-doing/，故将 docs/TODO 视为过时目录并直接删除；后续如需查看任务规划，请以 todo-and-doing 为准。

### 2025-12-01
- 原标题：2025-12-01：文档与代码实现对齐（首轮）

- 使用 AItemp/attempts/doc_scan_paths.py 扫描 docs/**.md 中的 src/tests 路径，对比当前代码，标记出若干仅存在于旧版 pdf-home v1 或早期集成方案中的路径；对相关索引与规范文档（如 docs/index/frontend/modules/*、WEBSOCKET-INTEGRATION、部分 SPEC/TESTING 文档）增加“历史/规划性说明”，以免读者误以为这些路径仍然存在或已经落地实现。

### 2025-12-02
- 原标题：2025-12-02：pdf-resume DOM 事件层现状梳理

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

### 2025-12-02
- 原标题：2025-12-02：自动文档生成方案设计

- 新增 docs/engineering/AUTO-DOC-GENERATION.md，说明如何基于现有 JSDoc（前端）和 Python docstring（后端）使用 jsdoc/pdoc 生成 HTML 文档，当前仅提供配置与命令建议，不直接修改 package.json 或 requirements.txt，由维护者按需落地。

- 后端自动文档：可使用 tools/generate_backend_docs.py 调用 pdoc，为 standard_server/embed_fileserver/launcher 生成 HTML 文档（输出到 AItemp/docs/backend-api）；需要先在虚拟环境中安装 python -m pip install pdoc。

### 2025-12-03
- 原标题：2025-12-03：pdf-anchor 取消激活、位置更新与导航闸门重构

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

### 2025-12-03
- 原标题：2025-12-03 AnnotationSidebarUI 管理器按钮接入

- 为 pdf-viewer 新增通用侧边栏 Header 工具 shared/sidebar-shell-header.js，统一提供‘标题 + 可选方框按钮 + 关闭按钮’布局（默认方框按钮隐藏）。
- 在 AnnotationSidebarUI 中集成该 Header：
  - 标注侧边栏启用方框按钮（方框按钮位于关闭按钮左侧）。
  - 点击关闭按钮时，通过 PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSE_REQUESTED 发出关闭 annotation 侧边栏的全局事件。
  - 首期点击方框按钮仅调用 common toast 工具 showInfo 提示按钮已被点击（开发中），后续再接入 MsgCenter 启动标注管理器事件。
- 在 AnnotationSidebarUI 测试中新增用例：
  - 验证启用 enableManagerButton 选项时会渲染 .pdf-sidebar-square-btn。
  - 验证 Header 关闭按钮点击会通过 eventBus.emitGlobal 发出 SIDEBAR_MANAGER.CLOSE_REQUESTED 事件。
- 相关单测：src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.test.js 全部通过。

### 2025-12-03
- 原标题：2025-12-03 AnnotationSidebarUI 管理器按钮位置调整

- 根据实际 UI 反馈，将“标注管理器”方框按钮从 AnnotationSidebarUI 内部 header 移除，改为通过 SidebarManagerFeature 在外层通用 sidebar header 中渲染。
- SidebarConfig 新增可选字段 createHeaderExtraActions，允许特定侧边栏（目前为 annotation）在标题右侧、关闭按钮左侧注入自定义按钮。
- real-sidebars.js 中为 annotationConfig 提供 createHeaderExtraActions：创建类名为 pdf-sidebar-annotation-manager-btn 的方框按钮，点击时调用 common notification.showInfo 提示按钮已被点击（开发中）。
- AnnotationSidebarUI 恢复为只负责内部工具栏和内容区域，不再创建额外 header 或重复关闭按钮，避免出现多个“关闭”控件。
- 新增测试：features/infra-sidebar/__tests__/annotation-sidebar-header-manager-button.test.js，验证 annotation 侧边栏 header 中存在方框按钮、仅有一个 sidebar-close-btn，并且点击方框按钮会触发 showInfo。

### 2025-12-04
- 原标题：2025-12-04 标注管理器 / 新卡片规划器 / 定制复习器 窗口需求补充

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

### 2025-12-04
- 原标题：2025-12-04 三个前端工具窗口骨架与 gui_launcher 按钮

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

### 2025-12-04
- 原标题：2025-12-04 BackendLauncher 集成 anno-manager / new-card-scheduler / custom-reviewer Hosted 窗口骨架

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
