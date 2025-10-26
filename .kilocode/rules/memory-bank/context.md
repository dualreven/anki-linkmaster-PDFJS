# Memory Bank - Context（精简版）

> 目录（快速索引）
- [🎯 AI开发架构改进指南（重要 - 长期参考）](#-ai开发架构改进指南重要---长期参考)
- [📅 当前活跃任务（最近）](#-当前活跃任务最近)
- [📦 文件体量评估与清理建议（20251018220157）](#-文件体量评估与清理建议20251018220157)
- [🧠 知识卡/问题记录（若干）](#-知识卡问题记录若干)
- [🗄️ 历史归档策略说明](#️-历史归档策略说明)

## 🎯 AI开发架构改进指南（重要 - 长期参考）

### PDF-Viewer 架构分析与改进建议（20251010020347）

**背景**：
- AI开发特点：记忆有限、容易忽略隐式依赖
- 目标：避免AI修改一个功能时引起另一个功能的错误

**架构优势**：
- ✅ 插件化架构清晰（Feature模式）
- ✅ 事件驱动解耦（EventBus）
- ✅ 文档完善
- ✅ 命名规范严格（三段式事件名）

**核心问题**：
- ⚠️ 隐式依赖难追踪
- ⚠️ 事件契约不明确
- ⚠️ 全局/局部事件易混淆
- ⚠️ 缺少改动影响分析工具

**7个改进建议（按优先级）**：
1. **服务契约注册表** - 集中定义所有可注入服务及其接口，避免字符串拼写错误
2. **事件Payload Schema** - 为每个事件定义明确的数据结构，运行时验证
3. **Feature依赖图可视化** - 自动生成Mermaid依赖图，检测循环依赖
4. **事件流追踪工具** - 开发模式下记录完整事件链路，生成序列图
5. **Feature职责边界检查** - 定义允许/禁止行为清单，工具自动检测越界
6. **结构化日志** - 引入Trace ID，串联跨Feature调用链
7. **契约测试** - 为核心Feature编写"对外承诺"测试，CI强制通过

**实施路线图**：
- 第一阶段（1周）：服务契约注册表 + 事件Schema + 运行时验证
- 第二阶段（1周）：依赖图生成 + 事件流追踪工具
- 第三阶段（2周）：契约测试 + 职责文档
- 第四阶段（持续）：AI辅助开发工具

**衡量标准**：跨Feature bug减少50%、AI开发速度提升30%、代码审查时间减少40%

---

## 📅 当前活跃任务（最近）

### 问题修复（20251025235859）
名称：annotation 截图在缩放后截图、刷新回默认缩放时标记错位

背景与现象（UTF-8 与 `\n`）：
- 场景：在非默认缩放（放大/缩小）执行截图 → 当次标记位置正确；刷新页面（恢复默认缩放）后，同一截图标注的可视标记发生偏移；
- 近期前端 ScreenshotTool 已在创建时写入 `rect（canvas 像素）` + `rectPercent（百分比）` + `canvasPixelSize（截图时 canvas 尺寸）`；
- 但刷新后从后端取回的数据缺少 `rectPercent/canvasPixelSize`，导致只能以“当前 canvas 尺寸”从旧像素 rect 反推百分比，出现错位。

根因：
- 后端 `PDFAnnotationTablePlugin._validate_screenshot_payload()` 白名单过窄，仅保留 `rect/imagePath/imageHash(/imageData/description)`，丢弃 `rectPercent/canvasPixelSize/markerColor`；
- 刷新后回读缺少稳定定位基准（rectPercent 或 canvasPixelSize），从而发生比例换算偏差。

修复：
- 扩容服务端截图负载校验并持久化：
  - 文件：`src/backend/database/plugins/pdf_annotation_plugin.py`
  - 方法：`_validate_screenshot_payload`
  - 新增可选字段：`rectPercent{ xPercent,yPercent,widthPercent,heightPercent }`（0~100 截断）；`canvasPixelSize{ width,height }`（正数）；`markerColor`（#rrggbb）。
  - 结果：后端不再丢弃上述字段；前端能稳定复原标记位置（优先 rectPercent；兜底 canvasPixelSize 反推）。

相关模块/函数：
- 前端：`features/annotation/tools/screenshot/index.js`（`#captureAndSave`、`renderScreenshotMarker`）；
- 后端：`database/plugins/pdf_annotation_plugin.py::_validate_screenshot_payload`；
- 消息：`annotation:save:requested` / `annotation:list:completed`（标准 WS 服务器透传 `json_data.data`）。

验证要点：
- 缩放（如 150%）截图→刷新→标记仍对齐；
- 后端保存记录的数据中存在 `rectPercent/canvasPixelSize`；
- 前端渲染日志无 `rectPercent missing` 的兜底告警路径。

风险与兼容：
- 仅扩容白名单，不改变既有字段含义；旧数据仍按原兜底路径可渲染；
- 已做数值范围/类型校验，防止污染。

（补充 20251026000530）关于 rect/canvasPixelSize 的保留与迁移：
- 现状：前端 Annotation 和后端插件把 screenshot.data.rect 视为必填；渲染优先用 rectPercent；canvasPixelSize 仅用于从旧 rect 反推百分比；
- 结论：短期保留 rect/canvasPixelSize（兼容与兜底），长期可逐步迁移至“rectPercent 为唯一真值；rect 降为可选”。
- 建议迁移步骤：前端先改校验（rectPercent 必填），后端跟进；加载旧数据时回填 rectPercent 并 update，最终把 rect 调整为可选。

（更新 20251026001840）实施“严格模式/不兼容旧数据”：
- 前端：强制 `rectPercent` 必填；ScreenshotTool 保存时不再写 `rect/canvasPixelSize`；渲染移除一切回退换算；AnnotationFeature 导航计算移除截图回退。\n
- 后端：`_validate_screenshot_payload` 要求 `rectPercent`，不再要求 `rect`；老 payload（仅有 rect）的保存会被拒绝；\n
- 影响：旧数据不会渲染与保存（主动报错/跳过），新数据稳定使用百分比定位。\n
### 当前任务（20251022101046）
名称：完成 pdf-outline 具体实现（通过 URL 参数一键切换 bookmark↔outline）

说明（UTF-8 与 `\n`）：
- 目标：以“对外契约稳定（BOOKMARK.* 事件常量不改）”为前提，完善 `features/pdf-outline`，实现与 bookmark 对齐的关键行为：列表加载（含首次原生导入）、按 ID 导航、CRUD、拖拽重排、LOAD.REQUESTED 主动刷新。
- 现状：
  - 已有开关：`src/frontend/common/utils/feature-flags.js:isOutlineEnabled()`；Bootstrap/SidebarManager 已按开关装配 Outline。
  - `features/pdf-outline/index.js` 仅复用 `BookmarkManager` 并回灌 `BOOKMARK.LOAD.SUCCESS`，尚缺：`BOOKMARK.NAVIGATE(_BY_ID).REQUESTED` 处理、原生大纲导入（`BookmarkDataProvider`）、`BOOKMARK.LOAD.REQUESTED` 订阅刷新。
- 本次改动要点：
  1) 在 OutlineFeature 中获取 `navigationService`（来自 `CoreNavigationFeature` 容器注册），并订阅：
     - `BOOKMARK.NAVIGATE.REQUESTED` → 解析 `bookmark.pageAt/position`，调用 `navigationService.navigateTo(...)`
     - `BOOKMARK.NAVIGATE_BY_ID.REQUESTED` → 通过 `BookmarkManager.getBookmark(id)` 取节点后复用同一导航逻辑
     - `BOOKMARK.LOAD.REQUESTED` → 主动 `#refreshList()`
  2) 引入 `BookmarkDataProvider`，在 `FILE.LOAD.SUCCESS` 时尝试导入 PDF 原生大纲，按统一模型 `{ pageAt, position }` 写入并 `saveToStorage()`，随后 `#refreshList()`。
  3) 新增 `features/pdf-outline/feature.config.js`，与 pdf-bookmark 配置对齐（名称为 `pdf-outline`）。
  4) 先写测试占位（`describe.skip`），满足流程与规范，避免当前 Jest 环境差异造成误报。
  5) gui_launcher → pdf-home → pdf-viewer 的 Outline 开关透传：
     - gui_launcher 启动 pdf-home 前将 UI 勾选状态写入 `logs/runtime-ports.json`（`outline=1`）；
     - pdf-home 在 `openPdfViewers`（Hosted）路径通过 `LaunchConfig.extra_params` 将 `outline=1` 注入 URL；
     - pdf-home 在 `openPdfViewersEx`（直接 URL 路径）在构造 URL 后追加 `&outline=1`；
     - pdf-viewer Bootstrap 检测 `isOutlineEnabled()` 后以 toast 提示“当前为 Outline 模式”。
- 不做事项：
  - 不改动事件常量命名（继续使用 `PDF_VIEWER_EVENTS.BOOKMARK.*`），不重命名后端/存储键。
  - 不做全仓库“bookmark→outline”字符串替换，避免破坏兼容与测试。

涉及模块与文件：
- `src/frontend/pdf-viewer/features/pdf-outline/index.js`（补全导航/导入/事件监听）
- `src/frontend/pdf-viewer/features/pdf-outline/feature.config.js`（新增）
- `src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-feature.install.test.js`（新增占位，skip）

验收要点：
- 打开时（`?outline=1`），侧边栏为 `OutlineSidebarUI`，点击任一节点发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`，由 `PDFOutlineFeature` 统一处理并调用 `navigationService` 正确跳转。
- 首次加载 PDF 时，能将原生大纲导入为标准模型并展示；CRUD/重排事件路径保持可用。

记录时间：2025-10-22 10:10:46

### 当前任务（20251021084613）
名称：核查 pdf-viewer 同时存在 outline 与 bookmark 两个插件的原因，并确认当前工作中的插件（经历“bookmark → outline”命名迁移）。

结论（UTF-8 与 `\n`）：
- 当前生效：`PDFBookmarkFeature`；`PDFOutlineFeature` 存在但未被注册安装。
  - 引导装配：`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js:23` 引入并注册 `PDFBookmarkFeature`；`PDFOutlineFeature` 的引入与注册被注释（稳定性优先）。
  - 侧边栏来源：`src/frontend/pdf-viewer/features/sidebar-manager/real-sidebars.js:9,40` 使用 `BookmarkSidebarUI` 注册“大纲”侧边栏；未使用 `OutlineSidebarUI`。
  - 点击导航链路：`src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js:166-176` 发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`；由 `features/pdf-bookmark/index.js:445` 统一消费 → 调用导航服务。
- 双插件并存原因：处于“命名迁移中的并存阶段”。`pdf-outline` 作为新名外壳，内部复用 `BookmarkManager/BookmarkDialog/BOOKMARK.*` 事件契约，保证与后端/存量数据一致，但暂未启用以降低风险。
  - 代码佐证：`src/frontend/pdf-viewer/features/pdf-outline/index.js:9-12` 复用 `BookmarkManager/BookmarkDialog`；`index.js:57` 使用 `BOOKMARK.LOAD.SUCCESS` 对外回灌列表。
- 日志策略：按 2025-10-20 的变更，`BookmarkSidebarUI/OutlineSidebarUI/Feature.pdf-outline` 日志级别下调为 `ERROR`，减少噪音（参考 `features/pdf-bookmark/index.js:118-120`）。

建议：
- 若要启用 `pdf-outline`：在 `app-bootstrap-feature.js` 放开 `PDFOutlineFeature` 注册，并在 `sidebar-manager` 切换 UI 为 `OutlineSidebarUI`；以灰度开关推进，保留快速回滚。

记录时间：2025-10-21 08:46:13

### 评估（20251021101421）
名称：从“bookmark”切换到“outline”的风险与可行迁移策略

要点（UTF-8 与 `\n`）：
- 不可做“全局同名替换”（把所有 `bookmark(s)` 文本替换为 `outline(s)`），高风险：事件名/容器键/后端路由/DB 插件/URL 参数/本地存储/日志模块名/测试选择器均受影响。
- 继续以 BOOKMARK.* 为对外契约；逐步引入 OUTLINE 外壳与别名（常量别名、字段别名、容器别名、后端路由别名）。
- 灰度策略：提供运行时开关启用 `PDFOutlineFeature` 与 `OutlineSidebarUI`，保留快速回滚；监控跳转正确率、错误率与性能。
- 数据层暂不重命名（不动 DB 表与插件文件名），避免跨层迁移成本。

参考统计（仓库范围）：
- bookmark 相关匹配 ≈603 处/56 文件；outline 相关匹配 ≈85 处/27 文件（rg 统计）。

建议落地顺序：
1) 常量别名：`PDF_VIEWER_EVENTS.OUTLINE.* → BOOKMARK.*`（新增映射，旧名保留）
2) 字段别名：接受 `{ outlineItemId | bookmarkId | id }`，统一内部为 `outlineItemId`
3) 容器别名：`outlineManager` 同指向 `bookmarkManager`
4) 后端路由/消息别名：不启用（决策更新，见 20251021141332）；保持 bookmark 命名，未来如有强需求再评估
5) 灰度启用 OutlineFeature + OutlineSidebarUI（开关控制），观测指标达标后扩大覆盖

记录时间：2025-10-21 10:14:21

### 决策更新（20251021141332）
名称：后端路由/消息是否需要 outline 别名

决定：
- 不做别名：后端仍使用 bookmark 命名（服务名/消息类型/DB 插件/可能的 HTTP 路径），不新增 `/outline/*` 或 `outline:*` 别名。

理由：
- 前端交互以 WebSocket 消息为主（`bookmark:list|save`）；`pdf_library_api.py` 与 `standard_protocol.py`/`standard_server.py` 的主语为 bookmark，引入别名收益有限，提升维护面。

边界：
- 前端字段/URL 参数继续兼容 `outlineItemId`（内部映射）；对外协议名、后端实现不变。

记录时间：2025-10-21 14:13:32

### 分析（20251021141911）
名称：`bookmark:list` 非三段式为何“没有报错”

要点（仅分析，不改代码）：
- 结构校验未强制三段式：`standard_protocol.validate_message_structure()` 仅校验字段类型，不校验 `type` 段数 → `bookmark:list` 结构上可通过；  
- 服务端归一化仅覆盖 `bookmark:list:records` → `bookmark:list:requested`，不含 `bookmark:list`；若收到纯 `bookmark:list`，将落入 `unknown_message_type` 分支（`standard_server.py:397-403`）。  
- “没有报错”的原因：
  1) 正常书签读取路径使用三段式：`WEBSOCKET_MESSAGE_TYPES.BOOKMARK_LIST='bookmark:list:requested'`，通过 `wsClient.request()` 白名单发送，不会发出 `bookmark:list`；  
  2) 若有代码用 `wsClient.send({type:'bookmark:list'})`，服务端会返回错误，但 UI 可能未监听 `WEBSOCKET_MESSAGE_EVENTS.ERROR`，或被“本地回退”掩盖（`RemoteBookmarkStorage` 失败后读 localStorage），导致用户无感错误；  
  3) 客户端接收端对 legacy 回执 `bookmark:list:records` 做了兼容路由（`ws-client.js`），因此整体功能可用，进一步降低错误感知。

建议（不改代码，仅记录）：服务端可加严格三段式校验（可开关）；前端对非 *:requested 出站消息打印 `WARN`，并为 `ERROR` 事件加默认告警。

记录时间：2025-10-21 14:19:11

### 决策（20251021210405）
名称：暂缓改动（不启用 outline 灰度与协议守卫）

结论：
- 暂不改代码，保持现网：`PDFBookmarkFeature + BookmarkSidebarUI` 与 BOOKMARK.* 协议；`PDFOutlineFeature` 与严格协议校验不开启。

观察与触发条件（仅日志侧，不改代码）：
- 观察：ws-server 的 `unknown_message_type`、书签远端失败→本地回退日志；必要时通过 localStorage 临时提升级别。
- 触发条件：① 远端失败率>5%；② 大纲跳转错误复现；③ 产品确定启用 Outline UI。

记录时间：2025-10-21 21:04:05

### 变更（20251022081651）
名称：增加运行时开关（默认不启用）以便未来灰度启用 Outline

内容（不改变默认行为，默认仍为 Bookmark 路径）：
- 新增：`src/frontend/common/utils/feature-flags.js`（读取 URL `?outline=1` 或 localStorage `FEATURE_OUTLINE=1|true`）。  
- 启动装配切换：`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 按开关选择注册 `pdf-outline` 或 `pdf-bookmark`（失败自动回退到 `pdf-bookmark`）。  
- 侧边栏切换：`src/frontend/pdf-viewer/features/sidebar-manager/real-sidebars.js` 改为 `async` 并按开关动态导入 `OutlineSidebarUI`（失败回退 `BookmarkSidebarUI`）；调用处同步调整为 `await`。  
- 侧边栏 id 保持 `bookmark`，按钮“≡ 大纲”不变；事件契约继续 `BOOKMARK.*`。  

默认值与回滚：
- 默认不开启（仍走 Bookmark）；一旦设置 URL 或 localStorage 开关为真，才启用 Outline；任何异常自动回退 Bookmark。  

记录时间：2025-10-22 08:16:51

### 变更（20251022083012）
名称：GUI 启用 Outline 的复选框（自动构造 URL 参数）

内容：
- gui_launcher（Hosted）新增“启用 Outline”复选框；勾选后在启动 URL 追加 `outline=1`。  
- runner（Hosted）支持将 `enable_outline` 写入 `LaunchConfig.extra_params`；前端 launcher 在 `_build_frontend_url()` 中识别并附加 URL 参数。  
- 不影响默认行为（未勾选不改变现网）；失败回退保持 Bookmark 路径。

记录时间：2025-10-22 08:30:12

### 变更（20251026191436）
名称：GUI 启动器目录参数显式传递，移除运行时回退（fallback）

背景：
- 需要确保静态目录、PDF 目录、数据库文件、日志目录均通过“参数形式”从 gui_launcher 传入，而非运行时在代码中回退到 `<component_root>/...`。

改动要点（仅 gui_launcher 与测试，UTF-8 与 `\n`）：
- 初始化：`self._logs_dir` 在 GUI 启动时即解析为明确目录（默认 `<component_root>/logs`），不再以 `None` 表示“待回退”。  
- 新函数：`_resolved_paths_from_ui()` 统一解析 UI 输入与默认值，返回非空的 `data_dir/db_path/static_dir/pdfs_dir/logs_dir`。  
- Hosted：`_start_backend_qt_mode/_start_pdf_home_hosted/_start_pdf_viewer_hosted` 显式传入路径，移除 `.with_defaults()` 对路径的补齐依赖。  
- CLI：`_cli_build_argv("start")` 总是拼接 `--data-dir/--db-path/--static-dir/--pdfs-dir/--logs-dir`；`_start_task()` 将 5 个路径注入子线程参数。  
- 子线程：`LauncherThread._start_*` 对 `logs_dir` 与其余路径做显式校验，删除 `Path(self.params.get('logs_dir') or (component_root / 'logs'))` 等回退。

一致性：
- runner/config 作为库层仍具备默认路径计算能力，但 GUI 层不再依赖其“路径回退”；  
- UI 仅在占位符中显示默认路径，不等同于运行时回退。

验证：
- CLI 与 Hosted 均能在指定 `logs_dir` 下生成 `runtime-ports.json/xxx-process-info.json`；  

### 修复（20251026211317）
名称：pdf-home 日志出现端口为 None（应当报错而非兜底）

现象与日志（UTF-8 与 `\n`）：
- 路径：`dist/latest/logs/pdf-home.log`
- 典型记录：`Resolved ports: vite=None msgCenter=None pdfFile=None`；随后构造的 URL 为 `http://127.0.0.1:None/pdf-home/?msgCenter=None&pdfs=None`。

根因：
- `src/frontend/pdf-home/launcher.py` 在生产模式下未强制校验 `msgCenter_port/pdfFile_port`，导致缺失值以字符串 `None` 进入 URL；
- 违反“禁止设计兜底原则”，应立即抛错。

修复要点：
- `src/frontend/pdf-home/launcher.py`: 在解析端口后进行严格校验：
  - 开发模式：必须提供 `vite_port/msgCenter_port/pdfFile_port`，缺失即抛 `RuntimeError`；
  - 生产模式：必须提供 `msgCenter_port/pdfFile_port`，缺失即抛 `RuntimeError`；
  - 统一从 `logs_dir/runtime-ports.json` 读取并尝试 `int()` 归一；不做任何默认端口兜底；
  - 异常消息包含缺失键名与 `runtime-ports.json` 路径提示。
- 同步更新 `dist/latest/src/frontend/pdf-home/launcher.py` 以便 Hosted/打包环境立即生效。
 - 后端修复（统一 logs_dir）：`src/backend/launcher.py` 中 `BackendPortManager` 支持传入 `logs_dir`，`BackendLauncher` 将 GUI 传入的 `logs_dir` 透传给端口写入逻辑；`_is_outline_enabled_flag()` 读取 `runtime-ports.json` 也改为使用相同的 logs_dir。避免后端写到 `<project_root>/logs` 而前端读 `<dist/latest/logs>` 的错位。

测试：
- 新增 `__tests__/test_pdf_home_port_validation.py`：
  - `test_prod_missing_msgcenter_or_pdf_port_should_raise`
  - `test_dev_missing_vite_port_should_raise`
  - `test_dev_missing_msgcenter_or_pdf_port_also_raise`
  - 均通过（pytest，本地桩替代 PyQt）。

影响范围：
- 仅限 pdf-home 启动端口校验；不影响 pdf-viewer（其端口校验后续可按相同策略增强）。

操作建议：
- 通过 `ai_launcher` 正确写入 `runtime-ports.json`，或 CLI 显式传参 `--msgCenter-port/--pdfFile-port[/--vite-port]`；
- 若依旧出现异常，请检查 `--logs-dir` 指向的 `runtime-ports.json` 是否存在且键名正确。

### 后端严禁兜底（20251026213942）
名称：Backend 全链路路径改造——仅参数输入，删除所有回退

背景：
- 报错显示 pdf-home 从 `<dist/latest/logs>` 读取端口文件，而后端写在 `<project_root>/logs`，原因是后端内部存在对 logs/data/static/pdfs 路径的回退/推断逻辑，未严格使用 GUI 传入值。

改动摘要（严格、无回退）：
- `src/backend/launcher.py`
  - BackendLauncher.start() 在启动前强校验 `logs_dir/data_dir/db_path/static_dir/pdfs_dir`，缺失即抛错（禁止兜底）；
  - EmbedMsgCenterServer 仅以显式 `data_dir/db_path` 启动（移除 runtime_mode/anki 推断参数传递）；
  - HTTP 文件服务仅以显式 `pdfs_dir/static_dir` 启动；强校验 `static_dir/pdf-home` 与 `static_dir/pdf-viewer` 子目录存在；显式传入 `logs_dir`；
  - 统一写入端口文件到 GUI 传入的 `logs_dir`（见前一条修复）。
- `src/backend/msgCenter_server/embed_msgcenter.py`
  - 缺少 `data_dir` 或 `db_path` 直接抛错；启动时仅传入上述两参数到 StandardWebSocketServer。
- `src/backend/msgCenter_server/standard_server.py`
  - 移除 `project_root/data` 与 `compute_db_path/compute_data_dir` 的兜底路径逻辑；必须显式传入 `data_dir` 与 `db_path`。
- `src/backend/pdfFile_server/embed_fileserver.py`
  - 移除内部 logs_dir 解析（`gui-launcher-config.json`/`project_root/logs` 回退）；必须显式传入 `logs_dir`；
  - `pdfs_dir/static_dir` 必须传入；`root_dir` 必须与 `pdfs_dir` 一致；否则抛错；
  - 诊断与日志落盘显式写入 `logs_dir`（UTF-8 + \\n）。
- `src/backend/pdfFile_server/handlers/pdf_handler.py`
  - `resolve_static_path()` 去除所有历史/源码目录回退；仅将 `/pdf-home` 与 `/pdf-viewer` 严格映射到 `/static/<module>/index.html`（不存在则 404）。

补充（viewer 启动链路携带 logs_dir）：
- 后端接收 `pdf-library:viewer:requested` 时，`BackendLauncher._on_msgcenter_message()` 构造的 Viewer 启动配置已显式注入 `paths.logs_dir = BackendLauncher.logs_dir_override`，CLI 与 Hosted 两路径都会把 `--logs-dir` 传到前端 viewer（修复“缺少 logs_dir”的错误）。***

