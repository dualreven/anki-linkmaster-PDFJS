# Memory Bank - Context（核心精简）

更新时间：2025-11-01

用途与范围（≤300 行）：
- 仅保留“当前问题、关键约束、相关模块与验收要点”。长篇背景、历史讨论、阶段总结一律移至 `context.archive.md` 与专门文档（`architecture.md`、`tech.md`、`product.md`、`tasks.md`）。
- 所有文件与命令统一 UTF-8；严禁兜底与静默降级；严格区分 REQUEST/RESPONSE/ERROR 事件；统一使用 toast 呈现错误。
- 若需追溯历史、方案细节或长文评审，请先查 `context.archive.md`。

---

## 快速导航
- 关键约束与风格：见下文“约束清单”
- 当前活跃任务（近两日内）：见下文“当前任务”
- 相关模块与入口：见下文“关键模块与函数”
- 参考规范：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 历史与长文：`.kilocode/rules/memory-bank/context.archive.md`

---

## 约束清单（务必遵守）
- 编码与换行：所有读写文件显式指定 UTF-8；确保 `\n`。
- 错误处理：禁止兜底；出现异常必须显式抛出或 toast 呈现；统一使用 `logger.*(..., { toast: true })`（前端）。
- 事件与契约：
  - WebSocket 消息按 `REQUESTED/COMPLETED/FAILED` 或 `RECEIVED/RESPONSE/ERROR` 分类，载荷遵循 schema（必要时运行时校验）。
  - 事件命名三段式，前缀对齐模块（例如 `pdf-library:*`、`pdf-viewer:*`）。
- 单例策略：
  - `pdf-home` 全局单例；`pdf-viewer` 按 `pdf-id` 单例；再次启动应优先激活已有窗口（不做“激活即导航”）。
- UI 规范：禁止 `alert`；错误/重要提示统一 toast；结构化日志记录 Trace ID 串联链路。
  - Toast 入口统一：只能使用 `logger.*(..., { toast })` 或 `common/utils/notification.js`；禁止任何文件直接导入 `common/utils/thirdparty-toast.js`（由 ESLint 规则 `custom/no-direct-toast-import` 守护）。

---

## 当前任务（只保留核心信息）

