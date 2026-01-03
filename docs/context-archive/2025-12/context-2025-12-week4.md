# Context 归档 - 2025年12月第4周（12-22 ~ 12-28）

**归档日期**：2025-12-31
**来源**：从 context.md 迁移的历史记录

---

### 2025-12-23
- 原标题：2025-12-23 标注管理器开发进度小结

- 后端数据层：`PDFAnnotationTablePlugin` 已扩展 `title/is_key/importance` 元字段并接入默认标题生成与校验逻辑，`PDFAnnotationTagsTablePlugin` 与 `PDFAnnotationRelationTablePlugin` 已提供标签与关系的 CRUD 能力及防回归测试，为后续“标注网络化管理”提供基础数据模型。
- Hosted 启动链路：GUI Launcher 与 pdf-viewer 标注侧边栏 Header 方框按钮均可通过 `app-window:open:requested` 打开 `window_type="anno-manager"` 的 Hosted 窗口，BackendLauncher 使用 `ensure_anno_manager_hosted` + `WindowLifecycleManager` 管理 `client_id=\"anno-manager\"` 的生命周期。
- 前端 anno-manager 窗口：已实现基础骨架与布局（标题 + 窗口控制栏 + 搜索/筛选/排序/导入工具栏、左侧过滤/视图侧边栏、右侧结果区域）；当前以“独立打开”为基准：默认不加载标注，点击“从 PDF 导入/刷新”会弹窗选择 PDF 并请求 `annotation:list:requested`；跨 PDF 聚合查询与关系导图仍处于设计阶段。
- 窗口控制栏与关闭行为：anno-manager 现已复用统一的 `SimpleWebWindowApp + SimpleWindowBridge + WindowControlsComponent`，关闭按钮在前端会同时通过 WebSocket 发送 `app-window:close:requested` 并调用 QWebChannel 的 `requestCloseWindow`，修复了早期 Hosted 场景下“点击关闭无反应”的问题。
- 尚未完成的能力：标注管理器尚未接入“按标签/是否有关联卡片/时间范围”等高级筛选条件，也未真正落地“跨 PDF 聚合视图”“标注关系导图”和与新卡片规划器/定制复习器之间的双向跳转，目前主要完成的是单个 PDF 视角下的标注列表与基础窗口行为。
- 首开标注缺失修复：修复“GUI Launcher 打开 pdf-viewer 后首次标注侧边栏为 0 条且高亮/覆盖层不显示，需要 F5 刷新才出现”的问题；关键点为 `WSClient.request()` 在未连接排队时不应提前开始 timeout（否则会出现 request 超时但消息仍在队列、响应到达却无人结算），以及 `AnnotationManager` 加载标注时不应在 WS 未就绪时静默返回空数组导致 UI 误判“已加载完成(0条)”并阻止自动重试。
- 高亮跳转居中修复：后端 `pdf_annotation.validate` 持久化 `lineRects`（百分比矩形数组）用于跳转位置计算；前端对缺失 `lineRects` 的历史数据提供 DOM 兜底二次居中，并在 2025-12-24 修复了两点：① DOM 兜底算法（必须基于 `.text-highlight` 子块矩形求包围盒中心，不能用覆盖整页的 `.text-highlight-container` 自身 rect）；② 消除双滚动（text-highlight DOM 居中场景调用 `NavigationService.navigateTo({ scroll:false })`，避免先默认滚到 50%）。

### 2025-12-23
- 原标题：2025-12-23 pdf-viewer 模块理解小结

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

### 2025-12-24
- 原标题：2025-12-24 anno-manager 独立打开行为调整

- 不再使用 URL query 传递 `pdf-id`：`SimpleWebWindowApp` 仅透传 `client-id`；业务上下文应统一走 MsgCenter（本轮未实现跨模块 init/gate）。
- “从 PDF 导入/刷新”按钮行为：点击后请求 `pdf-library:list:requested` 获取列表，弹窗选择 PDF 后发送 `annotation:list:requested`（data: `{ pdf_uuid: <selected> }`）；默认不加载标注。
- 本轮未做：从 pdf-viewer 点 “□” 打开 anno-manager 后的自动导入/跳转门控。

### 2025-12-24
- 原标题：2025-12-24 anno-manager 单例约束（MsgCenter/Launcher）

- anno-manager 必须为唯一窗口：重复收到 `app-window:open:requested`（window_type=anno-manager）时，只激活已有窗口，不再创建新实例。
- 严格约束：window_type=anno-manager 时 client_id 必须为固定的 `"anno-manager"`；任何自定义 client_id 视为错误并拒绝处理（Fail-Fast）。