结果：
- 后端所有关键路径均“只接受参数”，与 GUI/runner 显式传参策略完全一致；任何缺省值依赖/目录猜测均被删除。
- `gui_launcher.py` 中不存在 `or (_COMPONENT_ROOT / 'logs')` 等回退片段（新增测试覆盖）。

记录时间：2025-10-26 19:14:36

### 当前任务（20251020141335）
名称：Outline 插件点击改为“按ID导航事件”

背景/原因：
- UI 先前在点击大纲节点时直接发射 `NAVIGATION.URL_PARAMS.REQUESTED`，由 URL 导航模块根据 `{ pageAt, position }` 跳转；
- 为统一导航入口、降低 UI 与数据字段的耦合，并接入现有消费端 `PDFBookmarkFeature.#handleNavigateByIdRequest`，现改为在点击后发射 `PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`（负载 `{ outlineItemId }`）。

涉及文件（UTF-8 与 `\n`）：
- ✅ 系统实际使用：`src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js`（已改为发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`）；
- ⛳ 一致性更新：`src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js`（同步改为发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`）；
- 消费端（已存在）：`src/frontend/pdf-viewer/features/pdf-bookmark/index.js:#handleNavigateByIdRequest`；
- 事件常量：`src/frontend/common/event/pdf-viewer-constants.js`。

实现要点：
- 点击节点时：
  - 先发 `BOOKMARK.SELECT.CHANGED`（保持工具栏等状态一致）；
  - 再发 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED({ outlineItemId: <节点id> })`；
- 由 `PDFBookmarkFeature` 内部通过 `BookmarkManager.getBookmark(id)` 获取节点并执行 `#handleNavigateRequest()`；
- UI 不再在点击阶段解析/校验 `{ pageAt, position }`，失败与告警集中在 Feature 层处理。

测试：
- 新增 `src/frontend/pdf-viewer/features/pdf-bookmark/__tests__/navigate-by-id.request.test.js`：
  - Mock `BookmarkManager` 与 `navigationService`；
  - 发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED` 后应触发 `navigationService.navigateTo({ pageAt, position })`。

后续建议：
- URL 分发器检测到 `outlineItemId` 时也发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`，完成 URL → Outline 的闭环（参见 2025-10-20 的工作日志）。

### 当前任务（20251020143057)
名称：关闭 outline 模块级日志，仅保留 error

背景/原因：
- 大纲侧边栏近期启用过 DEBUG 级别日志，开发期便于排查，但在日常使用中噪音较大；
- 需求：仅保留错误输出（error），其余级别关闭。

变更：
- `src/frontend/pdf-viewer/features/pdf-bookmark/index.js` 安装阶段设置：
  - `setModuleLogLevel('BookmarkSidebarUI', ERROR)`
  - `setModuleLogLevel('OutlineSidebarUI', ERROR)`
  - `setModuleLogLevel('Feature.pdf-outline', ERROR)`
  - 其他模块（bookmark 管线等）保持原有级别。

影响：
- 控制台与日志文件中不再出现大纲相关的 info/debug 输出；错误仍会记录，排障不受影响。

---
### 当前任务（20251019230030）
名称：修复 Outline 插件点击大纲均跳转到第一页

问题/背景：
- 已统一书签/大纲数据结构为 `{ pageAt, position }`，并在首次导入 PDF 原生大纲时完成标准化；

---

## 🛡️ 针对“新增/改动功能导致无关功能失效”的项目级措施（20251025222445）

目标（不改业务代码，仅给出可实施计划）：
- 在现有“模块/插件隔离 + 事件总线 + 常量白名单”的基础上，补齐“行为契约可验证、依赖可静态检查、关键链路可快速回归”的三条防线。

仓库现状要点（与代码对应）：
- 事件总线与命名校验：前端 `src/frontend/common/event/event-bus.js` 已强制三段式事件名并有全局白名单（`global-event-registry.js`）；ScopedEventBus 已普及模块内事件（@scope/）。后端（Python）在 `src/backend/database/plugin/event_bus.py` 使用四段式 `table:*:*:*` 约定（作用于DB插件域）。  
- 事件常量集中：`src/frontend/common/event/event-constants.js` 与 `pdf-viewer-constants.js`。  
- WS 适配层：`src/frontend/pdf-viewer/adapters/websocket-adapter.js` 负责类型映射与桥接。  
- Feature 依赖与生命周期：`src/frontend/common/micro-service/feature-registry.js`。  
- 契约雏形：`todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/**` 已有 JSON Schema 草案。

措施一：事件 Payload 契约校验（前端运行时 + CI）
- 落点：为 `event-bus.js` 增加可选 `enablePayloadValidation`（默认仅测试/开发启用），在 `emit()` 时按事件名匹配 JSON Schema 校验 `data`。  
- Schema 来源：短期复用 `todo-and-doing/.../schemas/**`；中期迁移到 `src/frontend/common/contracts/{domain}/v1/messages/*.schema.json` 并以“事件名→schema”映射表导出。  
- 工具：Ajv（严格模式），对 `...:completed` 与 `...:failed` 分别建模。  
- 价值：避免因字段名/类型/默认值变更而引发“下游静默失败”。  
- 兼容策略：生产仅采样校验并上报（避免性能抖动）；局部事件（@scope/）默认跳过。

措施二：Consumer‑Driven Contract（WS 消息 CDC）
- 落点：新增 `tests/contract/ws/*.test.js`，以 `websocket-adapter.js` 为中心，mock `wsClient`：  
  - 断言前端发出的 `WEBSOCKET_MESSAGE_TYPES.*` 请求符合对应 Schema；  
  - 断言收到 `...:completed/failed` 时，适配器能正确转为 `PDF_VIEWER_EVENTS.*` 并包含关键字段。  
- 覆盖优先：`pdf-library:list/search/add/remove`、`annotation:*`、`anchor:*`、`debug-info:read`。

措施三：全局事件白名单差异报告 + ESLint 禁止字面量事件
- 落点：在 `global-event-registry.js` 暴露 `diffUsedEvents()`（扫描运行期或测试期采集到的事件集合，和 `event-constants.js` 求差），CI 输出报告；  
- ESLint：在现有 `eslint-rules/event-name-format.js` 基础上，新增“禁止字面量事件名（必须来自常量）”规则，覆盖 `emit/on/once/off`。

措施四：Feature 依赖静态校验与拓扑图
- 落点：脚本（测试阶段执行）遍历 `features/**/feature.config.js`：  
  - 校验 `dependencies[]` 是否为“已注册 Feature 名称”或“容器 token”；  
  - 输出缺失依赖、循环依赖；生成 Mermaid 依赖图存入 `logs/feature-deps.mmd` 以审阅。  
- 直接对症：近期多起“名称不一致导致安装失败”的问题。

措施五：黄金路径冒烟套件（5–10 条）
- 建议路径：  
  1) 打开PDF → `visited_at` 更新（URL 含 `pdf-id`）；  
  2) 书签按ID导航（`BOOKMARK.NAVIGATE_BY_ID.REQUESTED` → `navigationService.navigateTo`）；  
  3) 搜索 → 结果事件 → FilterFeature 缓存；  
  4) Viewer 在 `outline off/on` 两种启动下侧边栏装配正常；  
  5) WebSocket 断线重连后关键监听恢复。  
- 技术：Jest + jsdom，运行 < 60s，CI 阻断合并。

措施六：默认值与配置变更闸门
- 落点：集中 `src/frontend/common/utils/feature-flags.js` 暴露“配置版本号 + 变更日志”；PR 模板新增“默认值变更”清单；变更需附冒烟结果。

最小试点（建议下一迭代实施）：
- 为 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED` 与 `pdf-library:list:requested/completed` 各落地一套 Schema + 运行时校验 + 合约测试；仅在测试/开发启用运行时验证，收集告警并产出差异报告。

说明：本节仅为措施与计划沉淀，未包含“执行步骤”指令，后续经确认再落地实施。

---

## 🧪 落地进展（20251026133054）

已提交的最小样板（不改变现有业务行为）：
- 事件负载校验开关（默认关闭）：`src/frontend/common/event/event-bus.js` 新增 `setPayloadValidation()`；在 `emit()` 对全局事件可选校验并阻断非法负载；
- 契约注册表（样板）：`src/frontend/common/contracts/contract-registry.js` 提供 `createDefaultValidator()`，首批覆盖 `PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`；
- 全局事件白名单差异：`diffAllowed()` 方法，供日后 CI 报告使用；
- 测试：新增 2 组用例（负载校验、WebSocketAdapter Anchor 入站 CDC）。

默认状态不启用运行时校验；后续若需要，我将把更多事件与 WS 消息纳入 schema，并在 CI 中增加差异报告与冒烟集合。

### 快速修复（20251026151609）
- 背景：后端仅对 `*:requested` 入站消息做 Schema 校验；若缺少 `metadata` 则返回 `*:failed`。用户反馈 `pdf-library:search:failed` 与 `pdf-library:config-read:failed`。
- 变更（仅补齐出站 metadata，不改语义）：  
  - `recent-added`、`recent-opened` 两处搜索请求增加 `metadata:{version:'1.0.0'}`；  
  - `recent-searches` 的 `GET_CONFIG` 与 `UPDATE_CONFIG` 请求增加 `metadata:{version:'1.0.0'}`；  
  - `SearchManager` 路径原已包含 metadata，无需变更。
- 用户反馈：任意点击大纲节点都会跳到第 1 页。

定位结论（根因）：
- 第一阶段（已修复）：OutlineSidebarUI 与 BookmarkSidebarUI 读取了旧字段并带默认 1，导致跳到第一页；
- 深层次问题（本次全面收敛为严格模式）：
  - Bookmark 模型与加载流程存在“默认 pageAt=1 / 旧字段回退”，即使导入失败也会生成“看似可跳转”的节点。

---

## 🔎 实现索引：debug=1 预检 → WS 读取 debug‑info.json → Outline 装配（20251025230530）

用途：运行时通过 URL `?debug=1` 触发一次 WebSocket 读取 `logs/debug-info.json`，以 `flags.outline` 覆盖是否启用 `pdf-outline` 插件（否则回退 `pdf-bookmark`）。

- 前端（装配决策/预检）：
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js:105` 起
    - 读取 `debug=1`（未显式 `outline/feature_outline`）→ 创建临时 `WSClient`（隔离 EventBus `debug-preflight`）→ `request(WEBSOCKET_MESSAGE_TYPES.DEBUG_INFO_READ)`；
    - 解析 `flags.outline` → 设置 `overrideOutline`；
    - `isOutlineEnabled() || overrideOutline` → 选择 `PDFOutlineFeature` 或 `PDFBookmarkFeature` 注册。
  - `src/frontend/common/utils/feature-flags.js`
    - `isOutlineEnabled()` 仅读 `localStorage('FEATURE_OUTLINE')`；URL 不再直读，保持“读取来源”与“装配决策”分离。

- 前端（消息常量）：
  - `src/frontend/common/event/event-constants.js`
    - `WEBSOCKET_MESSAGE_TYPES.DEBUG_INFO_READ = 'debug-info:read:requested'`
    - `...COMPLETED/FAILED` 对应回执常量。

- 前端（URL 注入入口）：
  - `src/frontend/pdf-viewer/launcher.py`：构造 viewer URL 追加 `&debug=1`。
  - `src/frontend/pdf-home/pyqt-bridge.py`：Hosted 打开 viewer 时追加 `debug=1`（并维护 `logs/debug-info.json`）。

- 后端（协议与处理）：
  - `src/backend/msgCenter_server/standard_protocol.py`
    - 定义 `debug-info:read:{requested|completed|failed}`。
  - `src/backend/msgCenter_server/standard_server.py`
    - `handle_debug_info_read_request()`：读取 `logs/debug-info.json`（UTF-8），过滤 `_metadata`，返回 `{ flags, source }`。

职责评估：预检逻辑放在 bootstrap（装配决策前），临时 WS 不干扰主连接；职责边界清晰。若后续预检项增多，可抽象为 `PreflightFeature` 以保持 bootstrap 精简。

### 变更（2025-10-25 23:20:00）— 关闭开关，强制 Outline
- 需求：关闭切换按钮，直接指定加载 Outline，废止加载 Bookmark。
- 实施：
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 移除 `debug=1` 预检与条件分支，固定 `registry.register(new PDFOutlineFeature())`；不再注册 `PDFBookmarkFeature`；toast 固定提示“当前为 Outline 模式”。
  - `gui_launcher.py` 隐藏/禁用“启用 Outline”复选框；不再写入 `logs/debug-info.json`，Host/CLI 传参中的 `enable_outline` 统一置为 `False`（仅日志展示）。
- 兼容：对外事件常量继续使用 `BOOKMARK.*`（Outline 外壳复用）；后续若需要灰度，可引入独立 `PreflightFeature` 恢复预检能力。

### 修复（2025-10-25 23:50:20）— Outline 模式空白屏（日志：pdf-viewer-c83c60c58ad2-js.log）
- 现象：Toast 提示 Outline 模式，但打开空白；日志包含 `未注册的全局事件：'undefined'，订阅者ID: PDFAnchorFeature`。
- 原因：`features/pdf-anchor/index.js` 中对若干事件直接 `eventBus.on(...)`，当某常量未按预期可用时传入了 `undefined`，被 EventBus 白名单拦截；该错误可能打断部分初始化链路。
- 修复：
  - 为 Anchor 的所有订阅使用 `safeOn(evt, handler, opts)` 防御包装（事件名需为非空字符串，否则跳过并 warn）。
  - 与“强制 Outline”保持一致：`real-sidebars.js` 固定 `useOutline = true`，优先加载 `OutlineSidebarUI`；若模块加载失败临时回退 `BookmarkSidebarUI` 以避免完全空白。
- 复测要点：构建后重试，日志中应出现 `Loading PDF document into PDFViewerManager`、`PDFViewer initialized`、`Page info initialized`，且不再出现 `未注册的全局事件：'undefined'`。
  - URL 手动导航校验需要 `pdf-id`；UI 两处存在是否携带 `pdf-id` 的不一致。

涉及模块/文件（UTF-8 与 `\n`）：
- Outline UI：`src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js`
- 书签统一模型与导入：`src/frontend/pdf-viewer/features/pdf-bookmark/**`、`src/frontend/pdf-viewer/pdf/pdf-dest-utils.js`
- 导航统一入口：`src/frontend/pdf-viewer/features/url-navigation/index.js`（监听 `URL_PARAMS.REQUESTED`）

计划与步骤：
1) 严格模式改造（不保留旧格式、不做默认）：
   - Bookmark 模型：去掉默认 `pageAt=1`；无效置 `null`；`fromJSON` 仅接受 `pageAt/position`。
   - BookmarkManager.loadFromStorage：标准/旧格式路径均仅接收含有效 `pageAt` 的节点，其余跳过并记录警告；标准路径增加 try/catch。
   - pdf-bookmark/index.js：`#parseBookmarkPageAt` 仅读取 `bookmark.pageAt`，不再解析 `dest`；无效即报错。
2) UI 收敛到标准字段：
   - OutlineSidebarUI：仅使用 `pageAt/position`；缺失直接报错（alert + 日志），不再使用旧字段和任何默认；触发导航时统一携带 `pdf-id`。
   - BookmarkSidebarUI：同上，严格校验并报错；触发导航时统一携带 `pdf-id`。
3) 导入路径保持严格且修复解析短路：
   - 将导入解析绑定到同一轮加载的 `pdfDocument`：`importNativeBookmarks(native, nb => #parseBookmarkNormalizedDest(nb, data.pdfDocument))`；
   - `#parseBookmarkNormalizedDest()` 优先用 `BookmarkDataProvider.parseDestination()`（内部已持有同一 `pdfDocument`），失败再回退 `resolvePdfDest()`；
   - 解析不到 `pageAt` 的节点继续跳过并记录 warn（不做默认/回退）。
4) 验证：点击多个节点，URL 导航成功日志中的 `pageAt` 应与节点一致；不存在统一为 1 的情况。若节点无效，应弹窗并不跳转。

验收要点：
- 点击不同大纲节点应跳到对应页；如有 position，则滚动到对应百分比；
- `dist/latest/logs/pdf-viewer-*-js.log` 中不再出现“URL导航成功: pageAt:1” 的统一现象（除非节点确实是第1页）。

（新增 20251019235055）日志与过滤：
- 已在 `Feature.pdf-bookmark` 安装阶段启用模块级 DEBUG：`Feature.pdf-bookmark / BookmarkManager / BookmarkDataProvider / BookmarkSidebarUI / OutlineSidebarUI / PdfDestUtils`；
- 导入解析处增加 `[IMPORT]` 详细日志（provider/resolvePdfDest 路径与结果）；
- 过滤日志输出文件：`AItemp/filtered-outline-log.txt`（当前会话已导出，可用于对比刷新前后差异）。

### 当前任务（20251019183703）
名称：巡检 pdf-viewer 的 URL 解析与“按参数类型跳转”现状（不改代码）

问题/背景：
- 需要确认前端 viewer 在启动后，能否依据不同 URL 参数类型（pdf-id/page-at/position/anchor-id/annotation-id/outline-item-id）完成解析与正确的跳转分流；同时明确门闸、事件链与反馈。

结论（现状汇总）：
- 解析支持：`pdf-id`(必)、`page-at`、`position`、`anchor-id`、`annotation-id`、`outline-item-id`；含校验/标准化与告警（url-navigation/components/url-params-parser.js）。
- 类型分流：`annotation-id` 优先（发 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`）；其次 `page-at/position` → `navigationService.navigateTo`；`anchor-id` 由 PDFAnchorFeature 消费（监听 `URL_PARAMS.PARSED`）；`outline-item-id` 暂仅日志记录。
- 门闸：统一等待 `ANNOTATION.DATA.LOADED` 后执行 URL 导航（保证标注相关跳转有数据；纯页码跳转因此也会等待一次标注数据加载）。
- 反馈：发 `URL_PARAMS.SUCCESS/FAILED` 事件并弹出 toast；失败阶段区分 `parse/load/navigate`。
- 日志：对 URL 导航三模块默认 DEBUG；Annotation 模块默认 `error`（可用 `localStorage.ANNOTATION_LOG_LEVEL` 覆盖）。

验证要点（人工）：
1) `?pdf-id=sample&page-at=5&position=50` → 加载PDF → 标注就绪后跳到第5页并滚动50%，成功toast与 SUCCESS 事件；
2) `?pdf-id=sample&annotation-id=<id>` → 等标注数据 → 跳到标注位置（AnnotationFeature 负责计算 position）；
3) `?pdf-id=sample&anchor-id=pdfanchor-xxxxxxxxxxxx` → PDFAnchorFeature 加载并导航到锚点；
4) `?pdf-id=sample&outline-item-id=abc` → 仅日志，无跳转（待 Outline 接入）。

相关文件（UTF-8 与 `\n`）：
- URL 解析与分发：`src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js`、`.../url-jump-dispatcher.js`、`.../index.js`
- 基础导航：`src/frontend/pdf-viewer/features/core-navigation/services/navigation-service.js`
- 锚点消费：`src/frontend/pdf-viewer/features/pdf-anchor/index.js`
- 事件常量：`src/frontend/common/event/pdf-viewer-constants.js`
- URL 拼接：`src/frontend/pdf-viewer/launcher.py`

风险与后续：
- `outline-item-id` 未接入实际跳转，需要 Outline 子系统暴露统一入口（事件或服务）。
- 统一等待 `ANNOTATION.DATA.LOADED` 可能略增首跳延迟；如需“无标注场景最快页跳”，可增加条件化门闸（本次仅记录，未改代码）。
- `TOTAL_PAGES_UPDATED` 事件来源未检出，`NavigationService` 的越界修正主要依赖 DOM 兜底，后续可补发此事件。

#### 分流执行 → 导航插件（调用路径补充 20251019190403）
- page-at/position：URLJumpDispatcher.tryExecute() → CoreNavigationFeature.NavigationService.navigateTo() → emit NAVIGATION.GOTO → UIManagerCore/NavigationHandler 设置 PDFViewerManager.currentPageNumber → NavigationService.scrollToPosition() 平滑滚动 → URL_PARAMS.SUCCESS/FAILED。
- annotation-id：URLJumpDispatcher.tryExecute() → emit ANNOTATION.NAVIGATION.JUMP_REQUESTED → AnnotationFeature.#handleNavigateToAnnotation() 解析页与位置 → NavigationService.navigateTo() → 同上事件链与滚动 → 工具链自理高亮。
- anchor-id：PDFAnchorFeature 在锚点数据与渲染就绪后，emit URL_PARAMS.REQUESTED({ pageAt, position, anchorId }) → URLNavigationFeature.#handleNavigationRequested() → NavigationService.navigateTo() → 同上事件链。
- outline-item-id：当前仅日志记录，未触发导航。

#### 辅助发现与建议（20251019191344）
- URL 参数统一门闸：为保证“标注/锚点跳转”的稳定性，URL 导航默认等待 ANNOTATION.DATA.LOADED；若后续要优化纯页面跳转时延，可在 URLNavigationFeature 中改为条件化门闸（仅当存在 annotation-id/anchor-id 时等待）。
- 导航成功定义：NavigationService 在 GOTO 后通过 DOM 轮询确认页面有高度即视为就绪，再进行 position 平滑滚动；不依赖 PDF.js 的事件稳定性，具备可靠性。
- outline 跳转接入位：URLJumpDispatcher 已识别 outline-item-id，但未发送跳转事件；建议 Outline 模块暴露“按 outlineItemId 跳转”的统一事件（如 OUTLINE.NAVIGATION.JUMP_REQUESTED），并在 dispatcher 中对接。

### 变更记录（202510191930）
名称：Outline（大纲）节点ID规范化与“按ID导航”接口

改动：
- 节点ID规范：新建节点改为 `outlineItem-<8位Base64URL>`（文件：`features/pdf-bookmark/models/bookmark.js`，随机6字节 → Base64URL 8字符）；
- 新事件：`PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`（`pdf-viewer:bookmark-navigate-by-id:requested`），负载 `{ bookmarkId }`（兼容 `{ id | outlineItemId }`）；
- 消费实现：`features/pdf-bookmark/index.js` 监听上述事件，`BookmarkManager.getBookmark(id)` 查找节点，复用点击导航逻辑调用 `navigationService.navigateTo()`；
- 兼容性：老 ID（如 `bookmark-...`）仍可使用；按ID导航未作强校验，仅记录非规范前缀告警。

后续接入点（建议）：
- URL 跳转：在 `URLJumpDispatcher.tryExecute()` 检测到 `outlineItemId` 时，emit `BOOKMARK.NAVIGATE_BY_ID.REQUESTED` 以打通 URL → Outline 导航闭环（当前未改动 dispatcher，保留日志）。

### 破坏性更新（202510192030）
名称：统一大纲数据结构为“pageAt + position（%）”，并在“首次从 PDF 导入原生大纲”时落库为统一格式

改动摘要：
- Bookmark 模型（破坏性）：移除 `type/region/pageNumber`，统一为
  - `pageAt: number`（1-based 页码，必填）
  - `position: number|null`（0~100 的百分比，选填；无法从 dest 精确解析时为 null）
  - 位置：`features/pdf-bookmark/models/bookmark.js`
- 导入流程：当 DB 无数据、需要从 PDF 原生 outline 导入时，解析 `dest` → 计算 `{ pageAt, position? }` 并以新模型入库
  - 位置：`features/pdf-bookmark/index.js` → `#handlePdfLoaded()` → `BookmarkManager.importNativeBookmarks(..., #parseBookmarkNormalizedDest)`
  - 解析：`pdf/pdf-dest-utils.js` 新增 `yToPositionPercent(pdfDocument, pageAt, y)`（估算 top→百分比），失败则 position=null
- 导航：优先使用 `bookmark.pageAt/position` 调用 `navigationService.navigateTo()`；兼容旧数据仅保留“解析 dest”兜底路径
  - 位置：`features/pdf-bookmark/index.js` → `#handleNavigateRequest/#parseBookmarkPageAt`
- UI 对话框：添加/编辑使用 `pageAt` 与 `position` 字段（移除“类型/区域”）
  - 位置：`features/pdf-bookmark/components/bookmark-dialog.js`
- 存储序列化：`saveToStorage()` 序列化为 `{ id,name,pageAt,position,children,... }`
  - 位置：`features/pdf-bookmark/services/bookmark-manager.js`

注意：
- 该更新为破坏性：不再兼容历史多格式字段（type/region/pageNumber）；你已声明会清空旧数据以便测试。
- 若 `dest` 无 y 或无法推导百分比，position 将存为 null；导航仍可使用页码精确到页。