### 12) 2025-11-01 — Git 提交工作区改动（本次）
- 目标：将当前工作区全部改动生成一次原子提交，便于后续评审/回退；不执行 push。
- 验收：`git status` 为空；`git log -1` 提交信息含时间戳与改动数量；工作日志更新（AItemp/*-AI-Working-log.md）。
- 状态：已完成（commit c4515a7，未 push）

### 11) 2025-11-01 — 启动导航路径互斥（URL vs WS）
- 目标：当“启动新 viewer 窗口”时只走 URL 参数导航；当“窗口已存在”时只走 WS 导航；两者互斥、不可并发。
- 触发场景：GUI Launcher 传入 `pdf-id` + `outline-item-id` 点击启动。
- 根因：`pyqt_launcher.py` 在 `ensure_pdf_viewer_hosted(...)` 之后无条件尝试 `navigate_viewer(...)`，与前端 URL 导航并发，且早于 viewer 完成注册导致 “Forward navigate → error”。
- 方案（已实施）：
  - 启动前判存活：从 `session_registry` 读取 viewer，并对其 `window` 做轻量 `_is_qobject_alive`；
  - 已存在→抑制 URL 参数，启动后仅通过 WS 定向导航；
  - 不存在→透传 URL 参数，由前端解析并导航；禁止再发 WS 导航；
  - 加入分支日志便于复盘。
- 验收：
  - 场景A（新建）：`backend-launcher.log` 不再出现 “Forward navigate → error”；`pdf-viewer-*-js.log` 显示 URL 门闸导航完成；
  - 场景B（已存在）：`backend-launcher.log` 记录一次 Forward navigate → ok；前端完成跳转；无并发 toast。

【补充说明：为何从 pdf-home 双击仍出现 URL/WS 日志】
- 设计现状：生产模式首次启动时，后端会在前端 URL 中携带 `file=/pdfs/<id>.pdf` 与 `pdf-id=<id>`，由 URLNavigationFeature 负责“文件加载”（非锚点/大纲导航），因此 JS 日志会出现“URL 参数解析/触发文件加载”；\n- 同时，为获取标题与侧栏数据，前端会通过 WS 查询 `pdf-library:info`，日志包含“详情查询成功”；\n- Python 侧在 WS connected 后还会调用一次 `bridge.loadPdfFile(file_path)`（历史路径，功能与 URL 加载重复），因此在后端可见到 `load_pdf_file` 消息日志。\n- 后续计划：\n  1) 若走 URL 初始加载，则抑制 bridge 的 `loadPdfFile` 调用（避免 WS 冗余日志）；\n  2) 当仅存在 `pdf-id` 且无导向参数时，降低 URLNavigationFeature 的日志级别为 DEBUG，避免“像导航一样”的误导。

### 10) 2025-10-30 — 心跳机制通路验证（本次已实施）
- 目标：锚点心跳（active anchor 的周期上报）工作正常；同时补充系统 WS 心跳常量（不改变运行策略）。
- 改动：
  - 事件常量（前端）：新增 `system:heartbeat:requested/completed`；
  - WSClient：允许入站 `system:heartbeat:completed`，提供 `sendHeartbeat()`（不会影响锚点心跳）；
  - 锚点心跳：`PDFAnchorFeature.#startUpdateTimer()` 实现周期采样（默认 3s）；存在激活锚点且过了冷却期才上报；仅在位置变化时发 `PDF_VIEWER_EVENTS.ANCHOR.UPDATE`；严格无兜底。
- 验收：
  - 单测：系统心跳常量/白名单用例通过；
  - 运行时冒烟：激活锚点后 3s 内产生 `anchor:update:requested`，后端返回 `anchor:update:completed`；前端日志有对应记录；无兜底路径。

【2025-10-30 晚间更新】按用户要求关闭自动心跳，只保留实现
- 关闭锚点心跳自动启动：`PDFAnchorFeature.ENABLE_HEARTBEAT = false`（默认）；`#startUpdateTimer()` 在开关关闭时直接返回。
- 关闭服务端 WS 客户端自动 ping：`WebSocketClient.ENABLE_PING_HEARTBEAT = False`（默认）；构造时不再无条件启动 `QTimer`。
- 系统心跳常量与 `WSClient.sendHeartbeat()` 保留（无任何默认调用）。

### 13) 2025-11-01 — features 命名统一（立项）
- 背景：`pdf-viewer/features` 下 `pdf-*` 与非 `pdf-*` 前缀混用；`annotation` 属业务域但未带前缀；`pdf-ui` 与 `ui-manager` 语义重叠。
- 目标：统一前缀与分层（业务域 `pdf-*` / 核心 `core-*` / 装配 `app-*` / UI `ui-*` / 适配 `*-adapter`），降低认知成本并配合日志/toast 模块治理。
- 首批：`annotation → pdf-annotation`；`pdf-ui → 并入 ui-manager`（保留薄代理过渡 1–2 个版本周期）。
- 策略：先引入 `features/registry` 聚合导出收敛引用，再改目录名与代理；最终移除代理并加 ESLint 规则约束。
- 需求文档：`todo-and-doing/2 todo/20251101174059-features-naming-unification/v001-spec.md`。
### 9) 2025-10-30 — pdf-viewer 兜底/回退策略盘点（不改代码）
- 目标：仅梳理并报告“业务兜底/回退”与“UI 级回退”，不修改源码。
- 高风险（涉及业务数据/契约，应移除或以明确“离线/演示模式”开关显式启用）
  - features/annotation/core/annotation-manager.js
    - 104: wsClient 不存在 → fallback to mock mode（Mock 持久化）
    - 243–251: WS 未连接或缺少 pdfId → 本地 Mock 保存兜底
    - 292–295: 远端保存失败 → 本地 Mock 保存兜底
  - features/annotation/index.js
    - 214–229: 安装后 setTimeout 二次解析 URL 并触发“兜底加载标注”
    - 324–338: FILE.LOAD.SUCCESS 后从文件信息推断 pdf_uuid 并设置（文件名/URL 回退）
    - 363–371: 无 URL 的情况下回退从事件数据提取 pdfId 再自动加载
    - 618–625: 注释跳转时若缺 pdfId，回退从文件信息/URL 提取
  - features/url-navigation/index.js
    - 160–164: wsClient 不可用或详情查询失败 → 回退使用 pdfId 作为文件名触发加载
  - features/annotation/tools/screenshot/qwebchannel-bridge.js
    - 214–227: 在无 WebCrypto 时，构造伪 32 位十六进制“hash”作为后端校验通过用（应仅在显式 demo/offline 下允许）
  - features/pdf-bookmark/services/bookmark-storage.js
    - 123–186: 远端不可用时大量委托 fallback（LocalStorage）读写书签（业务层回退，建议改为显式“离线模式”）
- 中风险（流程门闸/并发控制相关，建议以显式条件与清晰提示替代）
  - features/pdf-anchor/index.js
    - 55: navigationService 缺失 → fallback 为直接 DOM 操作导航
    - 178–191: DOM 就绪短轮询作为“渲染可用”兜底
- 低风险（UI-only/渲染退路，保留可接受；需标注为“非业务回退”）
  - assets/global-error-toast.js: 20–51 DOM 级 toast 降级（当 notification 入口异常时）
  - ui/text-layer-manager.js: 234–239/293 PDF.js 文本层渲染 fallback（绘制路径）
  - features/annotation/tools/text-highlight/index.js: 508–512/521 剪贴板写入失败 → 退回 execCommand
  - pdf/pdf-document-manager.js: 164–175 无标签 → 回退使用“页码字符串”
- 建议（后续治理方向，仅记录，不在本次改动范围）
  - 业务兜底统一以“显式离线/演示模式开关”控制，并带有明显 UI 横幅与日志前缀；默认严格失败并 toast。
  - 禁止从文件名/URL 推断 pdf_uuid；由上游（URL/DB/WS）显式提供；相关路径应直接报错。
  - URLNavigation 的“使用 pdfId 作为文件名”路径应移除，或在 demo 下仅加载公共样例。
  - Screenshot mock hash 仅在 demo/offline 允许；生产直接错误提示。
  - DOM 短轮询仅用于开发诊断；生产以标准“RENDER.READY/LOAD.SUCCESS”门闸为准。

### 8) 2025-10-30 — pdf-home 兜底/回退策略盘点（不改代码）
- 高风险兜底
  - bootstrap/app-bootstrap-v2.js: 端口解析失败回退 `DEFAULT_WS_PORT`（8765）
  - core/pdf-home-app-v2.js: 对任何 `*:failed` 未被消费时统一“兜底 toast”
  - features/pdf-sorter/index.js: 无全局总线时改为 DOM 绑定（DOM fallback）
  - features/pdf-edit/index.js: 无 WSClient 时改走全局 `WEBSOCKET_EVENTS.MESSAGE.SEND`
- 中风险兜底
  - features/pdf-edit/index.js: “未刷新则定时成功”提示
  - index.js / app-bootstrap-v2.js: 多处 try/catch 仅吞 UI 文案更新错误
- 低风险默认
  - utils/ws-port-resolver.js: 多处 `fallbackPort`；container/app-container.js: 默认 8765、`data||{}`
- 建议（下一步）：
  - 端口解析失败直接报错；移除全局 `*:failed` 兜底 toast；禁止 WSClient 缺失时改走总线；去除“定时成功”；DOM fallback 仅 dev 或直接报错；对关键载荷去除 `|| []/{}` 默认。
### 1) 2025-10-29 — pdf-viewer 标题来自数据库（严格无兜底）与 toast 改造
- 现象：部分环境左上角仅显示“PDF阅读器”，未显示 DB 标题；错误无统一 toast。
- 核心改动（已实施/需核验）：
  - `src/frontend/common/ws/ws-client.js`：将 `pdf-library:info:completed` 路由到 `RESPONSE`；`...:failed` 路由到 `ERROR`；补充 `VALID_MESSAGE_TYPES`。
  - `src/frontend/pdf-viewer/pyqt/main_window.py`：注入脚本仅透传错误事件，由前端统一 toast；兼容旧包监听 `websocket:message:received` 更新标题。
  - `src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js`：移除 `alert`，改为 `logger.error(..., { toast:true })`。
- 进展（2025-10-30 Phase‑1）：清理 4 处动态导入 `thirdparty-toast`（统一改为 `notification/logger`），并替换 `pdf-home` 顶层 `alert` 为 `notification.showError`；新增 ESLint 规则 `custom/no-direct-toast-import`、启用 `no-alert:error`。
- 进展（2025-10-30 Phase‑2）：批量迁移 viewer 与关键流程的静态直连 `thirdparty-toast`；将成功/错误类提示改为 `notification.showSuccess/showError`，将警告类提示改为 `logger.warn(..., { toast })`；移除 `pdf-bookmark` 中的 `alert(...)`。源码层（排除 tests/smoke/docs/README）已无 `thirdparty-toast` 直接导入。
- 验收：收到 `pdf-library:info:completed` 后标题应更新为 DB `data.title`；失败出现 toast；不允许 URL 或 ID 回退。

### 2) 2025-10-29 — 启动器单例化（pdf-home / pdf-viewer）
- 目标：`pdf-home` 全局单例；`pdf-viewer` 按 `pdf-id` 单例；再次启动优先激活。
- 变更要点：
  - `src/backend/launcher_core/session_registry.py`：运行时注册表 + `activate_window()`。
  - `src/launcher/runner.py`：`ensure_pdf_home_hosted()` / `ensure_pdf_viewer_hosted()`；原 `start_*_hosted` 标注为“建议废弃”。
  - `src/backend/launcher_core/pyqt_launcher.py`：`pdf-library:viewer:requested` 调用 `ensure_pdf_viewer_hosted()`。
- 验收：重复启动不创建新实例；激活仅前置窗口，不做导航。

### 3) 2025-10-29 — gui_launcher 同时传入 page-at 与 annotation/anchor 导致定位抖动
- 现象：先跳到 `pageAt`，短暂后又回到标注页。
- 方向：URL 导航与标注定位的优先级与触发时机需明确；保留灰度开关；必要时将“导航落位”统一入口，防二次跳转。
- 验收：同一启动参数组合只发生一次正确定位；日志链路可复现。

### 4) 2025-10-29 — gui_launcher（anki 模式）严格 ID 校验（禁止兜底）
- 需求：在 GUI 端严格校验 anchor/annotation/outline 的 ID 形态，类型不匹配直接阻断发送。
- 实施：`src/gui_launcher.py` anki 分支新增正则校验：
  - anchor：`pdfanchor-[0-9a-fA-F]{12}`；
  - annotation：`pdfannotation-[A-Za-z0-9_-]{16}`；
  - outline：非空字符串（仅校验非空，不做自动更正/回退）。
- 验收：错误在 GUI 日志窗以 `[ERROR]` 呈现；不发送 WS；符合“禁止兜底”。

### 5) 2025-10-29 — 前端构建错误（#pendingNavigateId 未定义）复现结论
- 现状：源码 `src/frontend/pdf-viewer/features/pdf-outline/index.js` 已声明私有字段 `#pendingNavigateId = null;`；本地 `pnpm run build:pdf-viewer` 通过。
- 结论：此前错误来自旧产物或未同步源码；重建 dist 后问题消失（见构建日志）。

### 6) 2025-10-29 — 自查“兜底/兼容/回退”并移除
- 移除项：
  - 前端 Outline/Bookmark 加载：`normalizeNodeJson` 不再为缺失 id 生成临时 ID；缺少 `id` 直接抛错（由上层跳过该节点）。仅接受 `pageAt`，不再兼容 `page_at/pageNumber`。（文件：`src/frontend/pdf-viewer/features/pdf-bookmark/services/bookmark-manager.js`）
  - 后端 PDF 详情：`handlers/pdf_library.detail` 仅接受 `data.pdf_id`，不再兼容 `file_id/uuid`；缺失即 400。（文件：`src/backend/msgCenter_server/handlers/pdf_library.py`）
- 保留项（不视为兜底）：
  - Outline 导航的“挂起等待列表加载完成后再判断是否不存在”：这是门闸/时序保障，列表就绪仍不存在会 toast 明确失败，而不是悄然回退。
- 验收：不存在的字段/ID 不做替代与推断；以 toast 或 ERROR 回执明确失败。

### 6) 2025-10-29 — 标注卡片“跳转”冒烟/完整性测试（新增）
- 目标：为 pdf-viewer 的“注释卡片跳转”建立可回归的完整性测试，避免其它改动引发回归而无感知。
- 覆盖范围：
  - 组件级单测：`AnnotationSidebarUI` 点击右上角“🧭”按钮，发射 `PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO`（别名 `...NAVIGATION.JUMP_REQUESTED`）。
  - 委托点击路径（严格化后）：卡片内 `.jump-btn[data-annotation-id]` 统一触发全局 `PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED`，不再走 URL 导航。
- 关键文件：
  - `src/frontend/pdf-viewer/features/annotation/components/__tests__/annotation-sidebar-ui.jump-click.test.js`
  - `src/frontend/pdf-viewer/__smoke__/annotation-card-jump.smoke.test.js`
- 运行方式：
  - 全量：`pnpm run test`
  - 冒烟：`pnpm run test:smoke`（仅执行 annotation-card-jump）
- 验收：两条路径均通过（发射事件与载荷断言正确），CI 或本地执行冒烟命令返回 0。

### 7) 2025-10-29 — 标注卡片跳转“严格模式”（已实施，无兜底）
- 改动：
  - 去除 URL 导航兜底：`AnnotationSidebarUI.#handleCardJump()` 不再发 `NAVIGATION.URL_PARAMS.REQUESTED`，仅发全局 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`；
  - 契约守卫：`ScopedEventBus.emit()` 对 `{ ANNOTATION.NAVIGATION.JUMP_REQUESTED, ANNOTATION.JUMP_TO }` 直接 `logger.error + toast` 并抛异常，要求改用 `emitGlobal()`；
  - 错误必显：缺少 `data-annotation-id`、找不到标注、处理异常均 `logger.error + toast`。
- 影响：
  - 仍使用“局部 emit”的工具（如 TextHighlight/Comment 内个别代码）会立即报错；后续需将其改为 `emitGlobal` 或交由侧边栏委托统一处理。
- 验收：
  - `.jump-btn` 点击能稳定触发跳转；对不合规调用出现 toast + 控制台错误；不出现隐式回退。
> 注：更早任务与详细论证均已转存至 `context.archive.md`，如需恢复请搜索相应日期小节。

### 8) 2025-10-30 — pdf-viewer “添加锚点”无效（修复与冒烟测试）
- 现象：侧边栏点击“添加”后未见列表新增，用户感知为“添加失败”。
- 根因：`PDFAnchorFeature` 对 `ANCHOR.CREATE` 的监听在检测到负载含 `anchor` 时直接 return，导致不更新内存与 UI；同时 `WebSocketAdapter` 仅桥接 `ANCHOR.CREATE` 到后端，未处理 `create:completed` 回流，二者叠加显示为“无反应”。
- 修复：
  - `PDFAnchorFeature` 兼容两种触发：
    1) UI 负载 `{ anchor }` 必须包含合法 `uuid`，缺失/非法直接报错（不再补齐）；即时刷新 UI；
    2) 无负载（快捷创建）仅此路径允许生成 `uuid`，刷新 UI，随后以 `__fromFeature=true` 转发到 WS。
  - 保持“禁止兜底”：异常 toast 告警并记录 warn，不做静默降级。
- 验收：
  - 点击“添加”→ 输入合法名称/页码/位置 → 确认后，列表应立即出现新锚点；控制台/日志无错误；
  - 删除/修改动作仍可用；
  - 发往 WS 的 `ANCHOR.CREATE` 负载应包含 `uuid`（UI 自带或快捷创建由特性生成）。
- 执行步骤（本次已按序完成）：复现→改造事件处理→补充冒烟测试→运行局部 Jest→更新文档与日志。

---

## 关键模块与函数（检索入口）
- 前端 WebSocket：
  - `src/frontend/common/ws/ws-client.js`：消息分发（RESPONSE/ERROR）；`VALID_MESSAGE_TYPES`。
  - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`：消费 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`；`#handleViewerNavigate()`。
- Viewer UI 与管理：
  - `src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js`：标题更新与统一 toast。
  - `src/frontend/pdf-viewer/features/pdf-outline/index.js`：目录与书签导航。
  - `src/frontend/pdf-viewer/pyqt/main_window.py`：注入脚本、消息透传。
- 启动与会话：
  - `src/backend/launcher_core/session_registry.py`：窗口注册/激活。
  - `src/launcher/runner.py`：`ensure_*_hosted()`。
  - `src/backend/msgCenter_server/standard_server.py`：`pdf-viewer:register/navigate` 的注册与定向转发。
- 协议与 Schema：
  - `docs/SPEC/schemas/msgcenter/.../navigate.request.schema.json`
  - `docs/SPEC/SPEC-HEAD-pdf-viewer.json`

---

## 快速检查与日志
- 期望日志（示例关键字）：
  - `[Injected] info request sent for title`
  - `Header title updated from DB`
  - `[UIManagerCore] 标题已从数据库更新`
  - toast 错误关键字：`...:failed` / `websocket:message:error`
- 路径参考：
  - `dist/latest/logs/pdf-viewer-*-js.log`

---

## 变更记录
- 2025-10-29：大幅精简 context.md（≤300 行目标），全部历史移至 `context.archive.md`；补充约束与检索入口；不涉及代码架构或 API 变更。
- 2025-10-29：在《architecture.md》新增“无兜底原则（Fail-Fast）”章节，明确禁止任何默认回退；前端以 toast 呈现错误并记录结构化日志，后端统一返回 `*:failed` 与纠正信息。

---

## 使用提示
- 修改本文件前，请先阅读：
  - `docs/SPEC/SPEC-HEAD-pdf-viewer.json`（模块规范头）
  - `todo-and-doing/readme.md`（任务目录规范）
- 长文或阶段总结请直接写入：
  - `.kilocode/rules/memory-bank/architecture.md`
  - `.kilocode/rules/memory-bank/tech.md`
  - `.kilocode/rules/memory-bank/product.md`
  - `.kilocode/rules/memory-bank/tasks.md`

### 12) 2025-11-01 — Toast 与日志不一致分析（URLJumpDispatcher/URLNavigationFeature）
- 现象：前端出现 toast 警告/错误，但在日志文件中难以定位；或 toast 的严重级别与日志级别不一致。
- 原因：
  1) URLJumpDispatcher 把调试信息（如 outlineId 检查与 parsed keys）用 logger.info 携带 { toast: { type: 'error'|'warn' } } 强行弹窗；导致“信息级日志 + 错误级 toast”的错位；
  2) URLNavigationFeature 多处直接调用 notification.showError/showSuccess（不经 logger）→ toast 仅在 UI 出现，不进入 JS 日志；
- 文件定位：
  - src/frontend/pdf-viewer/features/url-navigation/components/url-jump-dispatcher.js（第 54、58、105 行附近）
  - src/frontend/pdf-viewer/features/url-navigation/index.js（第 304/307/323 行）
- 建议：
  - 将 URLJumpDispatcher 的调试型日志移除 toast，仅保留 console；或降级为 debug；
  - 统一通过 logger.*(..., { toast }) 触发 toast，或在 notification.js 内补记日志，保证“有 toast 就有日志”。