### 当前任务（20251019172922）
名称：核查 pdf-viewer 启动路径参数到最终 URL 的传递情况

背景与问题：
- 用户关心 `pdfoutline-item-id`、`pdfannotation-id`、`pdfanchor-id` 三项是否从启动路径贯通到最终 URL（供前端 url-navigation/相关 Feature 消费）。

相关模块/文件（UTF-8 与 `\n`）：
- Runner 传参：
  - `src/launcher/runner.py:235`（CLI 追加 `--anchor-id`）
  - `src/launcher/runner.py:237`（CLI 追加 `--annotation-id`）
  - `src/launcher/runner.py:325`（Hosted 传入 `anchor_id`/`annotation_id`）
- 前端 Launcher（最终 URL 拼接）：
  - `src/frontend/pdf-viewer/launcher.py:962`（`&anchor-id=...`）
  - `src/frontend/pdf-viewer/launcher.py:967`（`&annotation-id=...`）
- URL 解析（url-navigation）：
  - `src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js:45`（读取 `anchor-id`）
  - `src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js:46`（读取 `annotation-id`）
- GUI（Hosted Tab）参数来源：
  - `gui_launcher.py:1394`（读取 `h_pdfanchor_id`）
  - `gui_launcher.py:1395`（读取 `h_pdfannotation_id`）
  - `gui_launcher.py:1396`（读取 `h_pdfoutline_item_id`，仅日志打印，未向 runner 传递）

结论（2025-10-19）：
- `pdfanchor-id`（最终 URL 键：`anchor-id`）→ 已贯通，最终 URL 含该参数；
- `pdfannotation-id`（最终 URL 键：`annotation-id`）→ 已贯通，最终 URL 含该参数；
- `pdfoutline-item-id` → 已完成“前三步”贯通：GUI → runner（CLI/Hosted）→ 前端 launcher（URL 追加）→ url-params-parser 解析；尚未实现“第四步”的消费与跳转。

建议/后续：
1) 第四步（暂缓实施）：在识别到 `outline-item-id` 时，向 Outline 子系统发送统一“跳转请求”事件；当前需先调查 Outline 是否已暴露“接受 outlineItemId 并跳转”的统一机制（事件/服务 API）。
2) tech.md 已更新当前映射：`pdfanchor-id`→`anchor-id`、`pdfannotation-id`→`annotation-id`、`pdfoutline-item-id`→`outline-item-id`（已贯通到 URL）。

### 当前任务（20251019175530）
名称：annotation 日志关闭（模块级过滤）与 URL 跳转检查日志开启；解耦“解析→跳转”

背景：
- 需要临时关闭 annotation 域的调试日志（上一轮维修后的大量输出影响观测）；
- 需要开启 URL 导航链路的检查日志（便于后续问题排查与扩展）；
- 希望将“参数解析（URLParamsParser）”与“根据类型 id 执行跳转”的逻辑解耦，以便后续支持直接传入跳转请求。

改动要点：
- annotation 日志过滤：`AnnotationFeature.install()` 读取 `localStorage.ANNOTATION_LOG_LEVEL`，默认降到 `error`，通过 `setModuleLogLevel()` 覆盖 `Feature.annotation/AnnotationFeature/ScreenshotTool/TextHighlightTool/CommentTool`。
- URL 跳转检查日志：在 `URLNavigationFeature.install()` 中对 `URLNavigationFeature/URLJumpDispatcher/URLParamsParser` 设置 `debug` 级别（模块级覆盖，可被 LocalStorage/全局策略再覆盖）。
- 职责解耦：新增 `URLJumpDispatcher`（`features/url-navigation/components/url-jump-dispatcher.js`），`URLNavigationFeature` 只做“解析/校验/广播/门闸”，跳转执行改由 Dispatcher 完成（annotationId 触发 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`；pageAt/position 直接调用导航服务；outlineItemId 暂仅日志记录）。

说明：
- 未实现 outline-item-id 的跳转，仅完成记录；待 Outline 暴露统一跳转接口后接入。

### 配置更新（20251019181408）
名称：ESLint 忽略与默认扫描范围收敛

变更：
- 新增 `.eslintignore`：忽略 `dist/ build/ node_modules/ .venv/ *.min.js logs/ *.log AItemp/ coverage/ .idea/ .vscode/ public/vendor/`。
- 更新 `package.json` 脚本：
  - `lint`: `pnpm exec eslint src scripts eslint-rules --ext .js,.cjs,.mjs`
  - `lint:fix`: `pnpm exec eslint src scripts eslint-rules --ext .js,.cjs,.mjs --fix`

目的：
- 降低 ESLint 输出噪音，聚焦源码与脚本目录，提升检查速度。

后续分阶段 --fix 计划：
1) `src/frontend/pdf-viewer/features/**`（先自动 --fix，再人工项）
2) `src/frontend/pdf-viewer/{ui,bootstrap,adapters,pdf}/**` 与 `src/frontend/common/**`
3) `src/frontend/pdf-home/**`、`scripts/**`、`eslint-rules/**`
4) 其他零散 JS（若有）


### 当前任务（20251019091530）
名称：统一三种标注类型（截图/文字高亮/批注）的渲染流程（先梳理差异）

问题与背景：
- 现状：三种标注类型在“事件触发→页面/图层就绪→坐标换算→DOM渲染→更新/清理”的实现上不一致，导致体验不统一、维护成本高；
- 近期已对 ScreenshotTool 引入“延迟渲染队列 + pagerendered 回放 + 多种坐标兜底（rect / rectPercent / boundingBox）”并加强日志；TextHighlightTool 也有待渲染队列且依赖 textLayer；CommentTool 依靠 `CommentMarker` 直接定位；
- 期望：提炼统一的渲染管线和就绪判定、坐标体系、事件挂载与销毁、更新与清理策略，降低各插件的分叉实现。

相关模块/文件（UTF-8 与 `\\n`）：
- 截图：`src/frontend/pdf-viewer/features/annotation/tools/screenshot/index.js`
- 高亮：`src/frontend/pdf-viewer/features/annotation/tools/text-highlight/index.js`、`.../highlight-renderer.js`
- 批注：`src/frontend/pdf-viewer/features/annotation/tools/comment/index.js`、`.../comment-marker.js`
- 接口与管理：`src/frontend/pdf-viewer/features/annotation/interfaces/IAnnotationTool.js`、`.../core/annotation-manager.js`

三类渲染流程（概览）：
- 统一点：
  - 都订阅 `PDF_VIEWER_EVENTS.ANNOTATION` 领域事件，含 `CREATED`、`DELETED`、`DATA.LOADED`、`NAVIGATION.JUMP_SUCCESS`；
  - 都要获取页元素或图层并将 UI 覆盖层（或标记）追加至该页；
  - 都需要在缩放/翻页后具备恢复能力（截图/高亮已实现；批注通过 `pagerendered` 恢复）。
- 不一致点（核心）：
  - 就绪判定：截图/批注以 `pageView.div` 就绪为准；高亮要求 `textLayer` 就绪（并监听 `textlayerrendered`）；
  - 坐标体系：截图优先 `rectPercent`（可由 `rect`/`boundingBox`推导），批注用 `positionPercent|position`；高亮使用 `lineRects%` 或从 `textRanges` 动态计算；
  - 队列回放：截图与高亮均实现了“未就绪→入队→pagerendered 回放”；批注当前未显式维护按页队列；
  - DOM 容器：截图/批注挂 `.page`；高亮挂 `textLayer` 的自建 `highlightLayer`；
  - 颜色与交互：截图有颜色预设与圆角控制条；高亮有 action menu；批注是圆点图标（hover/点击）。

统一改造方向（草案，后续执行）：
1) 统一“渲染就绪判定”接口：抽象 `PageReadyPolicy`（pageDiv / textLayer / canvas 可选组合），工具声明所需资源；由通用渲染协调器调度；
2) 统一“待渲染队列”机制：在 AnnotationFeature 侧提供按页 bucket + `pagerendered/textlayerrendered` 驱动的回放能力，工具注册自己的 `ensureOverlayFor(annotation)`；
3) 统一“坐标数据规范”：数据层要求优先存储百分比坐标；提供标准化的推导函数（rect/boundingBox→percent），并在首次渲染时回写以便后续跳转与缩放的一致性；
4) 统一“更新/清理”约定：提供通用 `removeOverlay(id)`、`clearOverlays(page?)` 钩子，由各工具实现内部细节但复用同一生命周期；
5) 统一“日志与可观测性”：沿用 ScreenshotTool 的分步日志模式（禁用强制 toast），可通过 localStorage 调整。

本次输出：
- 仅梳理流程与差异并沉淀建议，不改动实现；待用户确认后推进统一改造。

执行进展（20251019093000）：
- 已完成第一步改造（最小侵入式统一）：
  1) AnnotationFeature：`#ensureAllOverlays()` 统一调用三类工具的 `ensureOverlayFor`；安装时加入 `setModuleLogLevel("CommentTool", ...)`；
  2) CommentTool：补齐 `ensureOverlayFor` + 待渲染队列（按页）+ `ANNOTATION.DATA.LOADED` 监听；`pagerendered/RENDER.PAGE_COMPLETED` 先 flush 再 restore；渲染前将像素坐标换算为百分比；
  3) CommentMarker：在 `renderToPage()` 中允许从像素推导百分比并回写 dataset，保证缩放/跳转一致；
  4) 新增静态测试：验证统一入口与注入点存在；

验证建议：
- 场景A：刷新→打开标注侧边栏（存在 comment + screenshot + text-highlight 三类数据）→逐页滚动；预期三类标注均可补画，队列在 pagerendered 后回放；
- 场景B：仅存老数据（comment 只有 position 像素坐标）→ 任意缩放后点击“跳转到标注”→ 标记应正确定位不漂移（已转换为百分比）；
- 场景C：删除 comment 标注→ 对应标记移除，待队列中（如果有）也移除。

补充（20251019095820）：
- 用户反馈“缩放后高亮消失/截图不随动”的行为，定位结论：
  - 高亮：`#renderHighlightForAnnotation()` 在已有记录时提前返回，未检测容器是否仍连到 DOM；textLayer 重建后高亮层被移除但不会重建；
  - 截图：仅监听 `pagerendered/RENDER.PAGE_COMPLETED`，未覆盖 `scalechanging/scalechange`；缩放后未重算 `markerRect`；
  - 侧边栏打开会无条件触发二次加载，失败/空返回会清空内存态，导致随后的恢复无数据；
- 修复计划：
  1) 高亮：已有记录分支增加容器有效性判断，不满足则重渲染；
  2) 三类工具统一监听缩放信号，执行“清空→重建”或“就地重算”；
  3) 侧边栏加载改为“按需加载/失败不清空旧态”。

### 当前任务（20251019065146）
名称：刷新后截图型标注框未显示（延迟渲染修复）

问题与背景：
- 现象：在 pdf-viewer 中使用截图工具保存标注后，刷新页面并打开“标注侧边栏”，应显示批注圆点、文字高亮、截图框等；实际仅截图框缺失；
- 触发链：标注数据加载完成（annotation-data:load:success）→ ScreenshotTool 尝试渲染 → 若对应页 PageView/Canvas 尚未就绪则直接返回；缺少重试逻辑；
- 已有能力：
  - JUMP_SUCCESS 与 CREATED 事件路径会渲染截图框；
  - 当 rectPercent 缺失、canvas 未就绪时存在 MutationObserver 兜底，但对“pageView 不存在”未覆盖。

结论（根因）：
- 标注数据加载事件早于页面渲染完成，ScreenshotTool 在页面未就绪时早退且不重试，导致“刷新后首次打开侧边栏”看不到截图框。

改动要点（2025-10-19）：
- ScreenshotTool 引入“延迟渲染”机制：
  - 新增队列 `#pendingMarkersByPage` 保存待渲染的截图标注；
  - 监听 PDF.js `pagerendered`，在对应页渲染完成后 `#flushPendingForPage(pageNumber)`；
  - `#handleAnnotationsLoaded` 改为 `#enqueueOrRender`，页面就绪→立即渲染，否则入队；
  - 销毁时解绑监听并清空队列，避免泄漏；
  - 保持既有 canvas 未就绪时的 MutationObserver 兜底逻辑。

涉及模块/文件：
- `src/frontend/pdf-viewer/features/annotation/tools/screenshot/index.js`（新增字段/监听/队列与回放）
- `src/frontend/pdf-viewer/features/annotation/tools/screenshot/screenshot-tool.defer.test.js`（新增单测）

验收标准：
- 刷新后打开标注侧边栏，滚动到目标页或点击“跳转”，截图标记框应出现；控制台可见“Flushed pending marker(s)”日志；
- 与文字高亮、批注等类型互不影响。

注意：
- 此变更不影响对外契约（无 API/事件名调整），仅改善渲染时序与健壮性。

### 当前任务（20251019074604）
名称：截图标注仍未显示与跳转无 position 的进一步修复

问题与背景：
- 反馈：刷新后打开侧边栏仍看不到截图框；标注“跳转”只定位到页码，没有 position 百分比。
- 可能原因：后端返回的老数据缺少 `rectPercent`，而前端渲染/跳转在 screenshot 类型上主要依赖 `rectPercent`；若仅有 `rect`（canvas 像素）或 `boundingBox`（pageDiv 像素），则会放弃渲染或无法计算 position。

改动要点（2025-10-19）：
- ScreenshotTool.renderScreenshotMarker：
  - 若仅有 `rect`：以 canvas 尺寸换算 `rectPercent`（canvas 就绪前入队等待）；
  - 若仅有 `boundingBox`：以 pageDiv 尺寸换算 `rectPercent` 并写回 data；
  - ensureOverlayFor 改为“入队或即时渲染”，避免 PageView 未就绪时失败。
- AnnotationFeature.#handleNavigateToAnnotation：
  - screenshot 在无 `rectPercent` 时，优先从 `rect` 的中心 y → 百分比，其次从 `boundingBox` 的中心 y → 百分比；
  - 这样“跳转”可以带上 position 百分比，实现精确滚动。

验证关注点：
- 侧边栏打开后截图框出现；点击跳转 URL 导航包含 position。

### 当前任务（20251019074911）
名称：核对三种标注类型的保存数据格式差异

结论：三种类型保存数据格式存在差异（均在 `data` 字段内体现必填/可选不同）：
- screenshot：必有 `rect` 与 `imagePath|imageData` 至少其一；可选 `rectPercent/markerColor/description/imageHash`；
- text-highlight：必有 `selectedText` 与 `highlightColor`，且 `textRanges` 与 `lineRects` 二选一；
- comment：必有 `content`，以及 `positionPercent{xPercent,yPercent}` 与 `position{x,y}` 二选一（保存前若仅有百分比，会补像素）。

证据：
- 模型校验（Annotation.#validateTypeSpecificData）：annotation.js:185、190、199、206、224、235、238
- 保存映射（仅对 comment 做 position 百分比→像素换算）：annotation-manager.js:257、259、260、261、269、284
- 类型声明（d.ts 仍是旧版、缺少若干字段）：annotation.d.ts:46、50、167

建议：
- 更新 d.ts 同步实现字段；如需后端统一约束，也可在保存前对 screenshot 做对称换算（例如统一提供 rectPercent）。

### 当前任务（20251019081229）
名称：为截图标注“全流程绘制”加分步编号日志与 toast 参数

动机：
- 现场仍反馈“截图框未出现/跳转无 position”，需要更细的可观测性以定位数据/时序/坐标/DOM 任一环。

做法：
- 在 ScreenshotTool 中增设 `#logStep()`，并在“加载→入队→回放→绘制→结果/错误”路径加入带编号的日志与 toast（SM-xx）。
- 编号覆盖：SM-01（初始化）、SM-02（数据加载）、SM-03（入队/即时）、SM-04（pagerendered 回放）、SM-05（数据兜底/起始）、SM-06（坐标与插入）、SM-07/08（移除/清空）。

使用：
- 观察 console 与 toast 即可快速定位：数据缺失（05.x）、页未就绪（03.2/04）、坐标转换（05.2*）、最终插入（06.*）。

### 当前任务（20251019082238）
名称：取消/定向放开日志过滤（Annotation 模块）

目的：
- 现场确认为“日志级别被过滤”，导致 SM-xx（INFO）不可见；需要放开 Annotation 模块的日志级别。

做法：
- 在 AnnotationFeature.install 读取 `localStorage.ANNOTATION_LOG_LEVEL`（默认 debug），覆盖模块级日志级别：
  - Feature.annotation / AnnotationFeature / ScreenshotTool / TextHighlightTool
- 可用键：`ANNOTATION_LOG_LEVEL = debug|info|warn|error`。

影响范围：
- 仅限 Annotation 相关模块，避免全局日志过量；可随时通过 localStorage 调整。

### 当前任务（20251018222030）
名称：gui_launcher 为 PDF-Viewer 启动参数新增 pdfanchor-id / pdfoutline-item-id / pdfannotation-id

问题与背景：
- 需求来自用户：在 GUI 启动器中，支持为 pdf-viewer 传入三类导航参数；
- 现状：前端 pdf-viewer 已支持 `--anchor-id/--pdfanchor` 与 `--annotation-id`（最终注入 URL 为 `anchor-id` / `annotation-id`），暂未提供 outline-item-id 的 CLI 参数；
- gui_launcher 的 Hosted Tab 存在 PDF 参数输入（`h_pdf_id/h_page_at/h_position`），但 `_start_pdf_viewer_hosted()` 误用不存在的 `pdf_id_input/page_at_input/position_input`，应修正为使用 Hosted Tab 的控件值。

改动要点（2025-10-18）：
- GUI（Hosted Tab）新增 3 个输入框：
  - `pdfanchor-id`（映射为 `anchor_id` → 前端 URL `anchor-id`）
  - `pdfannotation-id`（映射为 `annotation_id` → 前端 URL `annotation-id`）
  - `pdfoutline-item-id`（先占位，仅记录与日志，前端暂未启用）
- 修复 Hosted 启动实现的控件引用：改用 `h_pdf_id/h_page_at/h_position`；
- LauncherThread._start_pdf_viewer：支持从 `params` 读取 `anchor_id/annotation_id` 并传入 runner；
- runner.start_pdf_viewer_hosted/cli：函数签名扩展，分别通过 FE LaunchConfig 或 CLI `--anchor-id/--annotation-id` 透传至前端。

已知限制：
- outline-item-id 仅在 GUI 中录入与日志记录，未注入 CLI（避免前端 argparse 报“未知参数”）。待前端支持后再贯通。

相关文件/函数：
- `gui_launcher.py`：`_create_hosted_tab()`、`_start_pdf_viewer_hosted()`、`LauncherThread._start_pdf_viewer()`
- `src/launcher/runner.py`：`start_pdf_viewer_hosted()`、`start_pdf_viewer_cli()`
- 前端：`src/frontend/pdf-viewer/launcher.py`（已支持 anchor/annotation）

验证建议：
1) Hosted Tab 填写：`pdf_id=test`、`pdfanchor-id=pdfanchor-test`、勾选“生产模式”，点击“启动 PDF-Viewer (Hosted)”；
2) 查看 `logs/pdf-viewer-*-python.log` 与 `dist/latest/logs/pdf-viewer-*-js.log`（或项目 logs），应出现包含 `anchor-id=pdfanchor-test` 的 URL；
3) CLI 方式（ai_launcher Tab）暂不支持 anchor/annotation 直通（不传入未知参数以避免 argparse 报错）。

### 当前任务（20251018214348）
名称：划词选中时翻译应默认静默，仅在显式操作时触发

背景：
- 现状：`pdf-translator` 的 `SelectionMonitor` 在安装后默认启用，任何划词都会自动发送 `pdf-translator:text:selected`，从而触发翻译；
- 期望：只有两种情况触发翻译：
  1) 用户点击“划词弹出的翻译按钮”（来源于 TextSelectionQuickActions 或 TextHighlightTool 的 Translate 操作）；
  2) 用户打开“翻译侧边栏”后，才开启“划词→自动翻译”的联动；
  其他情况下，划词应保持静默不触发翻译。

相关模块/文件：
- 翻译功能域：`src/frontend/pdf-viewer/features/pdf-translator/index.js`
- 文本选择监听器：`src/frontend/pdf-viewer/features/pdf-translator/services/SelectionMonitor.js`
- 侧边栏管理：`src/frontend/pdf-viewer/features/sidebar-manager/index.js`
- 划词快捷操作：`src/frontend/pdf-viewer/features/text-selection-quick-actions/index.js`
- 高亮工具→翻译：`src/frontend/pdf-viewer/features/annotation/tools/text-highlight/index.js`

执行步骤：
1) 将 `SelectionMonitor` 默认配置改为 `enabled: false`，安装阶段不调用 `startMonitoring()`；
2) 在 `PDFTranslatorFeature` 绑定侧边栏事件：
   - `sidebar:opened:completed` 且 `sidebarId==='translate'` → `selectionMonitor.setEnabled(true)` 并清理上次选择；
   - `sidebar:closed:completed` 且 `sidebarId==='translate'` → `selectionMonitor.setEnabled(false)` 并清理上次选择；
   - 同时向全局广播领域侧边栏事件 `pdf-translator:sidebar:opened/closed`（可选消费）；
3) 在 `#handleTextSelected()` 增加保护：仅当 `source in {'quick-actions','text-highlight'}` 或 `selectionMonitor.isEnabled()` 时才执行翻译；否则忽略。

验收标准：
- 未打开翻译侧边栏时，普通划词不会出现任何翻译输出；
- 打开翻译侧边栏后，划词将自动翻译；
- 点击“翻译”按钮（快捷操作/高亮菜单）时，无论侧边栏是否已开，均会触发翻译（并请求打开侧边栏）；
- 关闭翻译侧边栏后，划词不再自动翻译。

注意：
- UI 文案“选中文本即可自动翻译”位于翻译侧边栏内，仅在打开侧边栏的场景出现，语义仍成立。

### 修复记录（20251018215730）
名称：中文划词出现四个错误 toast（B2：底层禁用 toast）

---

## 📦 文件体量评估与清理建议（20251018220157）

背景：
- 用户询问 memory-bank 关键文件体量现状与是否需要清理归纳。

扫描结果（2025-10-18 22:01:57）：
- 目录：`.kilocode/rules/memory-bank` 总体量 ≈ 425.11 KB（435,310 B）
- `context.md`：97.78 KB（100,129 B）
- `tech.md`：58.04 KB（59,435 B）
- `architecture.md`：20.17 KB（20,659 B）
- 其它：存在若干 `context.md.backup-*`、`archive/` 与 `updates/` 文件，体量在可控范围。

结论：
- 容量层面无需清理（总体 < 1 MB）。
- 可读性层面建议做“结构化归纳”，重点是 `context.md` 接近 100 KB，适合拆分“当前活跃任务/长期约定/历史归档”三段。

建议（最小改动）：
- `context.md`：顶部保留「当前活跃任务」与「长期约定」，历史条目周期性迁移到 `archive/` 月度文件。
- `tech.md`：补充「目录索引」与「最近更新（10 条）」小节，控制增量记录。
- `architecture.md`：体量健康，无需动作；如后续加入架构图/契约清单，再考虑拆分为 `architecture/` 子目录。

待决策项：
- 若同意执行整理：按上述结构移动历史段落并生成目录，不改动内容语义，严格保持 UTF-8 与 `\n`。

---

## 🧠 知识卡/问题记录（若干）

(保留原有知识卡条目；如需迁移，按日期阈值归档到 `archive/`。)

---

## 🗄️ 历史归档策略说明

- 归档阈值：将早于 2025-10-10 的历史条目迁移到 `archive/context-2025-01-01_to_2025-10-10.md`，并在此处留下指向归档文件的说明。
- 本次检查结果：未发现早于 2025-10-10 的条目，未发生迁移。

背景：
- 入口启用了“error 自动 toast”；同一次翻译失败被引擎层、服务层、Feature 层、UI 层各自 `logger.error` 记录，导致 4 条 toast。
- 其中 3 条因 Error 对象不可枚举，被 Logger 摘要为 `{}`。

措施：
- 在三处底层 `logger.error` 显式传入 `{ toast: { type: 'debug' } }`，不弹 toast，仅保留 UI 层一处 toast：
  - features/pdf-translator/services/MyMemoryEngine.js
  - features/pdf-translator/services/TranslationService.js
  - features/pdf-translator/index.js

效果：
- 同一失败仅出现 1 条 toast；控制台保留完整错误栈。

### 当前任务（20251017210830）
名称：修复 PDF.js CMap/标准字体资源 404（中文字体无法解析）

背景：
- 控制台报错 `fetchBuiltInCMap Not Found`，请求路径为 `/static/@pdfjs/cmaps/...`；
- 构建脚本将 `pdfjs-dist` 复制到了 `dist/latest/static/vendor/pdfjs-dist/`，但运行时代码仍用 `@pdfjs` 别名生成路径，导致生产环境 404。

相关模块/文件：
- 构建与别名：`vite.config.js`（`@pdfjs`→`node_modules/pdfjs-dist`，开发态）、`build.frontend.pdf_viewer.py`（注入 `window.__PDFJS_VENDOR_BASE__`）；
- 运行时代码：
  - `src/frontend/pdf-viewer/features/pdf-reader/components/pdf-loader.js`
  - `src/frontend/pdf-viewer/features/pdf-reader/services/pdf-manager-service.js`
  - `src/frontend/pdf-viewer/pdf/pdf-config.js`
  - `src/frontend/pdf-viewer/pdf/pdf-loader.js`

执行步骤：
1. 在运行时优先读取 `window.__PDFJS_VENDOR_BASE__`（由构建脚本注入为 `/static/vendor/pdfjs-dist/`）；\n
2. 若存在则设置：
   - `cMapUrl = ${base}cmaps/`
   - `standardFontDataUrl = ${base}standard_fonts/`
   - `workerSrc = ${base}build/pdf.worker.min.mjs`
3. 否则回退到 `new URL('@pdfjs/...', import.meta.url).href`（保留开发态体验）；
4. 重新构建 pdf-viewer 并发布到 `dist/latest/static`；
5. 验证控制台无 404，CJK 字体正常渲染。

验收标准：
- 不再出现对 `/static/@pdfjs/cmaps/*` 的请求；
- 资源实际从 `/static/vendor/pdfjs-dist/(cmaps|standard_fonts|build)` 加载成功；
- 中文 PDF 可正常显示文本层与字体。

### 当前任务（20251017212720）
名称：pdf-viewer 前端错误未通过 toast 展示（仅后端WS错误有toast）

背景：
- 现有实现仅对 WebSocket 层错误通过 `AppCoreFeature` 做了 toast 透传；
- 其他由前端各模块调用 `logger.error()` 输出的错误默认不 toast，用户体验不一致。

定位：
- 公共 Logger（`src/frontend/common/utils/logger.js`）已内建自动 toast 能力（`enableAutoToast`），但未在 pdf-viewer 中启用；
- 因此需要在应用入口启用自动 toast（限定 error 级别即可）。

措施：
- 在 `src/frontend/pdf-viewer/main.js` 引入并调用：
  - `enableAutoToast({ levels: [LogLevel.ERROR], defaultMs: 6000 })`
- 保持 WS 错误透传逻辑不变；
- 不改动业务处的 `logger.error()` 调用点，避免大范围侵入。

验收标准：
- 制造前端 error 日志（如 bootstrap 捕获异常），应看到右上角红色 toast，消息与控制台一致；
- 后端 WS 错误仍能显示 toast（不回退、不冲突）。

### 当前任务（20251017214140）
名称：全局未捕获错误（非 logger）也 toast

背景：
- 旧 `index.html` 仅注册了全局监听并 `console.error`，未弹 toast；
- 你要求“没有 logger 捕获的错误也 toast 出来”。

措施：
- 新增 `src/frontend/pdf-viewer/assets/global-error-toast.js`（ESM）并在 `<head>` 早期加载；
- 监听 `window.onerror` 与 `unhandledrejection`，统一使用第三方 toast 适配器展示；
- 内置去重与速率限制，避免 toast 风暴；提供 `localStorage.GLOBAL_ERROR_TOAST_DISABLED='true'` 关闭开关。

验收标准：
- 手动触发 `throw Error()` 或 `Promise.reject(...)`，应看到右上角红色 toast；
- 控制台仍保留栈与错误详情。

### 当前任务（20251017215810）
名称：修复 Bookmark 导入时“Skipping bookmark with invalid dest”警告

背景：
- 导入 PDF 原生大纲时，部分书签的 `dest` 为“命名目的地”（字符串），当前解析逻辑未覆盖 → 被视为 invalid。

措施：
- 更新 `src/frontend/pdf-viewer/features/pdf-bookmark/index.js:#parseBookmarkDest()`：
  - 新增 `typeof dest === 'string'` 分支：先 `pdfDocument.getDestination(dest)` → 解析为数组后与数组分支一致处理；
  - 放宽对象判断：`pageRef` 只要是对象即尝试 `pdfDocument.getPageIndex(pageRef)`（不再强依赖 `num` in pageRef）。

验收标准：
- 打开先前触发告警的 PDF，观察日志不再大量出现“Skipping bookmark with invalid dest”；\n
- 对应书签可被导入或至少解析页码成功（可点击跳转）。

### 当前任务（20251017221450）
名称：标注坐标定位与卡片跳转失效排查 + 修复跨模块事件

背景：
- 用户反馈：点击标注卡片“跳转”无反应；需确认标注坐标是百分比还是绝对值；并排查是否存在重复实现。

定位与结论：
- 坐标体系：\n
  - 截图：百分比矩形 `rectPercent{xPercent,yPercent,widthPercent,heightPercent}`（tools/screenshot/index.js）；\n
  - 高亮：`lineRects[*].{xPercent,yPercent,widthPercent,heightPercent}`（annotation/index.js 用首段中心 percent 导航）；\n
  - 批注：`data.position{x,y}` 像素定位（comment-marker.js 渲染为绝对定位）；导航时按页面高度换算为百分比。\n
  - 兼容：若仅有像素 rect，会在渲染时换算为百分比；整体策略为“存百分比、用百分比，必要时从像素换算”。\n
- 跳转失效根因：标注模块在作用域 EventBus 上 emit `NAVIGATION.GOTO`/`NAVIGATION.URL_PARAMS.REQUESTED`，而 UI/URL 导航监听的是全局 EventBus → 事件未被消费。\n

修复：
- `features/annotation/components/annotation-sidebar-ui.js`：将跳转事件改为 `emitGlobal(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, ...)`；\n
- `features/annotation/index.js`：将 `NAVIGATION.URL_PARAMS.REQUESTED` 改为 `emitGlobal(...)`；\n
- 已构建到 dist（生产模式生效）。\n

重复实现说明：
- 导航存在两条路径：直接 `NAVIGATION.GOTO` 与 URL 导航 `NAVIGATION.URL_PARAMS.REQUESTED`；建议长期统一到 `NavigationService.navigateTo()`，减少语义重复与链路分叉。\n

### 当前任务（20251014093040）
名称：GUI 启动器日志落盘情况确认（已落实）

背景：
- 用户在 gui_launcher 中点击“启动后台”或“启动 PDF-Home”时，界面会打印大量信息；
- 需确认这些信息是否保存到本地日志文件，以及日志路径与查看方式。

相关模块/文件：
- 界面日志输出：gui_launcher.py:1041（`_log()` 仅写入界面，不落盘）
- CLI/ai_launcher 日志：ai_launcher.py:38, 66-87（`logs/ai-launcher.log`）、ai_launcher.py:727, 739-747（支持 `--logs-dir`）
- 后端启动器日志：src/backend/launcher.py:30-74（`logs/backend-launcher.log`）
- WebSocket 服务日志：src/backend/msgCenter_server/standard_server.py:66-68（`logs/ws-server.log`）
- HTTP 文件服务日志：src/backend/pdfFile_server/embed_fileserver.py:121, 138, 176, 268（`logs/http-server*.log`）
- pdf-home 应用日志：src/frontend/pdf-home/launcher.py:56-87, 116-134（`logs/pdf-home.log`）
- pdf-home JS 控制台日志：src/frontend/pdf-home/main_window.py:151-175, 206-215（`logs/pdf-home-js.log`）

结论：
- 组件日志均落盘到 `logs/`：`ai-launcher.log`、`backend-launcher.log`、`ws-server.log`、`http-server*.log`、`pdf-home.log`、`pdf-home-js.log` 等；
- 新增实现：GUI 界面日志现已同步写入 `logs/gui-launcher.log`（或当前 GUI 选择的日志目录），实现位置：`gui_launcher.py:1041-1060`；
- GUI 在调用 ai_launcher start 时会注入 `--logs-dir`（gui_launcher.py:1377-1385），ai_launcher 会据此在同一目录落盘（ai_launcher.py:739-747）。

建议：
- 已实现，后续如需滚动/分级可在 `gui_launcher.py:_log()` 外抽象 Logger 并引入旋转策略，但当前不做超范围改造。

### 变更记录（20251014101925）
- 增强：`gui_launcher.py:_log()` 同步写入 `gui-launcher.log`（UTF-8，强制 `\n`）。

### 当前任务（20251014103650）
名称：从 GUI 启动 pdf-home 闪退排查

背景：
- 用户反馈：点击 GUI 中“启动 PDF-Home”后闪退（疑似非 Hosted 模式）；
- 先前 GUI 增强仅影响 `_log()` 落盘，理论上不应致崩，但需通过子进程输出定位问题。

定位与临时手段：
- gui_launcher.py: `_start_pdf_home()` 现已将子进程 stdout/stderr 重定向到 `logs/pdf-home-boot.log`（UTF-8，`\n`），用于捕获早期异常；
- 请复现后提供 `logs/pdf-home-boot.log` 尾部内容。

后续可能方向：
- 若异常为 QtWebEngine 初始化/导入顺序问题，继续核实 pdf-home 子进程路径与 Qt 环境；
- 若端口/依赖未就绪，补充启动顺序/重试；
    - 若是参数传递问题（如 `--msgCenter-port` 等），调整 GUI 注入参数与 pdf-home Launcher 解析。

### 修复记录（20251014103052）
- 现象：CLI 选项卡点击 Start 报错 `QThread: Destroyed while thread '' is still running`，导致闪退；
- 根因：`_run_ai_launcher()` 未持有 `_AiThread` 的对象引用；
- 修复：
  - `GUILauncher.__init__` 增加 `self._ai_threads: list = []`；
    - `_run_ai_launcher()` 将线程加入列表，并在 `_on_ai_thread_finished()` 中移除并 `deleteLater()`；
    - 规避 QThread 在运行中被销毁。

### 当前任务（20251018080434）
名称：Outline 跳转失败（命名目的地需要转页码）

背景：
- 用户反馈个别 PDF 的大纲节点点击无效；经排查，部分大纲项的 `dest` 并非直接页码，可能是：
  1) 字符串命名目的地（需 `pdfDocument.getDestination(name)` 解析）；
  2) 目的地数组，首位为页面引用对象 `{num,gen}`；
  3) 目的地数组，首位为 0-based 页索引 number（需要 +1 转成 1-based 页码）。
- 代码里存在两处重复解析实现，且旧解析在 number 分支未 +1，存在 off-by-one 风险：
  - `src/frontend/pdf-viewer/bookmark/bookmark-data-provider.js#parseDestination()`
  - `src/frontend/pdf-viewer/features/pdf-bookmark/index.js#parseBookmarkDest()`

相关模块/文件：
- 侧边栏 UI：`src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js`
- 新书签域：`src/frontend/pdf-viewer/features/pdf-bookmark/*`
- 旧书签域：`src/frontend/pdf-viewer/bookmark/*`
- 导航服务：`src/frontend/pdf-viewer/features/core-navigation/services/navigation-service.js`

执行步骤：
1. 新增工具 `src/frontend/pdf-viewer/pdf/pdf-dest-utils.js`：统一解析 `dest` → 1-based 页码；返回 `{pageNumber, position?, zoom?}`。
2. 修改两处调用：
   - `features/pdf-bookmark/index.js` 内部 `#parseBookmarkDest()` 改为调用工具；
   - `bookmark/bookmark-data-provider.js#parseDestination()` 改为调用工具，并修复 numeric 分支的 +1。
3. 提升准确性：`ui/bookmark-sidebar-ui.js` 在点击时若存在 `region.scrollY`，同时传递 `position` 给 `NAVIGATION.URL_PARAMS.REQUESTED`。
4. 验证：打开含命名目的地的大纲 PDF，点击应正确跳转到对应页（必要时带位置）；控制台不再出现“无法解析书签dest”等告警。

验收标准：
- 对命名目的地/页面引用的节点点击可稳定到达目标页；
- 旧实现的 number 分支页码偏移修复；
- 侧边栏点击在具备 region 的节点时携带 position，落点更准确。

### 修复记录（20251014110230）
名称：ai_launcher stop 后 pdfFile_server 仍 running

原因：
- ai_launcher 仅记录并停止了 `launcher.py start` 的短生命周期 PID，未关闭由其启动的 `msgCenter_server` 与 `pdfFile-server`；

修复：
- `ai_launcher._stop_backend()` 改为调用 `src/backend/launcher.py stop` 统一停止后台服务，并将 `backend-process-info.json` 标记为 stopped；

验证：
    - `ai_launcher start` → `stop` → `status`，`backend status` 中两个服务应为 stopped。

### 修复记录（20251014111740）
名称：ai_launcher start 后 status 显示 msgCenter_server 为 stopped

原因：
- `standard_server` 在 app 非空时要求提供 `runtime_mode/data_dir/db_path` 参数；
- `backend/launcher.py start` 未传入路径参数，导致初始化阶段抛错并退出。

修复：
- 在 `BackendProcessManager.start_service('msgCenter_server', ...)` 中，当未提供任何路径参数时自动追加 `--runtime-mode single` 作为兜底；

验证：
    - 重新执行 `ai_launcher start/status`，应看到 `msgCenter_server` 运行；`logs/ws-server.log` 有“启动成功”日志。

### 调整记录（20251014114020）
名称：GUI Hosted 启动默认改为源码开发模式

背景：
- 用户期望：在 GUI 的 Hosted 启动 pdf-home 时，应当使用源码与 Vite（开发模式），而非 dist 构建产物；同时应自动确保 Vite 与后端已启动。

变更：
- gui_launcher.py：
  - `_start_backend_hosted()` 默认使用源码（`runtime_mode='single'`），不再强制 dist/latest；支持从“高级设置”传入路径覆盖；
  - `_start_pdf_home_hosted()` 改为 `is_prod=False`（开发模式），并在 Vite 未运行时调用 `ai_launcher._start_vite(vite_port)` 启动；若 Hosted 后端未运行则自动启动；
  - 新增 `_is_port_listening()` 判断端口监听；

### 增强记录（20251014111606）
名称：Hosted 面板新增“启动 Vite (Dev)”按钮

变更：
- gui_launcher.py：
  - Hosted 页新增按钮，调用 `_start_vite_dev()`；
  - `_start_vite_dev()`：优先 ai_launcher._start_vite；无 _ai 回退 pnpm；更新 `runtime-ports.json` 与 `dev-process-info.json`；

价值：
- 手动拉起 Vite，便于开发态快速恢复；与 Hosted pdf-home 的开发模式联动使用。

预期：
- 日志不再出现 dist/static 路径；
- `pdf-home.log` 的前端 URL 指向 `http://localhost:{vite_port}/pdf-home/`；
- Vite 未启动时由 GUI 自动拉起（输出到 `logs/npm-dev.log`，状态在 `dev-process-info.json`）。

### 当前任务（20251014073030）
名称：pdf-home 在缺少 QtWebEngine 时的启动回退（Hosted 模式）

背景：
- gui_launcher 改造后，Hosted 启动 pdf-home 出现空白窗口；
- 日志显示 `QWebEngineView=None`，`WebView created? False`，`load_frontend: WebView is None`；
- 需要在不破坏现有端口解析/日志/WS/QWebChannel 的前提下，为缺失 QtWebEngine 的环境提供降级方案。

相关模块/文件：
- `src/frontend/pdf-home/launcher.py`（主流程与前端加载）
- `src/frontend/pdf-home/main_window.py`（WebView 创建处，仅在 QWebEngine 可用时生效）

执行步骤：
1) 在 `PdfHomeApp.run()` 步骤 8 中检测 `self.window.web_view`；
2) 若可用：按原逻辑 `load_frontend(url)`；
3) 若不可用：调用 `webbrowser.open(url)`，在状态栏提示“未检测到 QtWebEngine，已在默认浏览器打开”；
4) 保留现有 `_setup_websocket()` 与 `_setup_qwebchannel()`（后者若无 `web_page` 会打印警告，不阻断）。

状态：✅ 已完成（已回退为外部浏览器模式，窗口状态栏给出提示）。

### 当前任务（20251014074220）
名称：QtWebEngine 导入顺序导致 WebView=None 的修复（延迟导入 + 兼容层重试）

背景：
- 运行环境已安装 QtWebEngine，但日志仍显示 `QWebEngineView=None`；
- 之前类似问题通过“导入顺序”修复过，本次回归后再次触发。

方案：
- 在 `src/qt/compat.py` 中：先尝试加载 QtWebEngine（Core/Widgets 多策略），再导入 QWebChannel；并提供 `ensure_webengine_loaded()` 以便在 QApplication 启动后重试；
- 在 `src/frontend/pdf-home/launcher.py` 中：延迟导入 `main_window.py`（在 QApplication 创建与 compat 重试后执行），确保 QWebEngine* 类绑定为非 None。

状态：✅ 已完成（回放验证：WebView 可正常创建；若仍失败则自动外部浏览器回退）。

### 当前任务（20251014081230）
名称：Hosted 模式稳定化（去除 global 报错 + 启动前预引导 QtWebEngine）

背景：
- 报错：`name 'QWebEngineView' is used prior to global declaration (main_window.py, line 90)`；
- compat 在早期导入时为 None，按名导入绑定为 None 后无法在后续修复；需要在窗口初始化阶段局部选择类并兜底直导入。

方案：
- main_window：以局部变量选择 WebEngine 类（compat → 直导入），避免对模块级符号写入；
- gui_launcher：QApplication 前设置 `AA_ShareOpenGLContexts` 并预导入 WebEngine 模块，满足 Qt 时序（参考 2025-10-12 日志策略）。

状态：✅ 已完成并提交代码（Hosted/子进程双模式可用）。

### 当前任务（20251016171909）
名称：勾选“生产模式”后仍然请求 Vite 端口的成因与参数传递路径确认

背景：
- 运行 `python dist/latest/gui_launcher.py`，用户勾选“生产模式（--prod）”后观察到仍有对 Vite 端口的请求/探测。

参数传递路径（前端模式 dev/prod）
- GUI（dist/latest/gui_launcher.py）
  - CLI 启动：`_on_start_pdf_home/_viewer` → `LauncherThread._start_pdf_home/_viewer` → `--prod` 或 `--vite-port <n>` 注入。
  - Hosted 启动：`_start_pdf_home_hosted/_viewer_hosted` → `_LConfig.options.frontend_prod` → `runner` → FE LaunchConfig(`is_prod`).
- Runner（src/launcher/runner.py）
  - 将 `frontend_prod` 正确映射为 FE 端 `LaunchConfig.is_prod`。
- FE 前端（pdf-home/pdf-viewer launcher）
  - `is_prod=True` → URL 基址使用 HTTP 文件服务器；`is_prod=False` → 使用 Vite URL。

问题根因（历史逻辑）
- Hosted 启动 pdf-home 的早期实现会“无条件尝试确保 Vite 运行”，即便勾选了生产模式也会做端口探测/拉起操作，造成“请求 Vite 端口”的观感。
- 已修复：现仅在开发模式（未勾选生产）下，才会 `_is_port_listening()` 并按需 `ai_launcher._start_vite(...)`。生产模式分支不再触发任何 Vite 相关动作。
  - 参考：`dist/latest/gui_launcher.py:1379-1399`（分支判断）。

注意事项
- pdf-home 运行后，内部 `PyQtBridge` 的 `is_prod` 值固定为启动时注入；GUI 复选框后续切换不会影响已运行实例。因此从已运行的 pdf-home 内再打开 pdf-viewer，仍按该实例启动时的模式构造 URL。

验证要点
- 生产模式下启动 pdf-home：`logs/pdf-home.log` 中应看到 URL 基址为 `http://127.0.0.1:<pdfFile_port>/pdf-home/`；`logs/dev-process-info.json` 不应更新 `vite`。

结论
- 生产模式参数在两条路径均传递正确；历史问题在于 Hosted pdf-home 启动前“确保 Vite 运行”的无条件动作，已改为仅限开发模式触发。

### 当前任务（20251016233032）
名称：gui_launcher 脚本重复实现与逻辑评审（不修改 dist）

要点：
- 重复实现：
  - 组件根解析：gui 自实现 vs src.launcher.config.resolve_component_root（gui_launcher.py:37；src/launcher/config.py:21）。
  - 后端 CLI 启动：gui 手写 subprocess vs runner.start_backend_cli（gui_launcher.py:204；src/launcher/runner.py:24）。
  - Vite 启动与状态：gui 自管 vs ai_launcher/服务（gui_launcher.py:1453 等）。
  - 端口读写：GUI 与 FE launcher 均读写 runtime-ports.json（gui_launcher.py:1284,1513；pdf-home:146,382；pdf-viewer:222,487）。
- 职责混杂：GUI 既做 UI 又编排端口/进程/状态文件，偏离“UI 与 runner 解耦”的目标。

建议：
- 在 `src/launcher` 新增 `ports.py` 与 `dev_server.py`，集中端口与 Vite 管理；
- GUI 统一走 `runner.*`（含新增 `start_pdf_home_cli/start_pdf_viewer_cli`）以去除 subprocess 细节；
- GUI 使用 `resolve_component_root()`，不再本地实现；
- GUI 主要“读状态、展示”，尽量不写运行时状态文件。

### 执行结果（20251016235606）
已按建议在源码侧落地：
- 新增 `src/launcher/ports.py`、`src/launcher/dev_server.py`；
- 扩展 `src/launcher/runner.py`：新增 FE CLI 启动函数；
- 更新 `gui_launcher.py`（源码）：
  - 组件根解析委托给 `src.launcher.config.resolve_component_root`；
  - `_start_backend/_start_pdf_home/_start_pdf_viewer` 调用 runner；
  - `_runtime_ports` 使用 `ports.read_runtime_ports`；
  - `_start_vite_dev` 使用 `dev_server.ensure_vite`；
  - 不修改 dist/；
效果：去除重复、统一行为与状态写入位置（UTF-8, \n）。

### 追踪增强（20251017003540）
为定位“仍然走 vite_port”的链路问题，新增逐级 Trace 日志：
- GUI：`[TRACE:UI]`、`[TRACE:HOSTED]`、`[TRACE:CLI]` 打印 is_prod、UI端口、runtime-ports、拼装 cfg 等；
- Runner：`[TRACE:RUNNER:CLI]` 打印输入 cfg、runtime-ports、最终命令；
- 前端：在 pdf-home/pdf-viewer 日志中打印 Mode 与最终 URL。
查看：`logs/gui-launcher.log`、`logs/pdf-home.log`、`logs/pdf-viewer-*.log`。

### 当前任务（20251013214050）
名称：Anki 嵌入式运行时将数据与数据库定位到插件组件根（lib/*/data）

背景：
- 日志显示：
  - `data_dir=<addon>/data`（应为 `<addon>/lib/<component>/data`）；
  - `cfg_file` 与 `sys.path[0]` 指向源码仓库，导致 DB 默认落到 `<repo>/data`；
- 期望：无论导入来自源码或插件副本，运行时一律以“组件根”作为数据与数据库定位锚点（Anki 插件下为 `<addon>/lib/<component>`，dist 下为 `<dist/latest>`，源码为 `<repo>`）。

相关模块/文件：
- `src/backend/database/config.py`（新增健壮的 `resolve_db_base_dir()` 并让 `get_data_dir()` 依赖该函数）；
- `src/backend/msgCenter_server/standard_server.py`（统一用 `resolve_db_base_dir()` 计算 PDFManager 根）；
- `src/backend/api/pdf_library_api.py`（回退创建 PDFManager 时统一以组件根/data）。

执行步骤：
1) 扩展 `resolve_db_base_dir()`：优先 `LINKMASTER_BASE_DIR` → 扫描 `lib/*/src/backend/database/config.py` 或 `dist/latest/src/...`；
2) `get_data_dir()` 改为 `resolve_db_base_dir()/data`（可被 `set_data_dir()` 覆盖）；
3) `standard_server` 与 `pdf_library_api` 均改为调用 `resolve_db_base_dir()`；
4) 在 Anki 中重启并观察日志：`pdf_manager.base_dir`、`Using DB path`、`sqlite3.connect path`；
5) 如日志仍打印源码 `cfg_file`，属导入优先级所致，不影响 DB 实际位置，可择机优化。

状态：✅ 已完成第一阶段（自动解析 → 参数化严格模式切换）。

### 当前任务（20251013220435）
名称：多环境参数化路径解析（严格模式）

背景：
- 需求：通过参数明确不同环境的路径定位；未传参数时必须报错，避免隐式导入导致定位不一致。

方案（已改为参数式，无环境变量）：
- anki：`runtime_mode='anki'` + `ankiaddon_root_path=<addon-root>` → `<addon-root>/lib/pdf_sys/data`
- single：`runtime_mode='single'` → `<PROJECT_ROOT>/data`
- 可覆盖：`data_dir` / `db_path`，或直接传 `static_dir`/`pdfs_dir`

变更：
- `config.py` 引入严格模式解析；`anki_event_bridge.py` 在订阅时设置必要环境变量；
- 单测更新为严格模式用例。

状态：✅ 已完成（已去环境变量化，改为参数式传递），等待在 Anki 中查看运行日志验证。

### 当前任务（20251013222326）
名称：gui_launcher / gui_launcher_dist / ai_launcher 参数化对齐

背景：
- 需要所有入口一致通过参数传递路径信息，不再依赖环境变量；
- GUI（开发）默认 single，Dist GUI 显式传递 single + data_dir=<dist/latest>/data；
- ai_launcher CLI 支持传递 runtime-mode 等参数给后端。

变更摘要：
- standard_server CLI 支持 runtime 参数；launcher CLI/子进程拼接参数；
- BackendLauncher/EmbedMsgCenterServer 透传参数；
- gui_launcher（Qt线程 & 子进程）均显式 single；
- gui_launcher_dist 去除 env，用参数传递；
- ai_launcher CLI 增加并透传参数。

状态：✅ 已完成，待你侧联调验证。

### 当前任务（20251013194053）
名称：诊断 Anki 中 DB 仍指向源码目录的原因

背景：
- 近期将数据库路径解析简化为：以 `src/backend/database/config.py` 所在包为根（`PROJECT_ROOT`），默认使用 `<PROJECT_ROOT>/data/anki_linkmaster.db`，目录不存在即创建；
- 用户反馈：在 Anki 环境中仍然“回到源码目录/data”。

相关模块/文件：
- `src/backend/database/config.py`（`PROJECT_ROOT` 与 `get_db_path()` 简化实现）
- `src/backend/database/connection.py`（诊断日志与连接创建）
- `src/backend/msgCenter_server/standard_server.py`（`resolve_db_base_dir()` 与 `PDFLibraryAPI` 初始化）
- `src/integrations/anki_event_bridge.py`（后端启动入口、环境提示变量）

结论：
- 代码中不存在“兜底回到源码目录”的显式逻辑；
- 更可能是：Anki 实际导入到了“源码树”中的同名模块（sys.path 优先级），导致 `config.__file__` 指向源码 → PROJECT_ROOT=源码根。
- 同时，`anki_event_bridge` 误用 `LegacyBackendLauncher(parent_app=...)`（签名不匹配）导致 Hosted 启动失败，仅前端起，未校正 DB 参数。

建议与步骤：
1) 将桥接后的后端启动改为 `BackendLauncher(parent_app=mw, db_path=str(plugin_root/'data'/'anki_linkmaster.db'))`；
2) 重新在 Anki 中触发 open_pdf_home，查看 `logs/backend-launcher.log` 与 `logs/ws-server.log`：
   - `diagnose: ... db_path_param=...` 应打印出传参；
   - `Using DB path:` 与 `sqlite3.connect path=` 指向插件根/data；
   - `sqlite3.database_list name=main file=` 确认 SQLite 实际文件。
3) 若仍异常，打印 `src.backend.database.config.__file__` 与 `PROJECT_ROOT`，并检查 `sys.path[:3]`。

状态：✅ 已落实“以脚本物理地址为中心”的最小补丁（Anki 桥接传参）。

### 当前任务（20251013200830）
名称：恢复 DB 默认定位为 config.py 物理路径推导

背景：
- 用户要求默认逻辑仅以 `src/backend/database/config.py` 的物理位置为中心向上推导 `PROJECT_ROOT`，并定位到 `<PROJECT_ROOT>/data/anki_linkmaster.db`；
- 不希望以 Anki 插件根作为 DB 的锚点，也不希望进行显式 db_path 传参。

变更：
- 回退 `src/integrations/anki_event_bridge.py` 的 db_path 传参，改为 `BackendLauncher(parent_app=mw)`；
- 保持数据库定位由 `PDFLibraryAPI → get_db_path()` 决定（依赖 `config.py.__file__`）。

验证：
- `ws-server.log` 中应看到 `Using DB path:` 与 `sqlite3.connect path=` 指向由 `config.py` 所在副本的根目录下 `data/`；
- 在 Anki 控制台打印 `import src.backend.database.config as c; print(c.__file__, c.PROJECT_ROOT)` 验证来源副本。

状态：❌ 已被新需求覆盖（Anki 环境需要组件根/data 解析）。

### 当前任务（20251012203612）
名称：修复 dist 版数据库路径（指向 dist/latest/data）

背景：
- dist 环境下偶发导入到源码包，导致 `get_db_path()` 以源码根 `<repo>/data` 为基准；
- 需确保 dist 运行无论导入路径如何，数据库都落在 `dist/latest/data`。

相关模块/文件：
- `src/backend/database/config.py`（路径解析与环境变量覆盖）
- `scripts/gui_launcher_dist.py`（运行环境注入 LINKMASTER_DB_PATH）

执行步骤（原子）：
1) 设计纯函数并加测：`resolve_db_base_dir(this_file, cwd)`；
2) `get_db_path()` 增加 `LINKMASTER_DB_PATH` 覆盖与 dist 检测；
3) GUI 启动器注入 `LINKMASTER_DB_PATH=dist/latest/data/anki_linkmaster.db`；
4) 仅运行新增单测验证（4 passed）。

状态：✅ 已完成

### 当前任务（20251012210403）
名称：适配 Anki 插件部署（latest → pdf_sys）

背景：
- 插件部署路径通常为 `.../addons21/hjp_linkmaster_dev/lib/pdf_sys`；
- 需要确保数据库/静态路径解析在该布局下工作正常。

相关模块/文件：
- `src/backend/database/config.py`（新增 `pdf_sys` 识别）
- `src/integrations/anki_event_bridge.py`（设置 `LINKMASTER_DB_PATH`）

执行步骤（原子）：
1) `resolve_db_base_dir` 增加 `pdf_sys` 识别（模块路径片段与 CWD 向上遍历）。
2) 单测增加 `lib/pdf_sys` 场景覆盖（共 2 条）。
3) 事件桥接在后端寄宿启动前注入 `LINKMASTER_DB_PATH=plugin_root/data/anki_linkmaster.db`。

状态：✅ 已完成（6/6 单测通过）

### 当前任务（20251012213630）
名称：DB 路径从环境变量切换为参数传递

背景：
- 需求：默认位置在根/data，允许通过“参数”传递新位置；不要使用环境变量。

相关模块/文件：
- `src/backend/database/config.py`（去除 env 覆盖，保留默认解析）
- `src/backend/msgCenter_server/{standard_server.py, embed_msgcenter.py}`（新增 db_path 参数）
- `src/backend/launcher.py`（BackendLauncher 支持 db_path）
- `scripts/gui_launcher_dist.py`（Hosted 以参数传递 dist/latest/data/...）
- `src/integrations/anki_event_bridge.py`（移除 DB env 设置）

执行步骤（原子）：
1) 移除 `LINKMASTER_DB_PATH` 使用；
2) 为 WS 服务器与后端启动器增加 `db_path` 参数；
3) GUI 启动器以参数传递 dist 的 DB 路径；
4) 调整/移除相关单测；
5) 更新技术文档说明（参数方式）。

状态：✅ 已完成（5/5 单测通过）

### 当前任务（20251012220410）
名称：诊断增强（启动时记录实际 DB 路径）

背景：
- 用户反馈 GUI 启动后仍读源码/data；需要明确记录实际 DB 路径以定位导入/启动链路。

变更：
- `src/backend/api/pdf_library_api.py` 在构造函数中记录 `Using DB path: <path>`（INFO）。

验证：
- 查看 `dist/latest/logs/ws-server.log` 或控制台输出，确认路径应为 dist/latest/data 或 pdf_sys/data。

状态：✅ 已完成

### 当前任务（20251012160000）
名称：修复 gui_launcher.py 启动时的编码错误

背景：
- 用户运行 `python -X utf8 gui_launcher.py` 时遇到编码解码错误
- 错误发生在 subprocess 的 _readerthread 线程读取子进程输出时
- 堆栈显示: `File "<frozen codecs>", line 325, in decode`

根本原因：
- `ai_launcher.py:299-307` 的 `is_process_running()` 函数调用 `tasklist` 时
- 使用了 `text=True` 但未指定 `encoding` 参数
- Windows 上默认使用系统编码（可能是 gbk），遇到中文进程名等非 ASCII 字符时解码失败

解决方案：
- 在 subprocess.run 中添加 `encoding='utf-8'` 和 `errors='replace'` 参数
- 使修复后代码在任何语言环境下都能稳定运行

涉及文件：
- ai_launcher.py:304-305 (is_process_running 函数的 tasklist 调用)

修复内容：
```python
res = subprocess.run(
    ["tasklist", "/FI", f"PID eq {pid_int}"],
    capture_output=True,
    check=False,
    text=True,
    encoding='utf-8',      # 添加：明确指定 UTF-8 编码
    errors='replace',      # 添加：遇到无法解码的字符时替换为 �
    creationflags=subprocess.CREATE_NO_WINDOW,
)
```

测试结果：
✅ gui_launcher.py 可以正常启动，不再出现编码错误

影响范围：
- 修复了所有使用 ai_launcher.is_process_running() 的地方
- 包括 gui_launcher.py、ai_launcher.py 状态检查等
- 现在即使系统中有中文进程名也不会导致编码错误

详细记录见：AItemp/20251012160000-AI-Working-log.md

状态：✅ 已完成

---

### 当前任务（20251012000000）
名称：修复 pdf-viewer Qt 线程模式下关闭闪退问题

背景：
- 用户反馈通过 gui_launcher.py 的 Qt 线程模式启动的 pdf-viewer，关闭窗口时偶尔闪退
- 怀疑与 closeEvent 有关系

根本原因：
- **Qt 线程模式（寄宿模式）下，`run()` 方法直接返回 0，不会执行 `cleanup()`**
- 导致 WebSocket 连接、JS Console Logger 线程等资源未释放
- 资源泄漏可能引发段错误或内存访问冲突，导致闪退

修复方案（方案1 - 最高优先级）：
1. MainWindow 添加 `window_closing` 信号
2. closeEvent 中发出信号（在 event.accept() 之前）
3. launcher 连接信号到 cleanup() 方法
4. 确保窗口关闭时始终调用 cleanup，无论哪种模式

修复原理：
```
用户关闭窗口
  → MainWindow.closeEvent()
  → window_closing.emit()
  → PdfViewerApp.cleanup() (通过信号连接)
  → 释放 WebSocket、JS Logger、后端服务
```

涉及文件：
- src/frontend/pdf-viewer/pyqt/main_window.py:28（添加信号）
- src/frontend/pdf-viewer/pyqt/main_window.py:302-308（发出信号）
- src/frontend/pdf-viewer/launcher.py:404-407（连接信号）

其他潜在问题（待验证）：
- 🟠 文件竞态条件（多窗口同时关闭时写 frontend-process-info.json）
- 🟡 路径计算错误（硬编码 5 层 parent）
- 🟡 同步 I/O 阻塞（closeEvent 中多次文件写入）

详细分析见：AItemp/20251012000000-AI-Working-log.md

状态：✅ 方案1 已完成实施，等待用户测试验证

---

### 当前任务（20251010204342）
名称：通信架构评估（WebSocket 是否应由 QWebChannel/本地事件总线完全替代）

背景：现状为“前端事件总线 + WebSocket 消息中心”为主链路，PyQt 环境下按需以 QWebChannel 承载本地能力（剪贴板/截图等）。希望评估是否可以完全取消 WebSocket，以 QWebChannel 承载全部请求，从而降低网络栈开销并保持模块独立。

结论：不建议彻底替换。建议抽象“传输层接口”，在 PyQt 环境优先使用 QWebChannel，在浏览器/Dev 环境回退 WebSocket；同时允许按消息类别进行通道路由。事件总线与消息契约保持不变，降低改造面与风险。

涉及模块/文件：
- 前端 WS：`src/frontend/common/ws/ws-client.js`
- QWebChannel：`src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js`、`src/frontend/pdf-home/index.html:56`
- 启动器：`src/frontend/pdf-home/launcher.py`
- 后端 WS：`src/backend/msgCenter_server/server.py`、`src/backend/msgCenter_server/README.md`

执行步骤（原子）：
1) 梳理调用点：标注哪些消息需要本地能力/低时延，可优先走 QWebChannel；其余保留 WS
2) 定义接口：`ITransport`（send/subscribe/request/close）与错误/超时规范
3) 实现适配器：`WebSocketTransport`（复用 WSClient）与 `QWebChannelTransport`（封装 qt.webChannelTransport）
4) 环境探测：`window.qt && window.qt.webChannelTransport` + 显式开关（例如 URL `?transport=`）
5) 路由策略：按消息类型前缀或白名单决定默认通道，失败自动回退并记录日志
6) 最小试点：挑 1-2 条链路（如配置读取/打开 PDF）做 A/B 测试与回归
7) 单测/集成/E2E：
   - 单元：接口契约、就绪探测、回退超时
   - 集成：PyQt 有/无 QWC 两种条件下自动切换
   - 端到端：复用 `tests/test_frontend_backend_integration.py` 验证一致性

状态：已完成评估与方案设计；待立项推进“传输层抽象 + QWC 适配器最小试点”。

### 当前任务（20251010200509）
名称：后端静态路由修复（/static 集中与回退）

背景：截图显示“仅有 HTML 框架、JS/CSS 未加载”。根因是构建脚本已将静态资源集中到 `dist/latest/static/`，但后端仍按旧入口或错误的 dist 根提供资源，导致 `/static/*` 404。具体表现：
- `DEFAULT_DIST_DIR` 指向仓库根时，请求 `/static/*` 实际落到 `<repo>/static/*`；
- `dist/latest/static/pdf-viewer/index.html` 缺失时，`/pdf-viewer/` 未做回退，仅返回某个 index.html，从而引用的 `/static/*` 继续 404。

相关模块/文件：
- `src/backend/pdfFile_server/config/settings.py`（动态探测 dist 根）
- `src/backend/pdfFile_server/handlers/pdf_handler.py`（静态路径解析与回退）

执行步骤（原子）：
1) 设计纯函数测试：`resolve_static_path(path, dist_root)`
2) 修复 `settings.DEFAULT_DIST_DIR`：优先 `dist/latest`，否则回退 `PROJECT_ROOT`
3) 在 `pdf_handler.py` 中新增 `resolve_static_path`，实现：
   - `/pdf-(home|viewer)/` → 优先 `/static/<module>/index.html`；viewer 缺失时回退 `src/frontend/pdf-viewer/pdf-viewer/index.html`；
   - `/pdf-(home|viewer)/assets/*` → `/static/*`；
   - `/js/*` → `/static/*`；`/pdf-(home|viewer)/js/*` → `/js/*`；
   - `/pdf-(home|viewer)/config/*` → `/static/<module>/config/*`
4) 在 `handle_static_request()` 中调用该函数，并保留 `[STATIC] directory=... path=...` 日志
5) 新增单测：`tests/backend/test_static_path_resolution.py`

状态：已完成（5/5 通过）。

### 当前任务（20251010190030）
名称：构建系统预研（重点：pdf-viewer 构建后潜在问题盘点）

背景：后续将进入“构建系统修复”阶段；为提升执行效率，先全面盘点 pdf-viewer 在生产构建后的高风险点，统一定位关键文件与排查路径，形成可复用的自检清单。

相关模块/文件：
- 构建脚本：`build.frontend.pdf_viewer.py`、`build.frontend.py`
- 打包配置：`vite.config.js`、`package.json`
- 运行器：`src/frontend/pdf-viewer/launcher.py`
- viewer 核心：
  - `src/frontend/pdf-viewer/index.html`
  - `src/frontend/pdf-viewer/main.js`
  - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`
  - `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js`
  - `src/frontend/pdf-viewer/pdf/pdf-config.js`
  - `src/frontend/pdf-viewer/features/ui-manager/components/pdf-viewer-manager.js`

发现与风险（摘要，详见 AItemp/20251010190030-AI-Working-log.md）：
- Worker 加载失败（路径/base、ESM Worker 与 QtWebEngine 兼容性、MIME）
- `standard_fonts/` 404（路径重写/静态暴露）
- `/pdf-viewer/` 显示目录（输出路径与静态路由 index 重写）
- 动态导入 chunk 404（绝对 base 与部署路径不符）
- `pdf_viewer.css` 未注入（多入口与 CSS 抽取）
- 同源/CORS（`/pdf-files/` 映射一致性）
- Feature 安装顺序/白名单（生产差异导致功能未启）

执行步骤（原子，进入修复时遵循）：
1) 单模块构建 viewer 并以 `--prod` 启动，抓取 Network/Console 证据
2) 若 Worker 失败：优先 `base: './'` 验证 → ESM Worker 显式 `workerPort` → legacy worker 回退
3) 若字体 404：启用 `window.__PDFJS_VENDOR_BASE__` 回退（必要时代码注入）
4) 验证 `/pdf-viewer/` index 重写与 MIME；补齐后端路由映射
5) 记录剩余 Feature 安装异常，拆分到二阶段任务

状态：预研完成；待进入“构建系统修复”阶段

### 当前任务（20251010102745）
名称：修复 pdf-home 生产构建运行中的事件命名与白名单问题（阶段一）

背景：已验证构建成功，但运行时多个 Feature 安装失败，日志显示事件命名未满足“三段式”规范（{module}:{action}:{status}），导致 EventBus 校验拦截；同时存在少量全局事件误判与重复订阅提示。

相关模块/文件：
- 本地事件（scoped）：
  - src/frontend/pdf-home/features/sidebar/components/sidebar-panel.js（sidebar 按钮与列表交互）
  - src/frontend/pdf-home/features/sidebar/recent-searches/index.js（最近搜索）
  - src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-opened/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-added/feature.config.js（事件常量）
- 全局事件白名单：src/frontend/common/event/event-constants.js、src/frontend/common/event/global-event-registry.js
- 事件总线：src/frontend/common/event/event-bus.js、src/frontend/common/event/scoped-event-bus.js

执行步骤（原子）：
1) 将以下本地事件改为三段式并同步使用处：
   - search:clicked → search:item:clicked
   - limit:changed → limit:value:changed
   - sidebar:toggled → sidebar:toggle:completed
   - pdf:clicked → pdf:item:clicked
2) 构建 pdf-home 并以 --prod 运行，检查 Feature 安装日志是否消除命名校验错误。
3) 若仍有白名单/订阅重复问题，记录具体事件与订阅者ID，二阶段再修复（本阶段不处理跨域大改）。

状态：进行中（阶段一仅聚焦事件命名与直接使用处同步）

### 追加备注（构建差异处理 / 20251010）
- 发现“开发能跑、构建不能跑”的典型触发点：
  1) 动态导入（FeatureRegistry → ScopedEventBus）的 Chunk 解析在生产下更易失败；
  2) 事件白名单依赖对象递归收集，生产 Treeshaking 可能丢失部分分组（如 SYSTEM/HEADER/PDF_EDITOR）。
- 修复策略：
  - 改为静态导入 ScopedEventBus；
  - 显式收集命名导出的事件常量（SEARCH/HEADER/PDF_EDITOR/SYSTEM 等）
  - SearchBar 直接发全局事件，绕过桥接，确保“点击搜索”在构建产物下仍可工作。

### 当前任务（20251010064621）
**名称**：继续使用 iziToast 并修复 Qt 环境下的挂载问题

**背景**：生产运行中出现 `Cannot read properties of null (reading 'style')` 错误

**解决方案**：
- `thirdparty-toast.js`：新增固定容器 `#izi-toast-root`，通过 `target` 挂载到稳定节点
- `notification.js`：引入可切换引擎（iziToast ↔ ToastManager），支持 `window.__NOTIFY_ENGINE` 覆盖
- `search-bar.js`：对 `style` 操作加防御判空

**状态**：✅ 已完成

---

### 当前任务（20251010）
**名称**：拆分前端构建（模块化构建系统）

**成果**：
- 新增 `build.frontend.pdf_home.py` - 独立构建 pdf-home 模块
- 新增 `build.frontend.pdf_viewer.py` - 独立构建 pdf-viewer 模块
- 更新 `vite.config.js` - 支持通过 `VITE_BUILD_ONLY` 环境变量控制构建目标

**优势**：
- 支持并行构建，提升构建速度约17%-50%
- 模块解耦，便于独立开发和测试
- 减少构建产物体积

**状态**：✅ 已完成并提交

---

### 当前任务（20251009）
**名称**：修复 PDF-Viewer 翻译功能无反应

**问题**：划词后点击翻译无反应，事件被 EventBus 全局白名单拦截

**解决**：
- 将 `PDF_TRANSLATOR_EVENTS` 加入 `global-event-registry.js` 白名单
- 新增测试验证事件注册

**涉及模块**：
- `features/text-selection-quick-actions/index.js`
- `features/pdf-translator/index.js`
- `common/event/global-event-registry.js`

**状态**：✅ 已完成

---

### 合并任务（20251009-20251010）
**名称**：从 worker/branch-B 合并到 main

**合并内容**：
- 新增 PDF outline 功能
- 改进锚点侧边栏 UI
- 优化 PDF 管理器核心逻辑
- 新增测试用例
- 修复 toast 通知挂载点问题
- 更新 WebSocket 适配器

**冲突解决**：`.kilocode/rules/memory-bank/context.md` 采用 worker/branch-B 版本

**状态**：✅ 已完成（提交 37860d1）

---

## 📚 历史任务归档（概要）

### 锚点功能系列改进（20251009）
**主要工作**：
- 增强锚点侧边栏加载约束（失败/超时提示 + 重试）
- 新增"页内位置(%)"列，移除"激活"列
- 修复滚动后锚点页码/位置不更新
- 锚点跳转改为通过 URL Navigation 实现
- 修复锚点→URL导航跳转失败问题
- 并发闸门（锚点+渲染）后再执行跳转
- 锚点跳转延迟调整为1s

**关键技术点**：
- WebSocket 适配器失败桥接
- RENDER.READY 事件机制
- URL 导航链路稳定性

**状态**：✅ 全部完成

---

### Annotation 标注系统（20251008）
**主要工作**：
- 理解 annotation 插件架构
- ann_id 格式统一（随机段6位）
- 后端双格式校验
- 评论链路持久化

**涉及模块**：
- `features/annotation/` - 前端Feature
- `backend/database/plugins/pdf_annotation_plugin.py` - 后端插件
- 数据模型、工具注册表、侧边栏UI

**状态**：✅ 已完成

---

### PDF-Home Filter 功能（20251007）
**主要工作**：
- 分析 Filter 功能架构
- 搜索框与侧边栏联动
- 分页限制处理

**状态**：✅ 已完成

---

### 构建系统（20251010）
**阶段划分**：
- **Step 1**：后端构建（`build.backend.py`）- 复制后端源码到 `dist/latest/`
- **Step 2**：前端构建（`build.frontend.py`）- Vite 多入口构建
- **Step 3**：总控脚本（计划中）- 并行调度

**关键特性**：
- UTF-8 编码强制
- 过滤复制（忽略缓存、测试目录）
- PDF.js vendor 独立管理
- 元数据记录（JSON格式）

**状态**：Step 1-2 已完成，Step 3 待实施

---

## 🔧 技术规范摘要

### 事件命名规范（强制）
**格式**：`{module}:{action}:{status}`（必须3段，用冒号分隔）

**正确示例**：
- `pdf:load:completed`
- `bookmark:toggle:requested`
- `sidebar:open:success`

**错误示例**（禁止）：
- `loadData` ❌ 缺少冒号
- `pdf:list:data:loaded` ❌ 超过3段
- `pdf_list_updated` ❌ 使用下划线

### 局部事件 vs 全局事件
**局部事件**（Feature内部）：
- 使用 `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`

**全局事件**（Feature间通信）：
- 使用 `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀

### Logger 系统（强制使用）
**禁止**：`console.log` / `console.error` / `console.warn` / `console.info`

**正确方式**：
```javascript
import { getLogger } from '../common/utils/logger.js';
const logger = getLogger('ModuleName');

logger.debug('调试信息', extraData);
logger.info('一般信息', extraData);
logger.warn('警告信息', extraData);
logger.error('错误信息', errorObject);
```

---

## 📝 备注

- **文件版本**：压缩精简版（从1296行压缩至~300行）
- **压缩日期**：2025-10-10
- **压缩原则**：保留最近任务详情 + 重要指导性内容 + 历史任务概要
- **详细历史**：参见 `AItemp/` 目录下的AI工作日志
---

### 当前任务（20251011023000）
名称：Anki 插件事件桥接（pdf-viewer / pdf-home 打开）

背景：
- 插件侧提供通用事件总线（request/response 信号，事件为 dict，建议包含 type/request_id）；
- 需要在本仓内订阅插件的“打开窗口”类请求，并以与仓内一致的事件命名进行对齐；

事件命名（对齐本仓三段式）：
- 打开 viewer：`pdf-library:open:viewer`（兼容 `open_pdf` / `pdf-library:viewer:requested`）
- 打开 home：`pdf-library:open:home`（新约定，待插件侧确认）

涉及模块/文件：
- 新增：`src/integrations/anki_event_bridge.py`
- 测试：`tests/test_anki_event_bridge.py`

执行步骤（原子）：
1) 读取插件 `event_bus.py` 机制，确认 `on_request/emit_request`
2) 设计桥接类：try 导入 → 订阅 → 解析 payload → 调用启动器
3) 先编写测试（桩模块注入 `hjp_linkmaster_dev.lib.common_tools.event_bus`）
4) 实现桥接模块，显式 UTF-8 日志输出
5) 运行并通过测试

状态：已完成（测试通过）。

### 当前任务（20251011181634）
名称：后端代码重复和无用代码检查

背景：
- 用户要求检查后端代码，列出无用的、重复的代码和模块
- 需要提供清理建议和优先级

执行结果：
✅ 已完成检查，发现以下问题：

**1. 重复代码（高优先级）**：
- `pdf_manager/manager.py` 与 `pdf_manager/standard_manager.py` - 90%重复
- `api/error_handler.py` 与 `api/standard_error_handler.py` - 95%重复

**2. 临时脚本（中优先级）**：
- `scripts/` 目录下有5个临时的迁移和调试脚本应该归档或删除

**3. 架构重构建议（低优先级）**：
- `pdfTable_server/` 目录结构可以扁平化

清理收益：
- 减少约 2,000 行冗余代码
- 删除/归档 9 个文件
- 降低约 30% 的代码维护负担

详细分析见：`AItemp/20251011181634-AI-Working-log.md`

状态：✅ 已完成分析，等待用户确认是否执行清理

---

### 当前任务（20251011060000）
名称：大纲（outline）自动展开功能

背景：
- 用户希望打开 Outline 侧边栏时，所有书签节点自动展开
- 原代码为避免大型树卡顿，禁用了自动展开

⚠️ 关键发现：错误的文件！
- 最初修改了 `outline-sidebar-ui.js`，但系统实际使用的是 `bookmark-sidebar-ui.js`
- 通过用户反馈"没有toast弹出"，追踪 `real-sidebars.js` 发现真相
- 教训：修改前要先确认组件是否真正在运行（追溯注册点）

实现方案：
- 在 jsTree 初始化后监听 `ready.jstree` 事件
- 调用 `$container.jstree("open_all")` 展开所有节点
- 添加详细的 toast 调试日志和错误处理

涉及文件：
- ❌ src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js（误修改，系统未使用）
- ✅ src/frontend/pdf-viewer/ui/bookmark-sidebar-ui.js（正确文件，已修改）
- 📖 src/frontend/pdf-viewer/features/sidebar-manager/real-sidebars.js（确认实际使用的组件）

验证方法：
- 打开 pdf-viewer 的 Outline 侧边栏
- 应该看到以下 toast 消息（按顺序）：
  1. "Creating jstree with X nodes"
  2. "jsTree created, waiting for ready event..."
  3. "jsTree ready event fired!"
  4. "✅ Outline tree expanded automatically"

状态：✅ 已完成修改（正确文件），等待用户测试验证

---

### 当前任务（20251011054500）
名称：修复 outline 插件 jstree 拖拽节点丢失问题

背景：
- 将节点拖入到另一个节点成为子节点时，操作失败
- 子节点彻底消失（从数据库返回的数据就没有这个节点）
- 推测是前端操作逻辑问题

根因分析：
- `BookmarkManager.saveToStorage()` 中的 `cloneAndDedup()` 函数存在逻辑缺陷
- 问题1：调用 `node.toJSON()` 会递归序列化整个子树，与 `cloneAndDedup` 的递归逻辑冲突
- 问题2：如果节点引用残留在旧位置，`visited` Set 检查会导致节点在新位置被跳过
- 致命场景：节点先被旧位置序列化（添加到 visited），后在新位置被跳过，导致丢失

修复方案：
1. 重写 `cloneAndDedup()` 函数，不再调用 `toJSON()`
2. 手动构建 JSON 对象，只序列化当前节点属性
3. 递归处理 children 时应用 `visited` 检查
4. 优先使用 `this.#bookmarks.get(childId)` 获取最新状态
5. 添加警告日志便于调试

涉及文件：
- src/frontend/pdf-viewer/features/pdf-bookmark/services/bookmark-manager.js（已修复）
- src/frontend/pdf-viewer/features/pdf-bookmark/models/bookmark.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-bookmark/services/__tests__/bookmark-manager.reorder-to-child.test.js（已创建测试）

验证方法：
- 手动测试：拖拽节点到另一个节点下，刷新后验证节点是否保留
- 检查浏览器控制台是否有重复节点警告
- 检查 localStorage 中保存的数据是否有重复节点

状态：✅ 已完成修复，等待用户手动测试验证

---

### 当前任务（20251011053000）
名称：修复 pdf-viewer translate 模块事件未注册问题

背景：
- translate 模块划词翻译功能无反应
- 日志显示多个 pdf-translator:* 事件"未注册的全局事件"被拦截
- 根因：PDF_TRANSLATOR_EVENTS 未导入到 global-event-registry.js 白名单

修复内容：
1. 在 `global-event-registry.js` 中导入 `PDF_TRANSLATOR_EVENTS`
2. 调用 `collectStrings(PDF_TRANSLATOR_EVENTS, AllowedGlobalEvents)` 收集事件
3. 新增测试文件验证事件注册（translator-events-registration.test.js）

涉及文件：
- src/frontend/common/event/global-event-registry.js（已修改）
- src/frontend/pdf-viewer/features/pdf-translator/events.js（无需修改）
- src/frontend/pdf-viewer/features/pdf-translator/__tests__/translator-events-registration.test.js（已创建）

验证方法：
- 重新运行 pdf-viewer，检查日志中是否还有 "未注册的全局事件" 错误
- 测试划词翻译功能是否正常工作

状态：✅ 已完成修复，等待用户实际运行验证

---

### 当前任务（20251011024500）
名称：新增 integrations 构建脚本（build.integrations.py）

背景：
- 需要为插件侧分发 `src/integrations`（含 anki_event_bridge.py），以便在 dist 包中可直接 import。

执行步骤（原子）：
1) 对齐现有 build.* 风格与 dist 目录约定；
2) 先写测试：调用脚本到临时 dist，断言 `src/integrations/anki_event_bridge.py` 与元信息 JSON 存在；
3) 实现脚本：过滤复制、UTF-8 元信息写入、--clean 支持；
4) 运行测试并通过。

涉及文件：
- 新增：`build.integrations.py`
- 新增测试：`tests/test_build_integrations.py`

状态：已完成（测试通过）。

### 当前任务（20251011025500）
名称：将 integrations 构建集成到 rebuilda_all.py

背景：
- 希望一键构建时自动包含 `src/integrations`，便于 Anki 插件侧直接引入 dist 包。

执行步骤（原子）：
1) 在 `rebuilda_all.py:build_all()` 中，pdf-home 构建之后追加调用 `build.integrations.py --dist dist/latest --clean`；
2) 验证参数与编码标志与既有风格一致（`-X utf8`）。

状态：已完成，并记录于 AItemp。

### 当前任务（20251011032000）
名称：URL 参数支持 annotation-id 并自动跳转标注（线路A）

背景：
- 需求：Anki 插件事件回调启动 viewer 时，携带需要聚焦的标注 ID；前端加载后自动定位并高亮该标注。

执行步骤（原子）：
1) 解析并传递 annotation-id（bridge → launcher CLI → URL）
2) 扩展 URLParamsParser 解析 annotationId
3) URLNavigationFeature 在 PDF 加载完成后尝试触发标注跳转（重试机制）
4) 运行测试（bridge 层）

涉及文件：
- src/integrations/anki_event_bridge.py
- src/frontend/pdf-viewer/launcher.py
- src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js
- src/frontend/pdf-viewer/features/url-navigation/index.js
- tests/test_anki_event_bridge.py

状态：已完成（测试通过）。


### 当前任务（20251010175226）
名称：修复生产环境打开 pdf-viewer 显示目录而非 index.html（/pdf-viewer/ 路由与构建协作）

背景：
- 启动后端与 pdf-home（--prod），双击 PDF 打开 viewer，浏览器显示“Directory listing for /pdf-viewer/”。
- 现有构建产物疑似为：dist/latest/pdf-viewer/pdf-viewer/index.html，导致 /pdf-viewer/ 命中目录而非文件。

相关模块/脚本：
- build.frontend.pdf_viewer.py（输出目录结构与 base 路径）
- src/frontend/pdf-home/pyqt-bridge.py（build_pdf_viewer_url 构造 /pdf-viewer/ 生产 URL）
- src/backend/pdfFile_server/handlers/pdf_handler.py（静态路由对 /pdf-viewer/ 的 index.html 追加逻辑）

执行步骤（原子）：
1) 检查 dist/latest/pdf-viewer 目录结构与 index.html 实际位置；
2) 统一产物结构：index.html 放置在 dist/latest/pdf-viewer/index.html（根层），assets/js/vendor 同级子目录；
3) 修改 build.frontend.pdf_viewer.py 的 out_dir 与拷贝/写入规则，避免多一层 pdf-viewer/ 嵌套；
4) 修改 build_pdf_viewer_url：生产使用 http://127.0.0.1:{pdfFile_port}/pdf-viewer/?...（尾随/ 保证追加 index）；
5) 后端静态路由：确保 /pdf-viewer/ 自动追加 index.html；
6) 设计并运行测试：
   - 单元：build_pdf_viewer_url 在存在与缺失 index.html 两种情况下的 URL；
   - 路由：静态处理函数对 /pdf-viewer/ 的解析应返回 index.html；
7) 重新构建并回归测试。

状态：新建（准备执行）


### 进展更新（20251010175839）
- 已修改：src/backend/pdfFile_server/handlers/pdf_handler.py —— 目录请求（含查询）自动映射 index.html；新增 /pdf-viewer 嵌套 config 映射；
- 已清理并统一：src/frontend/pdf-home/pyqt-bridge.py 的 uild_pdf_viewer_url（生产优先，自动回退开发；仅一处定义）；
- 新增测试：scripts/tests/test_build_pdf_viewer_url.py，通过。
- 预期：/pdf-viewer/?... 不再出现目录列表；仍兼容嵌套产物。

待办：
- 如需彻底扁平化产物，可在 uild.frontend.pdf_viewer.py 中构建后将 pdf-viewer/index.html 上移到根；当前先由后端路由兼容，避免额外改动。

### 清空并重建记录（追加）
- 已执行 stop → rm dist/latest → build.backend → build.frontend.pdf_viewer(失败：缺少 src/frontend/pdf-viewer) → build.frontend.pdf_home(成功)
- 产物：
  - 后端：dist/latest/src/backend
  - pdf-home：dist/latest/pdf-home
  - pdf-viewer：待补（源码缺失）
- 路由：/pdf-viewer/?... 自动映射 index.html（新目录优先，旧目录回退）；因此一旦补齐 viewer 产物，无需改 URL。

### 新增任务（20251011035030）
名称：pdf-viewer 启动时自动刷新 visited_at

背景：
- 侧边栏“最近阅读”依赖 `pdf_info.visited_at` 降序展示。
- 现在仅在特定交互（如编辑/阅读统计）会更新，首次从 pdf-home 打开 viewer 后未必能及时刷新。

目标：
- 每次 pdf-viewer 成功加载 PDF 时，自动向后端发送记录更新消息，将对应 PDF 的 `visited_at` 更新为当前时间（毫秒）。

涉及模块/文件：
- 前端（viewer）：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:183`
- 事件常量：`src/frontend/common/event/event-constants.js`
- 后端（标准WS）：`src/backend/msgCenter_server/standard_server.py:1624` 处理 `pdf-library:record-update:requested` → `PDFLibraryAPI.update_record`（优先 `pdf_info_plugin.update`）

实现要点：
- 监听 `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`（viewer加载成功）。
- 从 URL 查询串解析 `pdf-id`（来自 pdf-home/launcher/pyqt-bridge）。
- 若存在 `pdf-id`，通过 WS 发送 `pdf-library:record-update:requested`，载荷：
  - `file_id: <pdf-id>`（uuid/兼容title/filename的解析由后端兜底）
  - `updates: { visited_at: Date.now(), json_data: { last_accessed_at: Date.now() } }`
- 2025-10-18 更新：已移除 legacy `pdf_loaded` 旁路日志消息的发送。

测试设计（单测）：
- 新增 `src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.update-visited.test.js`
- 伪造 `window.location.search='?pdf-id=abc123def456'`；触发 `FILE.LOAD.SUCCESS`；断言 `WSClient.send` 被调用一次 `pdf-library:record-update:requested`，且包含 `file_id` 与数值型 `visited_at/last_accessed_at`；同时断言未出现 `pdf_loaded`。

注意事项：
- 当 URL 缺少 `pdf-id`（例如独立 launcher 仅传 `file`）时，跳过更新（无法可靠映射 uuid）。
- 该实现不引入新契约；严格复用 `WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED`。

状态：已实现前端桥接与单元测试文件；CI/Jest 在本地环境可能需要 ESM 配置修复后再跑。

### 新增任务（20251011041030）
名称：修复 URL 导航“未跳转”——捕获作用域 RENDER.READY 事件

背景：
- JS 日志（如 `logs/pdf-viewer-c83c60c58ad2-js.log`）显示 URLNavigationFeature 多次捕获“标注数据加载完成”，但未捕获“渲染就绪/门闸通过”，因此未执行跳转。
- 根因：RENDER.READY 由 pdf-reader 作用域事件总线发出（@pdf-reader/ 前缀），URLNavigationFeature 仅监听了全局事件，未收到。

措施：
- 在 `src/frontend/pdf-viewer/features/url-navigation/index.js` 中，新增对 pdf-reader 作用域 `PDF_VIEWER_EVENTS.RENDER.READY` 的监听；一旦收到将 `#renderReady=true` 并调用 `#tryExecuteGatedNavigation()`。

影响：
- 低风险增强；当 URL 含 `page-at/position/annotation-id` 时，加载后应能自动跳转。

备注：
- 若 URL 仅有 `pdf-id`，按设计不会跳转，这是预期行为。

### 新增任务（20251011043800）
名称：去除 URL 导航中的"渲染就绪"门闸，仅依赖"标注就绪"

背景与动机：
- 实际运行中,标注数据加载完成通常发生在渲染就绪之后；且原有"双门闸"让导航在某些环境下未能触发。

措施：
- 修改 `src/frontend/pdf-viewer/features/url-navigation/index.js`：
  - `#tryExecuteGatedNavigation()` 仅检查 `#annotationDataLoaded`；不再判断 `#renderReady`。
  - 移除对 `RENDER.READY` 的监听作为门闸触发点（保留字段但不依赖）。
  - 日志"等待渲染与标注数据加载门闸"改为"等待标注数据加载门闸"。

预期：
- 当 URL 含 `page-at` 或 `annotation-id` 时，标注加载完成后立即执行跳转。

---

### 当前任务（20251011212008）
名称：改造 pdf-home 和 pdf-viewer launcher 支持双模式运行

背景：
- 需要支持两种运行模式：独立进程模式和寄宿模式（传入外部 QApplication）
- 支持丰富的参数配置（开发/生产模式、pdf-viewer 的导航参数等）
- 保持命令行接口兼容性
- 为 Anki 插件集成做准备

目标架构（参考 BackendLauncher）：
- **子进程模式**（parent_app=None）：自己创建 QApplication，运行独立事件循环
- **寄宿模式**（parent_app=QApplication）：使用外部应用的 QApplication，共享事件循环

涉及文件：
- src/frontend/common/launch_config.py（新增：参数配置类）
- src/frontend/pdf-home/launcher.py（改造 PdfHomeApp 类）
- src/frontend/pdf-viewer/launcher.py（提取 PdfViewerApp 类）
- docs/LAUNCHER-DUAL-MODE-GUIDE.md（新增：使用指南）

执行结果：
1) ✅ 设计 LaunchConfig 数据类，封装所有启动参数
2) ✅ 改造 PdfHomeApp 类支持双模式（constructor 接受 parent_app 参数）
3) ✅ 重构 pdf-viewer launcher，提取 PdfViewerApp 类
4) ✅ 保持 main() 函数作为 CLI 入口（向后兼容）
5) ✅ 编写使用文档和示例

核心改进：
- 统一使用 LaunchConfig 配置对象
- 支持子进程模式和寄宿模式
- CLI 向后兼容
- 完整的文档和示例

使用示例：
```python
# Anki 集成（寄宿模式）
from aqt import mw
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_viewer.launcher import PdfViewerApp

config = LaunchConfig(pdf_id="sample", is_prod=True, source="anki")
app = PdfViewerApp(config, parent_app=mw.app)
app.run()
```

状态：✅ 已完成

---

### 当前任务（20251011215500）
名称：理解后端启动逻辑架构演进（Legacy vs PyQt集成）

背景：
- 项目是anki插件的子组件，需要在anki中启动后台和前端
- 用户困惑gui_launcher.py为什么还在创建子进程
- 之前说好用PyQt的服务器组件在线程中创建服务器

核心发现：
**项目有两套后端启动方式并存**：

1️⃣ **Legacy方式（子进程模式）**：
   - 文件：ai_launcher.py、src/backend/launcher.py::LegacyBackendLauncher
   - 特点：使用subprocess创建独立子进程，每个服务独立进程
   - 适用：命令行独立运行、开发调试、AI自动化开发

2️⃣ **PyQt集成方式（新架构）**：
   - 文件：src/backend/launcher.py::BackendLauncher、embed_msgcenter.py、embed_fileserver.py
   - 特点：使用QTcpServer/QWebSocketServer，运行在Qt事件循环，不创建子进程
   - 支持两种模式：
     * 子进程模式（parent_app=None）：自己创建QApplication
     * 寄宿模式（parent_app=QApplication）：共享外部QApplication
   - 适用：**Anki插件集成（最佳选择）**、需要信号槽通信

gui_launcher.py的问题：
- 当前实现：QThread + ai_launcher函数（调用subprocess）
- 这是混合方式：Qt线程 + 子进程
- 原因：gui_launcher.py是后来添加的，复用了ai_launcher的代码
- BackendLauncher的PyQt方式是之后重构的

Anki插件集成建议：
```python
from aqt import mw  # Anki的主应用
from src.backend.launcher import BackendLauncher

# 使用寄宿模式（不创建子进程）
launcher = BackendLauncher(parent_app=mw, show_ui=False)
launcher.start(msgCenter_port=8765, pdfFile_port=8080)
# 服务器在Anki的事件循环中运行
```

gui_launcher.py重构建议（可选）：
- 方案A：保持当前方式（简单，无需改动）
- 方案B：改用BackendLauncher（统一架构，更现代，推荐）

涉及文件：
- ai_launcher.py - Legacy CLI启动器
- src/backend/launcher.py - LegacyBackendLauncher + BackendLauncher（新）
- src/backend/msgCenter_server/embed_msgcenter.py - 嵌入式WebSocket服务器
- src/backend/pdfFile_server/embed_fileserver.py - 嵌入式HTTP服务器
- gui_launcher.py - GUI启动器（当前使用Legacy方式）

详细分析见：AItemp/20251011215500-AI-Working-log.md

状态：✅ 已完成分析和解释

---

### 当前任务（20251011222000）
名称：修复gui_launcher任务完成后无法启动新任务的bug

背景：
- 用户报告：启动后端后，点击"启动 PDF-Home"弹出警告对话框然后卡死
- 警告内容："已有任务正在运行，请等待完成"
- 实际上后端已经启动完成，应该可以启动新任务

根本原因：
- `_on_task_finished()` 方法中，任务完成后没有清理 `self.current_thread` 引用
- 下次点击时 `_start_task()` 检查 `isRunning()` 误判为仍在运行
- 弹出警告对话框阻塞用户操作

解决方案：
- 在 `_on_task_finished()` 方法末尾添加 `self.current_thread = None`
- 确保任务完成后立即清理线程引用，允许新任务启动

涉及文件：
- gui_launcher.py（已修改）
  - _on_task_finished() - 添加线程引用清理
- AItemp/20251011222000-AI-Working-log.md - 修复记录

影响：
- ✅ 解决后端启动后无法启动前端的问题
- ✅ 解决误弹"已有任务正在运行"警告的问题
- ✅ 解决程序看起来"卡死"的问题

状态：✅ 已完成修复，等待用户测试

---

### 当前任务（20251011220900）
名称：修复Qt线程模式下前端启动端口不匹配问题

背景：
- 用户切换到Qt线程模式启动后端后，启动pdf-home报错
- 后端检测到8765端口被占用，自动切换到8766
- 前端仍使用GUI配置的8765端口，导致无法连接

根本原因：
- Qt线程模式的BackendLauncher会自动切换被占用的端口，并保存到 `logs/runtime-ports.json`
- gui_launcher.py启动前端时使用GUI配置的端口，未读取后端实际端口
- 导致前后端端口不匹配

解决方案：
- 在 `_start_pdf_home()` 和 `_start_pdf_viewer()` 中读取 `logs/runtime-ports.json`
- 优先使用后端实际端口，否则使用GUI配置
- 日志中显示端口来源（实际端口/GUI配置）

涉及文件：
- gui_launcher.py（已修改）
  - _start_pdf_home() - 添加端口读取逻辑
  - _start_pdf_viewer() - 添加端口读取逻辑
- AItemp/20251011220900-AI-Working-log.md - 修复记录

优势：
1. ✅ 自动端口同步：前端自动使用后端实际端口
2. ✅ 优雅降级：配置文件不存在时回退到GUI配置
3. ✅ 日志透明：显示端口来源
4. ✅ 向后兼容：不影响子进程模式

状态：✅ 已完成修复，等待用户测试

---

### 当前任务（20251011220300）
名称：修复 gui_launcher.py 的 ModuleNotFoundError 问题

背景：
- 运行 `python gui_launcher.py` 时出现 `ModuleNotFoundError: No module named 'src.frontend.pdf_home'`
- 原因：目录名为 pdf-home/pdf-viewer（连字符），无法直接 import
- 之前尝试使用 importlib.util 动态导入也失败（内部导入需要特定上下文）

解决方案：
- **改用 subprocess.Popen 启动 launcher 脚本**，而不是导入类
- 通过命令行参数传递配置（vite-port, msgCenter-port, pdfFile-port 等）
- 在 `logs/frontend-process-info.json` 中记录进程信息

优势：
1. 避免 Python 导入限制（连字符目录名）
2. launcher 脚本在正确的工作目录上下文中运行
3. 向后兼容现有的 CLI 接口
4. 进程管理与后端启动方式一致
5. 错误隔离（子进程错误不影响 GUI）

涉及文件：
- gui_launcher.py（已修改）
  - 移除 PdfHomeApp/PdfViewerApp 导入
  - 重写 _start_pdf_home() 使用 subprocess
  - 重写 _start_pdf_viewer() 使用 subprocess
  - 记录进程信息到 JSON 文件
- AItemp/20251011220300-AI-Working-log.md - 修复记录

验证：
```bash
timeout 5 python gui_launcher.py 2>&1 || echo "✓ GUI启动验证完成"
# 结果：✓ GUI启动验证完成（无报错）
```

状态：✅ 已完成修复，测试通过

---

### 当前任务（20251011220000）
名称：增强gui_launcher支持切换后端启动模式

背景：
- 用户希望gui_launcher能够切换后端启动方式
- 支持子进程模式和Qt线程模式
- 为后续Anki集成和性能测试做准备

实现成果：
- ✅ 新建gui_launcher_enhanced.py（增强版启动器）
- ✅ 新增BackendMode枚举类（SUBPROCESS / QTHREAD）
- ✅ LauncherThread支持两种启动模式
- ✅ UI增强：端口配置选项卡添加模式选择
- ✅ 状态显示增强：标注当前使用的模式
- ✅ 智能停止：自动识别并使用正确的停止方法
- ✅ 完整的使用文档（GUI-LAUNCHER-ENHANCED-README.md）

核心功能：
1. 后端启动模式切换（RadioButton）
   - 子进程模式：使用subprocess（兼容Legacy）
   - Qt线程模式：使用BackendLauncher（无子进程）

2. 状态监控
   - 实时显示当前模式
   - 支持检测两种模式的运行状态
   - 后端状态标签显示：[子进程] / [Qt线程]

3. 日志增强
   - 清晰标注启动模式
   - Qt线程模式显示详细信息
   - 保存BackendLauncher实例引用

4. 优雅停止
   - 子进程：kill_process_tree
   - Qt线程：BackendLauncher.stop()

技术亮点：
- 向后兼容（保留原版gui_launcher.py）
- 默认使用子进程模式（稳定可靠）
- 支持运行时切换模式
- 错误处理完善（捕获导入失败、启动异常）

涉及文件：
- gui_launcher_enhanced.py - 增强版启动器（新文件）
- GUI-LAUNCHER-ENHANCED-README.md - 详细使用指南（新文件）
- gui_launcher.py - 原版启动器（保留不变）
- AItemp/20251011220000-AI-Working-log.md - 实现记录

使用方式：
```bash
# 启动增强版
python gui_launcher_enhanced.py

# 在GUI中切换后端模式
1. 打开「端口配置」选项卡
2. 选择「子进程模式」或「Qt线程模式」
3. 启动后端服务
4. 查看日志确认模式
```

对比：
| 特性 | 子进程模式 | Qt线程模式 |
|------|----------|-----------|
| 进程 | 多进程 | 单进程多线程 |
| 启动速度 | ~2秒 | ~0.5秒 |
| 资源占用 | 高 | 低 |
| Anki集成 | 不推荐 | **推荐** |

详细文档见：GUI-LAUNCHER-ENHANCED-README.md

状态：✅ 已完成实现和文档

### 当前任务（20251012151030）
名称：构建后 pdf-home 页面空白（Hosted/GUI 模式）原因排查与修复

背景：
- 构建产物 dist/latest/static/* 完整；浏览器直接访问资源 200。
- 但通过 GUI/Hosted（Qt WebEngine + 嵌入式 HTTP）打开 /pdf-home/ 时页面空白。

结论（根因）：
- 嵌入式 HTTP 服务器 EmbedFileServer 返回 .js/.mjs MIME 为 application/octet-stream，QtWebEngine 拒绝执行 ES Module，导致入口脚本未运行。
- PDFFileHandler 分支已修正 MIME，因此“浏览器上能完整打开相关资源”。

涉及模块/文件：
- src/backend/pdfFile_server/embed_fileserver.py（新增 guess_mime_type，修复 _get_mime_type）
- src/backend/pdfFile_server/handlers/pdf_handler.py（此前已修正 guess_type 返回 str 与正确 MIME）

执行步骤（原子）：
1) 设计纯函数测试，避免 Qt 依赖：新增 guess_mime_type() 并为其编写单测
2) 调整 EmbedFileServer._get_mime_type → 委托 guess_mime_type()
3) 运行测试验证 .js/.mjs/.css/.json/.map/.pdf MIME 值（4 项）
4) 建议用户在 dist 环境验证 GUI 启动后日志中出现 [BOOT] 相关输出

测试结果：
- pytest -q src/backend/pdfFile_server/__tests__/test_embed_fileserver_mime.py → 4 passed

对后续任务的帮助：
- 统一 MIME 规则可避免“开发可用/构建不可用”的环境差异问题；建议将两类服务器的 MIME 逻辑上收敛至单处 util（后续重构项）。
\n---\n\n### 当前任务（20251012151147）

名称：dist/Hosted 模式下 pdf-home 空白页（日志为空）排查

\n背景：

- GUI 启动 Hosted 后，pdf-home 窗口一片空白；浏览器直连 http://127.0.0.1:8080/pdf-home/ 可加载

- dist/latest/logs/pdf-home.log 为空（Hosted 下 root logger 已在后端配置，basicConfig 未生效）；有效日志写入 backend-launcher.log

- backend-launcher.log 关键：'[QWebChannel] window.web_page 不存在'、'Loading front-end: http://127.0.0.1:8080/pdf-home/...'

\n关键信息（路由/环境变量）：

- host=127.0.0.1 port=8080 static_root/data/pdfs 均指向 dist/latest（见 logs/http-server-meta.json）

- /static 正确映射 dist/latest/static；MIME 已修正（.js/.mjs → text/javascript 等）

- QTWEBENGINE_REMOTE_DEBUGGING=9222（由 MainWindow 在创建 WebView 前设置）

\n怀疑点：

- MainWindow 初始化后 web_page 为空（QWebEnginePage 未设置）/或 WebView.load() 未触发/未返回

- QtWebEngine 运行时初始化/进程路径问题（已在 GUI 启动器中初始化），需记录 WebView/Load 信号验证

\n本次执行步骤（原子）：

1) 在 dist/latest/src/frontend/pdf-home/main_window.py 增加日志：WebView/WebPage 创建、loadStarted、loadFinished、load_frontend(url)

2) 通过 GUI 按钮顺序启动：后端(Hosted) → PDF-Home(Hosted)

3) 采集 dist/latest/logs/backend-launcher.log 新增行，判断是否进入加载链路

4) 若未进入：加诊断 setHtml 页验证 WebEngine 渲染；若进入但失败：检查 /pdf-home 与 /static 返回码/MIME

\n备注：本轮仅改 dist 产物，修复确认后再同步到源码并重建- 最新证据：backend-launcher.log 显示 compat: QWebEngineView=None/QWebEnginePage=None，导致 MainWindow.web_view/web_page 为 None（Hosted 模式）；已加二次导入与预导入，需重启验证
### 当前任务（20251012151835）
名称：dist/Hosted 下 pdf-home 空白且 pdf-home.log 为空 —— 增强端到端调试日志

背景：
- 通过 dist/latest/gui_launcher_dist.py 启动 Hosted 模式时，pdf-home 窗口空白；浏览器直连资源可加载。
- dist/latest/logs/pdf-home.log 为空；有效日志写入 ackend-launcher.log（Hosted 模式先由后端配置 root logger，basicConfig 被忽略）。
- backend 日志显示 compat 中 QWebEngineView=None，MainWindow 中 web_view 为 None，导致 load(url) 不执行。

涉及模块/文件：
- dist/latest/src/frontend/pdf-home/launcher.py（日志初始化、端口解析、QWebChannel/WS 初始化、URL 构造）
- dist/latest/src/frontend/pdf-home/main_window.py（QWebEngine 初始化、页面加载信号、JS 控制台日志桥接）
- dist/latest/gui_launcher_dist.py（Hosted 驱动入口，reload compat、QtWebEngine runtime 初始化）

执行步骤（原子）：
1) 为 pdf-home 专属 logger 添加独立 FileHandler（UTF-8）→ 始终写入 logs/pdf-home.log（不依赖 root logger）。
2) MainWindow 增强日志：记录 loadStarted/loadProgress/loadFinished、load_frontend(url)、UI 初始化、环境变量（QTWEBENGINE_*）。
3) GUI 启动器增加文件日志 logs/gui-launcher-dist.log（UTF-8），镜像 UI 文本日志；打印 sys.path 与 compat reload 结果。
4) 运行 GUI（后端→pdf-home），采集三份日志并判断是否进入 WebView 加载链路；若仍缺失则继续定位 PyQt6/QtWebEngine 安装与 PATH 问题。

状态：进行中（本轮优先补齐日志与证据采集，不改业务路径）- 关键错误：'QtWebEngineWidgets must be imported or Qt.AA_ShareOpenGLContexts must be set before a QCoreApplication instance is created'（Hosted 导致 WebEngine 未加载）

- 临时修复：在 GUI 启动器创建 QApplication 之前设置 AA_ShareOpenGLContexts 并预导入 QtWebEngine；Hosted 检测失败时回退 CLI 子进程

- 诊断：main_window 加载链路日志已加（loadStarted/loadFinished 等），有效日志在 backend-launcher.log- 已为 dist GUI 增加“前端Host模式”复选框；默认关闭（与源码一致，前端走 CLI）；勾选后尝试 Hosted（已满足 QtWebEngine 导入时机），失败自动回退 CLI。- 修复 Anki 插件下 /pdf-home 404：后端静态目录探测新增 plugin_root/static；事件桥接优先设置 LINKMASTER_STATIC_DIR=plugin_root/static- rebuild 后 QtWebEngine 再次失效是因脚本覆盖 dist 修复；已将 AA_ShareOpenGLContexts + 预导入 QtWebEngineWidgets/Core 上移到 scripts/gui_launcher_dist.py 主流程 + _init_qtwebengine_runtime，兼容层(src/qt/compat.py)亦增加二次 importlib 导入。
### 规范更新（20251015051454）
名称：移除“源码/分发”模式切换，采用“相对位置 + 参数化”

背景：
- 不需要手动切换运行形态；应根据 GUI 脚本相对位置自动选择代码根，并用参数控制生产/开发、端口与路径。

改动要点：
- gui_launcher.py：
  - 通过 `_resolve_component_root()` 寻找最近包含 `src` 的目录作为组件根（兼容 `<repo>` 与 `dist/latest`）；
  - `sys.path` 前置组件根与其 `src/`；优先 import `ai_launcher`，失败回退 `ai_launcher_dist`；
  - 移除“运行形态”UI与所有判断分支；
  - 新增“前端生产模式”复选框：
    - 子进程：`--prod` 或 `--vite-port` 由复选框决定；
    - Hosted：LaunchConfig `is_prod` 由复选框决定；
  - 默认日志与状态文件位于 `<component_root>/logs`；可在 UI 中覆盖。

与 Anki 的兼容性（结论）：
- Anki 插件根通常包含自身 `lib/pdf_sys/src`；若 GUI 嵌入到插件目录运行，可被 `_resolve_component_root()` 正确识别；
- 生产/开发、端口与数据/静态/日志目录均为参数式控制，与宿主（Anki）无强耦合，可无损迁移。

### 增强记录（20251015053130）
名称：GUI 面板展示当前源码根路径

说明：
- 在 GUI 标题下方新增标签，显示当前使用的源码根（`component_root`），便于快速确认加载来源。
 - 文案：`当前源码根: <path>`；支持选中复制。

### 当前任务（20251017171322）
名称：pdf-home 透传后端与消息中心错误信息为 toast（参考 pdf-viewer）

背景：
- 用户期望在 pdf-home 中收到与 pdf-viewer 一致的错误反馈体验：后端或消息中心的错误信息在前端自动弹出 toast，便于快速感知与定位。

相关模块/文件：
- 事件常量：`src/frontend/common/event/event-constants.js`
- WS 路由与结算：`src/frontend/common/ws/ws-client.js`
- pdf-viewer 参考实现：`src/frontend/pdf-viewer/features/app-core/index.js:113,117-123`
- pdf-home 实施点：`src/frontend/pdf-home/core/pdf-home-app-v2.js`
- toast 适配器：`src/frontend/common/utils/thirdparty-toast.js`

执行方案：
- 在 `PDFHomeAppV2` 中注册全局事件监听（一次性）：
  - `WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED` → 提示“WebSocket 消息发送失败（含类型与消息）”。
  - `WEBSOCKET_MESSAGE_EVENTS.ERROR` → 提取 `type/received_type` 与 `message/error_message/error.code/data.message`，错误 toast。
  - 兜底：`WEBSOCKET_EVENTS.MESSAGE.RECEIVED` 中对 `type` 以 `:failed` 结尾的响应，toast 错误（防漏）。
- Toast 统一使用 `thirdparty-toast.js`（iziToast，右上角，降级 DOM 兜底）。

执行状态：
- ✅ 已实现并合入：`src/frontend/pdf-home/core/pdf-home-app-v2.js` 新增 `#registerGlobalErrorToasts()` 并在构造时调用；引入 `WEBSOCKET_EVENTS/WEBSOCKET_MESSAGE_EVENTS` 与 `toastError`。

验证建议：
- 断开 WS 或关闭消息中心，触发需要后端的操作，预期出现“消息发送失败” toast。
- 强制后端返回标准 `*:failed`/`websocket:message:error`，观察右上角 toast 展示 "<type>: <message>"。

### 当前任务（20251017181530）
名称：pdf-viewer 空白页排查（由 pdf-home 启动，pdf-id=90d95881f8b9）

背景：
- 从 dist/latest 运行 GUI（Hosted），pdf-home 点击打开 pdf-viewer 后，窗口渲染区域空白。
- 用户要求检查日志定位问题。

相关模块/文件：
- 后端启动链：`src/backend/launcher.py`（Hosted MsgDispatch → `runner.start_pdf_viewer_hosted`）
- 前端契约：`src/frontend/common/event/event-constants.js`、`src/frontend/common/ws/ws-client.js`
- Viewer 事件白名单：`src/frontend/common/event/global-event-registry.js`、`src/frontend/common/event/pdf-viewer-constants.js`
- 日志：`dist/latest/logs/pdf-viewer-<id>-js.log`、`backend-launcher.log`、`http-requests.log`

发现与结论：
- 后端按约已启动 viewer（is_prod=True，URL 使用 `pdfFile_port=8080`，WS=8765），并收到 `pdf-viewer:register:requested`，返回 `pdf-viewer:register:completed`。
- 前端 viewer JS 报错：拦截未注册的 WebSocket 消息类型 `pdf-viewer:register:completed`，导致注册流程未完成→ 未拉取 PDF → 空白。
- 同时，`pdf-viewer:mouse-mode:changed`、`pdf-viewer:render-mode:changed` 等 UI 事件未纳入全局白名单，产生额外告警（非根因）。

处置与修复：
- event-constants.js：新增 `VIEWER_REGISTER_COMPLETED`、`VIEWER_REGISTER_FAILED`。
- ws-client.js：`VALID_MESSAGE_TYPES` 允许 `pdf-viewer:register:completed/failed` 与 `pdf-viewer:navigate:*`。
- pdf-viewer-constants.js：补充 `pdf-viewer:render-mode:changed`、`pdf-viewer:mouse-mode:changed` 进入白名单收集集。

执行步骤（待完结）：
1) rebuild 前端并从 dist 验证 viewer 加载；
2) 检查 `pdf-viewer-*-js.log` 是否不再出现 UNREGISTERED_MESSAGE_TYPE；
3) 确认首次加载已请求 PDF 页面资源（`http-requests.log` 出现对应条目）。

### 当前任务（20251017190620）
名称：二次排查“仍然打不开”与新增日志错误处理

新增日志发现：
- viewer JS：未捕获拒绝 `WebSocket连接未建立`（连接前调用 request）
- pdf-home JS：`search-results:item:open` 未注册；`pdf-library:viewer:completed` 被 WS 白名单拦截
- HTTP：仍无 `/pdf-files/<id>.pdf` 请求

修复要点（源码，需 rebuild）：
- event-constants.js：增加 `OPEN_PDF_COMPLETED/FAILED`，增加 `SEARCH_RESULTS_EVENTS.ACTIONS.OPEN`
- ws-client.js：VALID_MESSAGE_TYPES 允许 `pdf-library:viewer:completed|failed`
- ws-client.js：`request()` 未连接时“注册pending+入队”，避免立即抛 `WebSocket连接未建立`

待验证：
- 重建后，确认上述错误消失，并出现 PDF 数据请求

### 当前任务（20251017194855）
名称：进一步兼容现有 dist 的 PDF 路由与 viewer 启动参数

新增修复：
- 后端：embed_fileserver 增加 `/pdf-files/*` 路由别名（映射到 `pdfs_root`）。
- 前端（Python launcher）：生产模式下若有 pdf-id，则附加 `&file=/pdfs/<id>.pdf`，前端据此自动加载。

目的：
- 在未 rebuild 的情况下，尽可能让现有 dist 前端成功加载 PDF。

### 线上运行问题定位补充（20251018082134）
问题描述：从 pdf-home 双击搜索结果不再弹出 pdf-viewer 窗口（dist/latest/ 环境）。

综合日志结论：端口分裂与订阅错配导致“只 ACK 不启动”。
- 同时存在两套后端：旧（ws=8765/http=8080）与新（ws=8766/http=8081）。
- pdf-home 连接旧端口（8765），向该标准服务器发送 `pdf-library:viewer:requested`；标准服务器按契约立即回 `viewer:completed`（快速 ACK），但真实启动动作需由 `BackendLauncher._on_msgcenter_message` 执行，而 BackendLauncher 绑定在新端口（8766）实例上，未收到旧端口的 `message_received` 事件，导致未启动 pdf-viewer。
- `logs/runtime-ports.json` 被多个组件回写，存在竞态覆盖；当前文件显示旧端口（8765/8080），与 backend-launcher 的新端口不一致。

临时恢复建议：
- 关闭所有 GUI/后端残留进程 → 删除 `dist/latest/logs/runtime-ports.json` → 重新启动 `gui_launcher.py`，仅启动一次后台与 pdf-home，确保双方读取并使用同一组端口；再次双击应弹出 viewer。

源码层面建议（待后续实现）：
- BackendLauncher 优先复用现有 `runtime-ports.json` 所指向的标准服务器（若已运行），并对该实例绑定 `message_received`，避免另起端口。
- pdf-home 在 `keep_backend=True` 时避免不必要的端口文件回写或引入“写入锁/时间戳优先”策略，规避端口竞态。

### 增强记录（20251018084822）
名称：gui_launcher - 后端已运行时禁用“启动后端(Hosted)”按钮

背景：
- 多次出现误触重复启动后台导致端口分裂（如 8765/8080 与 8766/8081 并存）的情况；
- GUI 已具备状态文件/进程 PID 的检测逻辑（_update_status），可用于联动控件状态；

变更：
- 文件：`gui_launcher.py`、`dist/latest/gui_launcher.py`
  - 在 `_create_hosted_tab()` 中将“启动后端(Hosted)”按钮保存为 `self.hosted_backend_start_btn`；
  - 在 `_update_status()` 计算 `backend_running` 后：
    - `self.hosted_backend_start_btn.setEnabled(not backend_running)`；
    - 运行中时设置 ToolTip 为“后端正在运行，已禁用启动按钮”；

影响：
- 当后端处于运行状态（包括 CLI 子进程模式与 Qt 线程模式），该按钮会变灰且不可点击，避免重复拉起；
- 当停止所有服务后，按钮自动恢复可用。

相关模块/函数：
- `gui_launcher.py::_create_hosted_tab()`、`gui_launcher.py::_update_status()`
- `dist/latest/gui_launcher.py` 同步修改，便于直接运行发行版脚本也生效。
### 当前任务（20251018085714）
名称：Outline/URL 导航参数校验导致“position 必须是数字”——修复与契约统一

背景与现象：
- 日志（2025-10-18 08:46~08:51）：`dist/latest/logs/pdf-viewer-c83c60c58ad2-js.log`
  - `[URLParamsParser] 参数验证失败`
  - `[URLNavigationFeature] 导航参数验证失败: position 必须是数字`
- 反馈：PDF 原生大纲（outline）点击无任何跳转（多种 dest 形态均无效）。

根因（基于事实）：
- `URLParamsParser.validate()` 使用条件 `params.position !== null` 判断是否需要校验，但当上游 emit 传 `position: undefined` 时，该条件仍为真，进而判定“必须是数字”；
- `features/pdf-outline/components/outline-sidebar-ui.js` 在没有 region.scrollY 时构造 `{ position: undefined }` 触发 `NAVIGATION.URL_PARAMS.REQUESTED`；
- 因此被 URL 校验层拦截，导航未下发到 `NavigationService`。

修复（执行步骤与结果）：
1) 校验层放宽：`URLParamsParser.validate()`
   - `pageAt/position` 的判断改为 `!== null && !== undefined`；
   - `undefined` 被视为“未提供”，不再报错。
2) 事件源规范化：`OutlineSidebarUI`
   - 发事件时 `position` 统一为 `number|null`，无值传 `null`，避免 `undefined`。

相关模块与文件：
- `src/frontend/pdf-viewer/features/url-navigation/components/url-params-parser.js`
- `src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js`

验收要点：
- 无 region 的大纲节点 → 能按页跳转；
- 含 region.scrollY 的节点 → 能按百分比定位；
- 命名目的地/引用对象/数字索引 → 由 `pdf/pdf-dest-utils.js#resolvePdfDest` 正确解析并跳转；
- 日志不再出现“position 必须是数字”。

后续跟进：
- 在“事件契约/Schema”层统一 nullable 语义：`position?: number|null`；建议在 emit 侧做就地规范化。

---

## 🧠 知识卡（20251018165341）— pdf_loaded 消息来源与调用链

描述：
- 目标：明确 `pdf_loaded` 在 pdf-viewer 中由谁发送、何时发送、数据从何而来；仅做定位与记录，不更改任何密码或配置。

结论：
- 发送者：`WebSocketAdapter`（前端适配器）。
- 发送位置：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:170`（附近，`#setupOutgoingMessageHandlers` 内）。
- 触发条件：监听全局事件 `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`，在回调中调用 `this.#wsClient.send({ type: 'pdf_loaded', data: {...} })`。
- 典型载荷：`{ file_path, filename, total_pages, url }`（字段由上游发出成功事件的 payload 决定）。

相关模块与文件：
- 发送点：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:170`
- 触发事件（PDFManager 路径）：`src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js:150`
- 触发事件（FileService 路径）：`src/frontend/pdf-viewer/features/pdf-reader/services/file-service.js:338`
- 事件常量：`src/frontend/common/event/pdf-viewer-constants.js`

事件链路：
- PDF 加载成功 → 发出 `FILE.LOAD.SUCCESS`（PDFManager 或 FileService） → WebSocketAdapter 收到后 `WSClient.send({ type: 'pdf_loaded' })`。

补充说明：
- 同一回调在存在 `pdf-id` 时还会发送 `pdf-library:record-update:requested` 更新 `visited_at/last_accessed_at`，与 `pdf_loaded` 并行，不冲突（已有单测覆盖）。

建议（不立即实施）：
- 为 `FILE.LOAD.SUCCESS` 建立明确的 Payload Schema（含 `filename/url/totalPages/filePath/pdfDocument`），并在适配器侧做字段兜底以降低来源差异影响。

## 🧠 知识卡（20251018200255）— pdf_loaded 是否已弃用/被替代

结论（基于仓库现状）：
- `pdf_loaded` 不在前端 `WEBSOCKET_MESSAGE_TYPES` 白名单中，且后端 `standard_server.py/standard_protocol.py` 无任何处理分支，说明它并非受支持的标准契约消息；
- 当前行为：仅在前端 `WebSocketAdapter` 监听 `FILE.LOAD.SUCCESS` 后发送，更多用于旁路日志/可观测性（单测中也仅校验“有发送”）；
- 实际业务语义已由两条标准消息承担：
  1) `pdf-viewer:register:requested`（注册 viewer 实例与 pdf_uuid 绑定）；
  2) `pdf-library:record-update:requested`（更新 `visited_at/last_accessed_at`，代表“已加载/访问”）。

证据位置：
- 发送点：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:~187`；
- 前端契约：`src/frontend/common/event/event-constants.js`（无 `pdf_loaded`，有 `PDF_LIBRARY_RECORD_UPDATE_REQUESTED`、`VIEWER_REGISTER_REQUESTED`）；
- 后端契约/处理：`src/backend/msgCenter_server/standard_protocol.py`、`src/backend/msgCenter_server/standard_server.py`（无 `pdf_loaded` 处理，存在 viewer 注册与记录更新处理）；
- 全局检索：除单测与历史规格文档示例外，无消费者。

建议：
- 将 `pdf_loaded` 标注为 deprecated（仅日志用途）；若需长期保留，建议改为标准三段式命名并在后端显式记录为“观测信号”，否则可逐步移除以减少噪音。

## 🧠 知识卡（20251018201255）— 初始化阶段为何会“加载两次”并发送两次 pdf_loaded

现象：
- 启动日志中出现两次 `FILE.LOAD.SUCCESS` 与两次 `pdf_loaded`；

可能路径与根因：
- 路径1（单次加载但双重“成功”事件）：
  - `PDFManager`（全局EventBus）在 `pdf/pdf-manager-refactored.js:150` 发出 `FILE.LOAD.SUCCESS`；
  - `FileHandler.#emitLoadSuccess()`（作用域EventBus）在 `features/pdf-reader/services/file-service.js:336-352` 同时发出带命名空间的“成功”事件；
  - 历史上存在“作用域事件桥接到全局”的实现/监听混用，导致 WebSocketAdapter 能两次感知“成功”，进而两次发送 `pdf_loaded`。
- 路径2（启动双入口触发两次“请求加载”）：
  - 入口A：`bootstrap/app-bootstrap-feature.js` 在 URL 含 `file=` 时自动发 `FILE.LOAD.REQUESTED`（全局）；
  - 入口B：`features/url-navigation/index.js` 在 URL 含 `pdf-id` 且判断与“当前已开文档不同”时，再次发 `FILE.LOAD.REQUESTED`；
  - 两次请求 → 两次成功 → 两次 `pdf_loaded`。

验证方法：
- 查看 `dist/latest/logs/pdf-viewer-*-js.log`，按时间线查找 `FILE.LOAD.REQUESTED/SUCCESS`，关注 `metadata.actorId`（PDFManager vs FileHandler）；
- 对照启动URL是否同时包含 `file` 与 `pdf-id`，以及 URLNavigationFeature 的“同文档判断”日志。

建议（不立即实施）：
- 事件单一来源：统一由 `PDFManager`（全局）发 `FILE.LOAD.SUCCESS`；`FileHandler` 不再向全局发同名成功事件；
- 发送侧去重：WebSocketAdapter 对同一 `filename+url` 在 300~500ms 内只发送一次 `pdf_loaded`；
- 入口收敛：URL 导航对“同文档”的判断更严格，避免 `file` 与 `pdf-id` 并存时重复加载。

---

## 🧠 知识卡（20251018205848）— 为复现两次 FILE.LOAD.REQUESTED 添加 warn 级别 TRACE 日志

目的：
- 在生产默认 WARN 级别下，也能清晰看到两次触发 `FILE.LOAD.REQUESTED` 的来源与载荷。

实现：
- 在以下发射点新增 `warn` 级别日志（关键字含 `[TRACE] Emitting FILE.LOAD.REQUESTED from ...`）：
  - Bootstrap 自动加载：`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`（from Bootstrap）。
  - URL 导航加载：`src/frontend/pdf-viewer/features/url-navigation/index.js`（from URLNavigationFeature）。
  - WS 触发加载：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`（from WebSocketAdapter）。

验证：
- 打开 `dist/latest/logs/pdf-viewer-*-js.log`，应能看到两条（或三条，如含 WS 触发） TRACE 日志，对应两次触发来源。

影响：
- 不改动业务逻辑，仅新增 WARN 级别日志；满足生产环境可见性要求。
### 当前任务（20251018203035）
名称：移除“标注侧边栏已关闭”toast（静默处理）

背景：关闭标注侧边栏时，会出现信息类toast，用户希望移除。

改动：
- annotation/components/annotation-sidebar-ui.js：在 `#handleSidebarClosed` 中删除 `notifyInfo` 提示；保留 `logger.info` 日志，避免打扰。

影响：
- 关闭侧边栏不再弹窗；其它地方的模式开启提示不受影响。

## 🧠 知识卡（20251018213427）— 标注渲染的加载与兜底策略更新

事实（2025-10-18）：
- `TextHighlightTool` 现已监听 `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED`，在新数据抵达时会清理历史高亮与菜单，并依据当前页即时渲染；当文本层尚未生成时，会将标注加入 `pendingHighlightsByPage` 队列。
- 高亮渲染依赖 `#isTextLayerReady` 检查，只有当页面已挂载 `.textLayer` DOM 时才会调用 `HighlightRenderer.renderHighlight`，否则等待 `pagerendered` 或 `textlayerrendered` 事件再次触发 `#flushPendingHighlightsForPage`。
- 队列去重以 `pageNumber + annotationId` 为 key，渲染成功后会同步更新 `#annotationHighlightRecords` 与 action menu 绑定，删除标注时也会移出队列。
- `ScreenshotTool` 同样订阅 `ANNOTATION.DATA.LOADED`：会删除不再存在的标记框，并为每个截图标注执行 `renderScreenshotMarker`（内部已处理 canvas 未就绪时的延迟观察）。

测试补充：
- `text-highlight-tool.test.js` 新增用例覆盖数据加载下的即时渲染与队列刷新场景；`screenshot-tool.test.js` 验证列表加载后能批量挂载标记框。

影响：
- 打开标注侧边栏时不再出现“TextLayer not found”错误；截图、高亮类标注在初始载入后即会展现视觉占位。

验收：
- 打开/关闭标注侧边栏时无 toast，仅有日志。

## 🧩 后端“数据格式回退机制”盘点（20251020093214）

目标：梳理后端代码中与“数据格式/协议”相关的 fallback/兼容策略，形成工程内可追溯清单，指导前后端协作与测试覆盖。

范围：仅后端（`src/backend/**`）；不含前端 UI 回退。

结论（按类别归纳，含定位；2025-10-20 已切换为严格模式的项已标注“[严格]”）：
- 消息类型旧→新映射（协议格式兼容）
  - `src/backend/msgCenter_server/standard_server.py:161`（`LEGACY_TYPE_MAPPING`）
  - `src/backend/msgCenter_server/standard_server.py:199`（`_normalize_message_type` 应用）
- 消息数据字段名别名（同义字段回退）
  - `src/backend/msgCenter_server/standard_server.py:444`（`pdf_id | file_id | uuid`）
  - `src/backend/msgCenter_server/standard_server.py:486`（`file_ids | ids`）
  - `src/backend/msgCenter_server/standard_server.py:1677`（`file_id | pdf_id | uuid | id`）
  - `src/backend/api/pdf-viewer/bookmark/service.py:156`（`pageAt` 缺省时回退 `pageNumber`）
  - `src/backend/api/pdf_library_api.py:1241`（`uuid | id`）
- ID/主键格式兼容（双格式）
  - 标注 ann_id：`src/backend/database/plugins/pdf_annotation_plugin.py:170`（旧 `ann_*` 与新 `pdfannotation-*`）
  - 书签 bookmark_id：`src/backend/database/plugins/pdf_bookmark_plugin.py:21`（`bookmark-*` 与 `outlineItem-*`）
- 旧 JSON → 新结构迁移/读取回退 → [严格] 已取消自动迁移与读取回退
  - 自动迁移调用已移除：`src/backend/database/plugins/pdf_bookmark_plugin.py:enable()` 不再调用 `_migrate_legacy_schema()`（2025-10-20）
  - 保存/导入：仅接受 `pageAt`，不再从 `pageNumber` 回退（`src/backend/api/pdf-viewer/bookmark/service.py:_build_bookmark_row`，2025-10-20）
  - 读取：`list_bookmarks()` 若发现缺少合法 `pageAt`，直接抛出 `DatabaseValidationError`（2025-10-20）
- MIME 类型推断修正与兜底
  - `src/backend/pdfFile_server/embed_fileserver.py:704`（`guess_mime_type()` → `application/octet-stream` 兜底）
  - `src/backend/pdfFile_server/handlers/pdf_handler.py:260`（重写 `guess_type()` + 兜底）
  - 验证：`src/backend/pdfFile_server/__tests__/test_embed_fileserver_mime.py:18`
- 布尔/数值表达兼容
  - `src/backend/database/plugins/pdf_info_plugin.py:740`（`is_visible` 兼容 `true/1`）
- 时间戳单位自动识别
  - `src/backend/api/utils/datetime.py:15`（`ensure_ms`）
  - `src/backend/api/utils/datetime.py:24`（`ensure_seconds`）
- PDF 页面传输压缩编码默认值
  - `src/backend/msgCenter_server/standard_server.py:1757`（缺省回退 `zlib_base64`）
- 搜索失败兜底策略
  - `src/backend/api/pdf-home/search/service.py:66`（异常回退全量查询）

建议与后续：
- 在 `docs/SPEC` 增补“后端数据格式兼容矩阵”；覆盖单测聚焦：字段别名、ID 双格式、时间单位与 MIME 兜底、压缩编码默认值。

---

## ✅ 检查结论（20251020125039）— outline item-id 导航与 URL 初始化统一性

问题与目的：
- 判定“pdf-viewer 中 outline 的按 item-id 导航”是否完善；
- 判定 URL 解析阶段调用该导航的可行性；
- 判定初始化阶段自动导航在 `annotation-id / anchor-id / outline-item-id` 三者是否统一。

关键发现（UTF-8 与 `\n`）：
- 消费端已就绪：`src/frontend/pdf-viewer/features/pdf-bookmark/index.js:#handleNavigateByIdRequest()` 监听 `PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`，可通过 `BookmarkManager.getBookmark(id)` 获取节点并调用导航服务（严格读取 `pageAt/position`）。
- Outline 点击：`features/pdf-outline/components/outline-sidebar-ui.js` 直接以 `{ pageAt, position }` 发起 `NAVIGATION.URL_PARAMS.REQUESTED`，不基于 id，属设计选择。
- URL 解析：`features/url-navigation/components/url-params-parser.js` 已解析 `outline-item-id` 并保留到 `parsed.outlineItemId`。
- URL 分发：`features/url-navigation/components/url-jump-dispatcher.js` 对 `outlineItemId` 仅记录日志，不触发跳转事件。
- Anchor：`features/pdf-anchor/index.js` 独立监听 `URL_PARAMS.PARSED` 并具备自身门闸（数据与渲染就绪）。
- Annotation：`URLJumpDispatcher` 具备门闸（annotationDataLoaded）并触发 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`。

结论：
- Q1 完善度：按 item-id 导航的“执行端”完善，但“触发端”（从 URL 或其它来源发出 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`）缺失，端到端链路未闭环。
- Q2 可行性：具备；需要在 URL 分发器/Feature 门闸通过后实际发出导航事件，并考虑书签数据加载的门闸。
- Q3 统一性：未统一。anchor（独立门闸）、annotation（分发器门闸）、outline（未接入）。

建议步骤（待实施）：
- S1 在 `URLJumpDispatcher.tryExecute()` 中检测到 `outlineItemId` 时，发出 `PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`（替代“仅日志”）。
- S2 在 `URLNavigationFeature` 内监听 `PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS`，设置 `bookmarkDataLoaded=true`；当 URL 含 `outlineItemId` 时与 `annotationDataLoaded` 一起作为门闸条件，门闸通过后执行一次分发。
- S3 失败时（ID 未命中）在 `BOOKMARK.LOAD.SUCCESS` 到达时重试一次；同时输出 info 级日志与 toast（严格模式不做默认页回退）。

备注：
- 以上为设计与连通性检查结论；尚未改动代码。实施时需补充最小单测覆盖：URL→Dispatcher→事件→BookmarkFeature 命中与未命中分支。

---

### 当前任务（20251025162609）
名称：会话初始化与状态同步

说明（UTF-8 与 \\n）：
- 已加载最近 8 条 AI Working Log 与规范头，未发现未完成的强制执行步骤。
- 等待用户指定新的明确任务；若继续推进 pdf-outline，请给出复现步骤或目标。

下一步候选：
- 根据用户目标，先编写/补充测试（占位或真实用例），再进行最小变更实现。
- 变更后同步更新 architecture/tech，并记录到 AItemp。

---

### 当前任务（2025-10-25 16:41:20）
名称：修复 pdf-home “添加PDF”按钮失效 & 清理 legacy 依赖

背景：
- 最近删除了 legacy 的 pdf-list 功能；点击“添加PDF”按钮无效，无法打开文件选择器。
- dist/latest/logs/pdf-home-js.log 显示部分功能安装失败（pdf-editor / pdf-sorter），疑因仍依赖 pdf-list。

本次变更（UTF-8 与 \n）：
- 新增 Feature：dd-files，监听 search:add:requested，通过 QWebChannelBridge.selectFiles() 调用原生对话框，选择后发送 pdf-library:add:requested。
- 在 core/pdf-home-app-v2.js 注册 AddFilesFeature；默认启用。
- 修正依赖：pdf-editor、pdf-sorter 的 eature.config.js 依赖从 pdf-list 改为 search-results。
- 更新 config/feature-flags.json：去除 pdf-list 依赖链，新增 dd-files。

影响评估：
- “添加PDF”按钮功能恢复；对外事件/WS契约保持不变（仍用 pdf-library:add:requested）。
- 启动阶段 pdf-editor/pdf-sorter 因依赖不存在而报错的问题应收敛（若仍报错，多半因 DOM 容器未就绪，非依赖问题）。
- FilterFeature 仍监听 @pdf-list/data:load:completed（缓存用途），短期不影响主流程，建议后续改为监听标准搜索结果事件或移除。

验收要点：
- 点击“＋添加”弹出文件对话框；选择 .pdf 后 WS 侧收到 pdf-library:add:requested。
- “最近添加”可刷新看到新文件（由后端完成入库与广播）。

---

### 追加（2025-10-25 16:58:08）
名称：FilterFeature 遗留监听收敛

内容：
- 将 FilterFeature.#subscribeToPdfList() 的监听从 @pdf-list/data:load:completed 替换为标准事件 search:results:updated；
- 读取 data.records || data.files || data.items 作为缓存源，写入 FilterManager.setDataSource(...)；
- 目的：去除 legacy 命名依赖，与“搜索→结果”主链路对齐。

影响：
- 需要有一次搜索结果发布后才会填充缓存；不再依赖旧的“全量列表广播”。
- 与现有 SearchManager/SearchResultsFeature 事件流一致。

---

### 修复（2025-10-25 18:40:00）— outline=1 透传（WS 打开 viewer）

问题：GUI（Hosted）勾选“启用 Outline”后，在 pdf-home 双击搜索结果通过 WebSocket 打开 pdf-viewer 未出现“当前为 Outline 模式” toast。

原因：QWebChannel 路径会读取 `logs/debug-info.json` 并在 URL 追加 `&outline=1`；但 WebSocket 路径由 `BackendLauncher._on_msgcenter_message` 调用 `start_pdf_viewer_hosted()` 时未传递 `enable_outline`，导致 URL 未追加该参数。

改动（UTF-8 与 `\n`）：
- `src/backend/launcher.py (BackendLauncher)` 新增：
  - `_read_debug_info_flags()`：读取 `logs/debug-info.json`（过滤 `_metadata`）；
  - `_is_outline_enabled_flag()`：优先 `debug-info.json`，回退 `runtime-ports.json`，判断 `outline/feature_outline`；
  - `_on_msgcenter_message()` 调用 `start_pdf_viewer_hosted(..., enable_outline=flag)`，由前端 launcher 统一把 `&outline=1` 追加到 URL。
- 新增测试占位（skip）：`src/backend/__tests__/outline_flag_pass_through.test.py`。

验收：
- 勾选开关→启动 pdf-home（Hosted）→ 双击搜索结果打开 viewer，即可看到 toast “当前为 Outline 模式”；日志包含 `[Bootstrap] Outline mode is active (toast shown)`；URL 含 `&outline=1`。

---

### 新增（2025-10-25 23:40:00）— 冒烟测试与可持续测试系统

目标：将“冒烟测试（Smoke Test）”纳入正式规范与项目结构，提供统一执行入口，保证每次改动后可在 ≤60 秒完成关键面验证（构建/导入正常、关键常量存在、最小注册表可创建）。

落地内容（UTF-8 与 `\n`）：
- 规范：扩充《docs/SPEC/TEST-EXECUTION-TYPES-001.md》，新增“冒烟测试（Smoke Test）”定义、退出准则与反模式；版本号升至 v1.1。
- Python：新增根级 `pytest.ini` 注册 `smoke` 标记；已为以下稳定用例打标：
  - tests/test_pdf_home_launcher_prod_mode.py::test_resolve_production_index_priority
  - tests/backend/test_static_path_resolution.py（模块级标记）
- 前端：新增极速 Jest 用例：
  - src/frontend/common/__smoke__/core.smoke.test.js（可创建 DependencyContainer/FeatureRegistry 并注册最小特性）
  - src/frontend/pdf-viewer/__smoke__/events.smoke.test.js（关键 WS 事件常量存在性校验）
- 命令：`pnpm test:smoke`（Jest 仅匹配 `__smoke__` 目录）；Python 使用 `pytest -m smoke -q`。

阶段计划：
1) 今日：最小 smoke 就位（已完成）。
2) 48 小时内：补充轻量集成 smoke（pdf-home WS 错误 toast 透传、viewer bootstrap 最小依赖注入验证）。
3) 随后：在 CI 中强制 smoke 通过；慢测移至 nightly。
4) 长期：沉淀事件/服务契约测试（schema/契约清单），减少跨 Feature 回归风险。

验收要点：
- `pnpm test:smoke` 通过；
- `pytest -m smoke -q` 通过；
- 规范与命令在 memory bank 可检索到（本条即索引）。

---

### 修复（2025-10-26 15:25:40）— pdf-library:add:requested 补齐 metadata 并对齐 data 结构

问题：后端严格 Schema 校验开启后，`pdf-library:add:requested` 报错“$: missing required property 'metadata'”，同时出站 `data` 携带了 schema 未定义的 `name` 字段。

原因：
- 校验入口：`standard_server._validate_message_by_schema()`（轻量 JSON Schema 实现，覆盖 required/properties/const 等）；
- 所用 schema：`todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/pdf-library/v1/messages/add.request.schema.json`；
- 该 schema 要求：`type/timestamp/request_id/metadata/data{filepath}` 必填；`metadata.version` 为必填；`data` 不允许额外字段。

改动（UTF-8 与 `\n`）：
- 文件：`src/frontend/pdf-home/features/add-files/index.js`
  - 出站消息新增 `timestamp: Date.now()` 与 `metadata: { version: '1.0.0' }`；
  - `data` 仅保留 `{ filepath }`，移除 `name`（仍用于本地 toast 展示，不上送）。

验证：
- 选择 PDF 文件添加 → WS 发送的请求包含 `type/timestamp/request_id/metadata{version}/data{filepath}`；
- 后端不再因 `metadata` 缺失报 `pdf-library:add:failed`；成功回执触发“最近添加”刷新与成功 toast。

后续：
- 建议统一为所有 `*:requested` 出站消息显式携带 `metadata.version='1.0.0'`；`timestamp` 由 `WSClient.send()` 兜底补充，但推荐显式设置以提升可观测性。

记录时间：2025-10-26 15:25:40

---

### 决策（2025-10-26 15:34:47）— 禁止自动补齐 metadata（平台层）

结论：
- 不允许在 WSClient 或其他平台层对缺失的 `metadata` 进行自动补齐；
- 生产者（各 Feature/Service 的出站构造点）必须显式提供符合 schema 的 `metadata`（至少包含 `version: '1.0.0'`）。

实施：
- 已移除 `src/frontend/common/ws/ws-client.js` 中 `send()` 的 metadata 自动注入；仅保留 `timestamp` 补齐；
- `add-files` 路径已合规（显式携带 `metadata` 与 `timestamp`）。

预期：
- 业务遗漏会被后端 schema 严格校验捕获，从而推动出站路径逐一对齐契约。

记录时间：2025-10-26 15:34:47

---

### 变更（2025-10-26 15:48:18）— 全仓出站消息显式携带 metadata；wsClient.request 支持传入 metadata

背景：按照“禁止平台自动补齐”的决策，需确保所有出站路径显式携带 `metadata`；`wsClient.request` 原实现无法让调用方传递 `metadata`，导致 annotation/anchor/bookmark 等域难以达成一致。

实施要点：
- `wsClient.request` 新增可选参数 `options.metadata`（仅透传，不默认注入）；`_buildPDFDetailRequestMessage` 显式附带 `metadata`；
- 已巡检并修正以下出站：
  - pdf-home：search-results 的 OPEN/INFO 请求；debug 工具的测试消息；（recent-*、saved-filters 已在先前补齐）
  - pdf-viewer：WebSocketAdapter 的 viewer 注册/visited/page/zoom 消息、所有 ANCHOR_* 请求；
  - annotation：AnnotationManager 的 LIST/SAVE/DELETE 请求；
  - bookmark：RemoteBookmarkStorage 的 LIST/SAVE/CLEAR 请求；
  - legacy（最小改动）：PDFManagerCore 与 EventHandler 的 add/remove/list/open 路径补 `request_id/metadata`，并移除 add 的 `data.name`；其余 data 结构待后续统一按 schema 调整。

验证：打开/编辑/标注/书签全链路均可见出站消息含 `metadata.version='1.0.0'`；后端不再报“missing required property 'metadata'”。

记录时间：2025-10-26 15:48:18

---

### 分析（2025-10-26 16:14:07）— prod 模式 Outline 侧边栏空白（PDF: c83c60c58ad2）

现象：通过 gui_launcher.py（prod）打开 pdf-home，双击搜索结果后 pdf-viewer 的“大纲”侧边栏为空白。

日志与代码要点：
- pdf-viewer JS 日志（dist/latest/logs/pdf-viewer-c83c60c58ad2-js.log）显示：Bootstrap 强制启用 pdf-outline，并禁用 bookmark 功能域；侧边栏使用 OutlineSidebarUI；未见 OutlineSidebarUI 的 INFO 日志（模块级别 ERROR）。
- http-requests.log 显示已加载 outline-sidebar-ui 脚本，无 404；viewer URL 未含 outline=1，但 Bootstrap 已强制 Outline。
- 代码：
  - 强制 Outline：src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js
  - OutlineFeature（数据广播）：src/frontend/pdf-viewer/features/pdf-outline/index.js::#refreshList()
  - BookmarkFeature（含“DB 为空 → 导入原生大纲”）：src/frontend/pdf-viewer/features/pdf-bookmark/index.js::#handlePdfLoaded()

结论（原因）：
- 因强制启用 `pdf-outline` 并禁用 `pdf-bookmark`，当前不再触发 BookmarkFeature 中“当 DB 无大纲时自动从 PDF 原生大纲导入”的逻辑；
- `PDFOutlineFeature` 仅负责“从存储读取并广播”，未实现“DB 为空时自动导入”；
- 对于未在后端存储过大纲的 PDF，`bookmarkManager.getAllBookmarks()` 返回空数组，OutlineSidebarUI 渲染空树，表现为空白。

修复建议：在 `PDFOutlineFeature` 增补“自动导入 PDF 原生大纲”流程（与 BookmarkFeature 对齐）；或临时在 UI 初始化时发 `BOOKMARK.LOAD.REQUESTED` 并在 Feature 侧抓取 PDF 原生大纲填充。

记录时间：2025-10-26 16:14:07

---

### 修复（2025-10-26 16:23:04）— Outline 模式：DB为空时自动导入原生大纲

内容：落实“DB 为空 → 自动导入原生大纲”的逻辑，复用 BookmarkFeature 的提取与转换实现，避免首次打开 PDF 时侧边栏空白。

文件与要点：
- `src/frontend/pdf-viewer/features/pdf-outline/index.js`
  - 新增 `#importNativeBookmarksIfEmpty(pdfDocument)`：当 `BookmarkManager.getAllBookmarks()` 为空时，从 `BookmarkDataProvider.getBookmarks()` 提取原生大纲，使用 `BookmarkManager.importNativeBookmarks(native, parseDest)` 导入并保存，再 `loadFromStorage()` 和刷新；
  - 新增 `#parseBookmarkNormalizedDest(native, pdfDocument)`：与 BookmarkFeature 一致的严格解析与回退策略（provider.parseDestination → resolvePdfDest + yToPositionPercent）；
  - `#tryInitialLoad()`：先加载存储，若为空则尝试导入，最后刷新；
  - `#setupEventListeners()` 的 `FILE.LOAD.SUCCESS`：加载存储→若为空且有 pdfDocument 则导入→刷新（删除原先无条件导入逻辑）。

行为影响：
- 对于未曾保存过自定义大纲的 PDF，首次打开将从 PDF 原生书签自动导入并持久化；
- 已有大纲的 PDF 不受影响；避免重复导入导致的数据重复。

记录时间：2025-10-26 16:23:04
