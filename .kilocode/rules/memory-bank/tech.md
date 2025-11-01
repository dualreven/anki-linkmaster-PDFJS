# 技术规范（清理版）

> 目录（快速索引）
- [命名规范](#命名规范)
- [文件 I/O 规范](#文件-io-规范)
- [前端日志规范](#前端日志规范)
- [后端日志规范](#后端日志规范)
- [数据库路径解析规范（2025-10-13 更新：参数式，无环境变量）](#数据库路径解析规范2025-10-13-更新参数式无环境变量)
- [前端基础设施](#前端基础设施)
- [构建与运行/生产静态路由/路径调整](#构建与运行生产静态路由路径调整)
- [事件与功能开关/命名调整/契约更新](#事件与功能开关命名调整契约更新)
- [UI/Toast/剪贴板与 Hosted 初始化](#uitoast剪贴板与-hosted-初始化)
- [Babel/Vite/AI Launcher](#babelviteai-launcher)

## Feature 重命名过渡策略（SCOPE_ID + 别名） — 2025-11-01
- 背景：逐步统一特性命名（如 `{layer}-{domain}[-{capability}]`）时，需要保持事件作用域与依赖装配零行为变更。
- 设计：
  - 事件作用域解耦：每个 Feature 可声明 `static SCOPE_ID = "<legacy-scope>"`；FeatureRegistry 在创建 `scopedEventBus` 时优先取 `SCOPE_ID`，与 `Feature.name` 解耦。
  - 别名映射：FeatureRegistry 支持 `aliases: Record<oldName,string>`，在 `register/has/get/install/拓扑排序/依赖检查` 全路径统一走 `#resolveName()`。
  - 兜底要求：如特性内自行创建作用域事件总线，必须使用 `this.constructor?.SCOPE_ID || this.SCOPE_ID || this.name` 作为 scope。
- 约束：
  - 禁止别名环（A→B, B→A）；当前实现只做一次映射，不解析链路。
  - 重复注册：若旧名与新名映射到同一规范名，重复注册将抛出 “already registered”。
- 测试：
  - `src/frontend/common/micro-service/__tests__/feature-registry.aliases.test.js`
  - `src/frontend/common/micro-service/__tests__/feature-scoped-bus.scopeid.test.js`
- 迁移步骤（建议）：
  1) 给使用 ScopedEventBus 的特性声明 `SCOPE_ID`（annotation 已完成）。
  2) 在装配根（创建 FeatureRegistry 处）按需注入 `aliases`（仅在过渡期）。
  3) 单测/冒烟通过后，再开始批量重命名与依赖文本替换。

### 用法补充（2025-10-28）— pdf_library_api 书签兼容输出
- 过渡期策略：API 门面对外仍按历史契约输出 `pageNumber` 字段，内部（DB）存储统一为 `pageAt/position`；
- 保存时严格校验：仅接受 `pageNumber`（≥1）与 `position`（0~100），禁止旧字段 `region/type`；
- 迁移建议：前端尽快切换到 `pageAt/position`，完成后可去除门面层兼容映射。
> 最近更新（10条，按日期倒序）
- 2025-11-01 启动器导航互斥：新建窗口仅用 URL 导航；已存在窗口仅用 WS 导航；禁止双通路并发
- 2025-11-01 Logger 增强：新增 Feature/模块级 toast 过滤策略（setToastPolicy/getToastPolicy/setDefaultToastEnabled）；URLNavigationFeature 统一用 logger+toast 出提示（保障“有 toast 必有日志”）

## SMOKE-RUN-POLICY（冒烟测试运行约定）
- 目标：在 1–2 分钟内验证关键用户旅程未回归；不求全、求快。
- 触发条件（任一成立必须运行）：
  - 影响 URL/WS 契约、viewer 启动参数、导航逻辑；
  - 变更 Outline/Bookmark/Anchor/Annotation 任一；
  - 影响 dist 构建或静态资源映射；
  - 影响 logger/Toast 治理策略。
- 目录与命名：
  - 每个插件/Feature 维护 `__smoke__/` 目录，例如：`src/frontend/pdf-viewer/features/<feature>/__smoke__/xxx_smoke.py`；
  - 跨 Feature 的旅程用例：`src/frontend/pdf-viewer/__smoke__/`；
  - 后端模块比照：`src/backend/<module>/__smoke__/`。
- 统一入口：
  - `python -X utf8 scripts/smoke.py` 运行全部；
  - `python -X utf8 scripts/smoke.py --feature pdf-viewer` 只跑匹配路径；
  - 报告输出：`AItemp/reports/smoke-YYYYMMDDhhmmss.md`，并在提交说明中附 `Smoke: ok/failed + Report: <path>`。
- 当前内置最小集（可扩展）：
  - `pdf-viewer/__smoke__/mutual_exclusive_nav_smoke.py`（后端互斥决策）；
  - `pdf-viewer/__smoke__/url_builder_pdf_id_smoke.py`（URL 构造必须包含 pdf-id）。
- 2025-10-26 pdf-home 启动端口严格校验：缺失 `vite/msgCenter/pdfFile`（dev）或缺失 `msgCenter/pdfFile`（prod）直接抛错；禁止 URL 中出现 `:None`
- 2025-10-26 Backend 路径严格化：后端仅接受参数传入的 `logs_dir/data_dir/db_path/static_dir/pdfs_dir`；移除所有回退/自动推断；HTTP 与 WS 服务器均按参数运行
- 2025-10-25 Annotation（截图）后端扩容：`PDFAnnotationTablePlugin` 允许并持久化 `rectPercent/canvasPixelSize/markerColor`，刷新后定位稳定
- 2025-10-26 截图严格模式：仅接受 `rectPercent`，移除所有基于 `rect/boundingBox` 的前端回退；后端保存不再要求 `rect`
- 2025-10-26 运行时 Schema 校验：`standard_server` 在路由前对 `*:requested` 入站消息按本仓库 schemas 目录统一校验，校验失败直接返回 `*:failed`
- 2025-10-25 强制 Outline：viewer 启动始终装配 `pdf-outline`，移除 Bookmark 回退与 URL/LocalStorage 开关影响；GUI “启用 Outline”开关已停用/隐藏
- 2025-10-25 修复 Anchor 订阅：对 URL/FILE/RENDER/ANCHOR/NAVIGATION 等订阅统一加 `safeOn` 防御；避免传入 `undefined` 触发 EventBus 白名单错误
- 2025-10-20 Outline 点击改为按ID导航事件：侧边栏点击发射 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`，由 Feature 层统一消费
- 2025-10-20 书签严格模式（后端）：仅接受 `pageAt/position`，移除 `pageNumber/region` 兼容与自动迁移；缺失 `pageAt` 直接报错
- 2025-10-19 书签/大纲严格模式：仅 pageAt/position，旧字段不兼容；无效即报错
- 2025-10-20 后端书签Schema统一：pageAt/position（移除 pageNumber/region/type）
- 2025-10-19 OutlineSidebarUI 适配统一字段 pageAt/position（重要）
- 2025-10-19 Outline（大纲）节点ID规范与“按ID导航”事件（新增）
- 2025-10-19 截图标注延迟渲染（新增）
- 2025-10-18 消息契约（更新）
- 2025-10-18 标注渲染加载策略（更新）
- 2025-10-16 启动/端口/Vite 管理集中（更新）
- 2025-10-15 GUI 运行约定（更新）
- 2025-10-14 日志目录与文件（更新）
- 2025-10-14 PDF-Home 启动回退；Hosted 初始化顺序（更新）
- 2025-10-13 数据库路径解析规范（更新）
- 2025-10-12 后端数据库路径解析与参数（更新）
- 2025-10-10 构建与运行；生产静态路由；路径调整（更新）
- 2025-10-09 前端 Toast 统一规范；截图/快捷操作统一（更新）

本文件汇总当前权威的技术与使用规范，过时内容已清理。

## TEST-EVOLVE-POLICY（测试何时更新）
- 原则：测试是“契约的可执行表达”。只有当“契约”被有意修改时，测试才应随之修改；重构不应改变契约。
- 触发“必须改测试”的变更：
  - 公开 API/函数签名/返回结构调整（含异常类型与错误码）；
  - 事件命名/载荷 schema/Topic 变更（例如 `annotation:create:requested` → 新事件名）；
  - URL/查询参数契约（如 `pdf-id/outline-item-id`）；
  - 数据库存储 schema 与迁移脚本；
  - 用户可见行为/文案/可感知日志策略（等级、feature 分类是否 toast）。
- 不应改测试的情况：
  - 仅内部实现替换（函数拆分/合并、依赖重排、私有方法命名、import 路径）；
  - 性能优化、并发控制、缓存引入但“可观察行为”不变；
  - 日志内容细节（文本/顺序）变化，但等级与分类未变；建议测试断言“等级与分类”，非全文匹配。
- 本仓库建议：
  - 端到端/冒烟：以“关键事件/日志信号”断言（ready/created/completed/jump:success），避免依赖 DOM 细节；
  - 单元：避免断言私有实现；通过可观察接口或 spy 计数断言交互；
  - Logger/Toast：所有 toast 必须来源 `logger.*(..., { toast })`；测试断言 `feature` + `level` 是否触发与是否被策略过滤。

## Jest 配置要点（前端）
- 目的：在 Node/Jest（CJS）环境下运行 ESM 源码，并屏蔽 `import.meta/env` 差异。
- 约定：
  - `jest.config.js` 使用 `babel-jest` 转换，`moduleNameMapper` 将任意 `*logger.js` 映射到 `tests/__mocks__/logger.js`；
  - `babel.config.js` 在测试环境包含 `@babel/preset-env({ modules:'commonjs' })`，并启用 `babel-plugin-transform-import-meta`（`{ module:'CommonJS' }`）。
  - jsdom 环境下的 DOM 依赖最小化：测试只构造必要节点（如 `main`, `#viewerContainer`, `.page[data-page-number]`）。

## Toast 使用规范 v2（统一入口 + Lint）
- 引擎依赖：`izitoast`（仅适配器内部直接依赖）。
- 公共入口（业务代码仅允许二选一）：
  - Logger：`import { getLogger } from 'src/frontend/common/utils/logger.js'`
    - 用法：`getLogger('Module').error('消息', { toast: { type: 'error', ms: 4000 } })`
  - Notification：`import { showError, showSuccess, showInfo, showInfoWithId, dismissById } from 'src/frontend/common/utils/notification.js'`
- 禁止事项：
- 任何功能代码直接导入 `common/utils/thirdparty-toast.js`（静态或动态 `import()`）；
  - 使用 `alert(...)`；
  - 直接使用第三方全局（如 `iziToast.*`）或私造 DOM/样式实现 toast；
- Lint 守护：
  - 自定义规则 `custom/no-direct-toast-import`: 禁止直接导入 `thirdparty-toast.js`（白名单仅限适配器与公共封装）；
  - 自定义规则 `custom/no-izi-toast-global`: 禁止直接使用 `iziToast` 或从 `izitoast` 导入；
  - 自定义规则 `custom/notification-allowed-apis`: 限定 `notification.js` 仅允许导入 `showInfo/showSuccess/showError/showInfoWithId/dismissById/hideAll`，禁止默认导入与别名；

## WebSocket 心跳契约（2025-10-30 新增）
- 事件常量：
  - 前端：`system:heartbeat:requested` / `system:heartbeat:completed`（见 `event-constants.js`）；
  - 后端：`MessageType.HEARTBEAT_REQUESTED/COMPLETED`（路由 `system:heartbeat:requested` → handlers.misc.heartbeat）。
- 发送用法：
  - 通过 `WSClient.request()` 或便捷方法 `WSClient.sendHeartbeat(timeout=4000)`；
  - 必须包含 `metadata: { version: '1.0.0' }`；
  - 严禁任何兜底或静默成功。
- 入站处理：
  - `WSClient` 将 `system:heartbeat:completed` 纳入兼容白名单，收到后按 `request_id` 结算 pending；
  - 非白名单事件将触发 `websocket:message:error` 并拒收（Fail-Fast）。
  - 自定义规则 `custom/no-dynamic-notification-import`: 禁止对 `notification.js/thirdparty-toast.js` 使用动态 `import()`；
  - 自定义规则 `custom/logger-toast-shape`（默认 warn）：校验 `logger.*(..., { toast })` 的结构（允许 `true` 或 `{ type, ms }`）；
  - 启用 `no-alert: error`：彻底禁止 `alert()`；
  - 过渡策略：按“error”执行，增量修复历史代码；必要时对个别遗留文件临时 `// eslint-disable-next-line` 并在任务中清零。

## 命名迁移指南：bookmark → outline（2025-10-21 新增）
- 目标：在“对外契约稳定”的前提下，逐步把视觉与模块命名从 bookmark 过渡到 outline。
- 禁止事项：严禁直接全局替换 `bookmark(s)` 为 `outline(s)`；需采用别名与灰度策略。
- 契约原则：
  - 事件：继续对外暴露 `PDF_VIEWER_EVENTS.BOOKMARK.*`；允许新增 `PDF_VIEWER_EVENTS.OUTLINE.*` 作为别名常量（指向相同值）。
  - 字段：接受 `{ outlineItemId | bookmarkId | id }`，内部统一映射 `outlineItemId`；反向发射事件/URL 时优先使用 `outlineItemId`。
  - 容器：保留 `bookmarkManager` 等键；可额外注册 `outlineManager` 作为同义别名。
- 路由：保留 `/api/pdf-viewer/bookmark/*`；可为新调用侧提供 `/outline/*` 别名，指向同一服务。
- 数据：数据库表/插件文件名不改动，不做重命名迁移。
- 灰度开关：
  - 在 `app-bootstrap-feature` 中通过 localStorage/URL 参数启用 `PDFOutlineFeature` 与 `OutlineSidebarUI`，默认关闭以保障稳定。
  - 必配观测项：跳转正确率（按ID/按页）、错误率、首次渲染时间、事件耗时 P95/P99。
- 回滚策略：开关关闭即回退到 `PDFBookmarkFeature + BookmarkSidebarUI` 路径；事件/路由/数据无破坏性变更。
  
### 后端“别名”决策（2025-10-21 更新）
- 决策：默认不提供 `/outline/*` 或 `outline:*` 消息/路由别名，保持 bookmark 命名为唯一对外协议主语。
- 理由：当前前端主要经由 WebSocket 与 `pdf_library_api` 的 bookmark 服务交互，引入别名收益有限且增加维护面。
- 例外：仅当外部生态强制要求统一术语或避免冲突时，再评估是否添加只读别名，并明确弃用周期。

### 前端开关（2025-10-25 调整：停用）
- 现状：已废止 bookmark 回路与开关判定，viewer 启动固定注册 `PDFOutlineFeature`（见 `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`）。
- GUI：`gui_launcher.py` 的“启用 Outline”复选框已禁用并隐藏；不再写入 `logs/debug-info.json` 或向 URL 透传 `outline/debug`。
- 兼容性：对外事件契约仍沿用 `PDF_VIEWER_EVENTS.BOOKMARK.*`（Outline 外壳复用）；侧边栏按钮文案与 id 保持兼容。
- 说明：`feature-flags.js:isOutlineEnabled()` 与 `?debug=1` 预检逻辑对装配决策不再生效；后续如需恢复灰度策略，再引入 `PreflightFeature` 实现集中预检与下发。

### 侧边栏选择（2025-10-25 调整）
- `features/sidebar-manager/real-sidebars.js` 固定 `useOutline = true`，优先加载 `OutlineSidebarUI`；若加载失败，出于可用性临时回退 `BookmarkSidebarUI` 并打印 `warn`。

## 命名规范
- 目录统一使用 kebab-case：示例 `pdf-home`、`pdf-viewer`。
- 禁止使用 `pdf_home`（snake_case）。

## 文件 I/O 规范
- 所有文件读写必须显式指定 UTF-8 编码（Python `encoding='utf-8'`；PowerShell `-Encoding UTF8`）。
- 确保换行 `\n` 正确；按会话覆盖写场景使用 `mode='w'`。

## 前端日志规范
- 通过 QtWebEngine 远端调试（DevTools）捕获前端控制台：
  - pdf-home：写入 `logs/pdf-home-js.log`
  - pdf-viewer：写入 `logs/pdf-viewer-<pdf-id>-js.log`
- JS 层可使用共享 Logger 输出到控制台；由 Python 捕获程序写入日志（UTF-8）。

消息契约（2025-10-18 更新）
- 已移除 legacy `pdf_loaded` WebSocket 消息（此前仅作旁路日志用途，后端无消费）；
- 替代路径：
  - 连接建立时：`pdf-viewer:register:requested`（VIEWER_REGISTER_REQUESTED）；
  - 文件加载成功后：`pdf-library:record-update:requested`（PDF_LIBRARY_RECORD_UPDATE_REQUESTED，更新 visited_at/last_accessed_at）；
  - 其他：`page_changed`、`zoom_changed` 保持不变（若后续需要也可转为三段式）。

日志治理（配置项与默认）
- 生产默认：`WARN` 级别、事件采样 20%、JSON 不美化
- 运行时可通过 localStorage 调整（无需改代码）：
  - `LOG_LEVEL`: `debug|info|warn|error`
  - `LOG_EVENT_SAMPLE_RATE`: `0~1`（例如 `0.2`）
  - `LOG_RATE_LIMIT`: `messages,intervalMs`（如 `100,1000`）
  - `LOG_DEDUP_WINDOW_MS`: 重复折叠窗口毫秒
  - `LOG_EVENT_MAX_JSON`: 事件 JSON 最大长度
  - `LOG_EVENT_PRETTY`: `true|false`
  
编程方式（可在 Bootstrap 中设置）
```js
import { configureLogger, LogLevel, setModuleLogLevel } from 'src/frontend/common/utils/logger.js';
configureLogger({ globalLevel: LogLevel.INFO, rateLimit: { messages: 60, intervalMs: 1000 }, event: { sampleRate: 0.5 } });
setModuleLogLevel('Feature.annotation', LogLevel.WARN);
```

## 后端日志规范
- 统一使用 Python `logging`，显式 UTF-8；必要时采用覆盖写并确保行尾正确。

### 日志目录与文件（2025-10-14 更新）
- 日志根目录：默认 `logs/`；GUI 在调用 `ai_launcher start` 时注入 `--logs-dir`，确保与 GUI “日志目录”一致；
- 主要文件：
  - `logs/gui-launcher.log`（GUI 启动器界面日志，已启用落盘）
  - `logs/ai-launcher.log`（顶层编排器）
  - `logs/backend-launcher.log`（后端启动器）
  - `logs/ws-server.log`（WebSocket 服务）
  - `logs/http-server*.log`（HTTP 文件服务：启动/请求/主日志）
  - `logs/pdf-home.log`（pdf-home 应用）
  - `logs/pdf-home-js.log`（pdf-home 前端 JS 控制台）
  - `logs/pdf-viewer-*.log`、`logs/pdf-viewer-*-js.log`
  - `logs/runtime-ports.json`、`*-process-info.json`（状态文件）

### GUI 运行约定（2025-10-15 更新）
- 组件根解析（自动）：
  - 以 gui_launcher.py 自身为起点，寻找最近包含 `src/` 的上层目录作为 `component_root`；
  - `sys.path` 前置 `component_root` 与其 `src/`；优先 `ai_launcher`，失败回退 `ai_launcher_dist`。
- 前端生产/开发：
  - 由“前端生产模式”复选框控制；
  - 生产（--prod）：页面从 HTTP 静态路由加载；
  - 开发（--vite-port <n>）：页面从 Vite URL 加载。
  - Hosted 启动 pdf-home：仅在开发模式下尝试探测/拉起 Vite；生产模式不触发任何 Vite 相关动作（避免误用 dev 端口）。
- 目录与端口：
  - 日志默认 `<component_root>/logs`；
  - 数据、静态、PDF 库路径可在 UI 中显式指定；
  - 端口（vite|ws|http）可在 UI 中指定；运行时实际端口写入 `runtime-ports.json`。
  - 2025-10-26 补充：GUI 启动时总是以“参数形式”显式传入 `data_dir/db_path/static_dir/pdfs_dir/logs_dir` 到后端/前端启动链路；gui_launcher 内部不再使用任何路径回退（例如 `or (_COMPONENT_ROOT / 'logs')`）。

### 启动/端口/Vite 管理集中（2025-10-16 更新）
- 统一入口：
  - 端口文件：`src/launcher/ports.py`（读/写 runtime-ports.json、dev-process-info.json）
  - Vite 启动：`src/launcher/dev_server.py.ensure_vite()`（优先 ai_launcher，回退 pnpm）
  - CLI 启动：`src/launcher/runner.py`（`start_backend_cli`、`start_pdf_home_cli`、`start_pdf_viewer_cli`）
- GUI 仅组装 `LauncherConfig` 并调用 `runner`；不直接写运行时状态文件。

### GUI 启动器 → PDF-Viewer 参数映射（2025-10-18 更新）
- Hosted Tab 新增输入：
  - `pdfanchor-id` → 映射为前端 URL 参数 `anchor-id`（通过 `LaunchConfig.anchor_id` 或 CLI `--anchor-id`）
  - `pdfannotation-id` → 映射为前端 URL 参数 `annotation-id`（通过 `LaunchConfig.annotation_id` 或 CLI `--annotation-id`）
  - `pdfoutline-item-id` → 现已贯通到前端，映射为 URL 参数 `outline-item-id`
    - CLI：`--outline-item-id <id>`
    - Hosted：通过 `LaunchConfig.extra_params = { outline_item_id: '<id>' }` 注入，前端 launcher 追加到 URL
- 代码位置：
  - `gui_launcher.py`: `_create_hosted_tab()`、`_start_pdf_viewer_hosted()`、`LauncherThread._start_pdf_viewer()`
  - `src/launcher/runner.py`: `start_pdf_viewer_hosted/cli` 扩展签名并透传参数

### 标注渲染加载策略（截图标注延迟渲染，2025-10-19 新增）
- 背景：在“标注数据加载完成”时，目标页的 PageView/Canvas 可能尚未渲染，导致 `ScreenshotTool.renderScreenshotMarker()` 直接返回、后续不再重试；
- 改进：
  - `ScreenshotTool` 引入队列 `pendingMarkersByPage`；
  - 绑定 PDF.js `pagerendered` 事件，在对应页渲染完成后刷新待渲染截图标记；
  - `#handleAnnotationsLoaded` 调整为“就绪即渲染，否则入队”；
  - 仍保留当 `rectPercent` 缺失时基于 `rect` 的 MutationObserver 兜底以等待 canvas 出现。

### 截图标注数据契约（2025-10-25 更新）
- 后端表插件：`src/backend/database/plugins/pdf_annotation_plugin.py`
  - 允许并持久化的字段：\n
    - 必填：`rectPercent{xPercent,yPercent,widthPercent,heightPercent}`, `imagePath`, `imageHash`\n
    - 可选：`imageData`, `description`, `canvasPixelSize{width,height}`, `markerColor`\n
  - 校验：`rectPercent` 各值限定 [0,100]；`canvasPixelSize.width/height` 为正数；`markerColor` 为 `#rrggbb`。\n
- 前端使用策略：\n
  - 渲染严格依赖 `rectPercent`；缺失即报错并放弃渲染；\n
  - 不再进行 `rect/canvas/boundingBox` 的回退换算；\n
  - `canvasPixelSize` 仅作为调试信息可选保存。\n

### 运行时 Schema 校验（2025-10-26 新增）

### PDF Anchor 创建契约（2025-10-30 新增, 2025-10-30 晚修订）
- 事件：`PDF_VIEWER_EVENTS.ANCHOR.CREATE`（`anchor:create:requested`）
- 触发方式（两种皆可，推荐方式A）：
  - A. UI 侧带负载：`{ anchor: { uuid: 'pdfanchor-<12hex>', name: string, page_at: number, position?: number(0~100|0~1) } }`
    - 必须包含合法 `uuid`；若缺失/非法，前端直接报错（禁止补齐/兜底）；
    - `position` 若传入 0~100，将在入库前归一化到 0~1（适配器处理）。
  - B. 无负载（快捷创建，仅此路径允许生成 ID）：特性层采样当前位置并生成 `uuid`，随后以 `__fromFeature=true` 转发同名事件交由 WS 持久化。
- UI 刷新：由 `PDFAnchorFeature` 在本地 Map 更新后统一 `emit(ANCHOR.DATA.LOADED, { anchors })`，侧边栏订阅此事件刷新表格。
- 禁止兜底：任一异常即时 toast 告警并记录 warn，不做静默降级或字段推断。
- 路径解析：`todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas/<domain>/v1/messages/<action>.request.schema.json`\n
- 校验范围：所有 `*:requested` 入站消息；未找到 schema 的消息跳过且记录；\n
- 失败处理：直接返回 `*:failed`，错误类型 `SCHEMA_VALIDATION_FAILED`；\n
- 实现位置：`src/backend/msgCenter_server/standard_server.py::_validate_message_by_schema/_jsonschema_validate`。\n

### 注释卡片跳转严格化（2025-10-29 新增；2025-10-30 完成工具端替换）
- 全局契约事件：`PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED`（`JUMP_TO` 为别名）必须使用 `eventBus.emitGlobal(...)` 触发，监听使用 `onGlobal(...)`；禁止局部 `emit()`。
- 守卫：`src/frontend/common/event/scoped-event-bus.js` 对上述事件的局部 `emit()` 直接 `logger.error + toast` 并抛异常。
- 侧边栏委托：`AnnotationSidebarUI` 的 `.jump-btn` 点击统一发射全局 `JUMP_REQUESTED`；移除 URL 导航兜底路径。
- 工具迁移（已实施）：TextHighlight / Comment / Screenshot 工具的标注跳转已由局部 `emit()` 改为 `emitGlobal()`；点击三类卡片能触发全局监听链路。


## 数据库路径解析规范（2025-10-13 更新：参数式，无环境变量）
- 参数式 API：`src/backend/database/config.py`
  - `compute_component_root(runtime_mode, ankiaddon_root_path?)`
  - `compute_data_dir(runtime_mode, ankiaddon_root_path?)`
  - `compute_db_path(runtime_mode, ankiaddon_root_path?)`
- 运行模式：
  - anki：传 `runtime_mode='anki'` 与 `anki_root_path=<addon-root>`；
    - 组件根：`<addon-root>/lib/pdf_sys`
    - 数据目录：`<addon-root>/lib/pdf_sys/data`
  - single：传 `runtime_mode='single'`；
    - 组件根：`<PROJECT_ROOT>`
    - 数据目录：`<PROJECT_ROOT>/data`
- 服务端用法：
  - `StandardWebSocketServer(..., runtime_mode, ankiaddon_root_path, data_dir?, db_path?, static_dir?, pdfs_dir?)`
  - `EmbedMsgCenterServer(..., runtime_mode, ankiaddon_root_path, data_dir?, db_path?)`
  - `BackendLauncher(parent_app, ..., runtime_mode, ankiaddon_root_path, data_dir?, db_path?, static_dir?, pdfs_dir?)`
  - CLI（WS）：`python -m src.backend.msgCenter_server.standard_server --port 8765 --runtime-mode single|anki [--ankiaddon-root-path <path>] [--data-dir <dir>] [--db-path <file>] [--static-dir <dir>] [--pdfs-dir <dir>]`
  - CLI（Launcher）：`python src/backend/launcher.py start --runtime-mode single|anki [--ankiaddon-root-path <path>] [--data-dir <dir>] [--db-path <file>] [--static-dir <dir>] [--pdfs-dir <dir>]`
  - CLI（ai_launcher）：`python ai_launcher.py start --module pdf-home --runtime-mode single [--data-dir <dir>] [--db-path <file>] [--static-dir <dir>] [--pdfs-dir <dir>]`
- 兼容：
  - `get_data_dir()/get_db_path()` 默认走 single（PROJECT_ROOT/data），可用 `set_data_dir()/set_db_path()` 覆盖；
  - 不再使用任何环境变量作为定位依据。

## 前端基础设施
- 统一依赖 `src/frontend/common/*`：
  - `event/event-bus.js`
  - `utils/logger.js`
  - `ws/ws-client.js`
- QWebChannel 逻辑由前端管理（如 `src/frontend/pdf-home/qwebchannel-manager.js`）。

### Qt 剪贴板回退（2025-10-09）
### PDF-Home 启动回退（2025-10-14）
- 场景：环境未安装 QtWebEngine（`QWebEngineView=None`），无法在 Qt 窗口内嵌前端。
- 行为：`src/frontend/pdf-home/launcher.py` 在构建 URL 后检测 `self.window.web_view`，若为空则调用 `webbrowser.open(url)` 在系统默认浏览器打开；状态栏同步提示“未检测到 QtWebEngine，已在默认浏览器打开：<url>”。
- 影响：
  - QWebChannel 桥接若无 `web_page` 将记录警告但不阻断；
  - JSConsoleLogger 仍初始化，但仅在嵌入式模式下通过 `javaScriptConsoleMessage` 捕获；外部浏览器模式下不捕获 JS 控制台到 `logs/pdf-home-js.log`（可忽略）。
- 无需额外配置；行为自动生效。

### Hosted QtWebEngine 初始化顺序（2025-10-14）
- 目的：在 Hosted（同进程）模式下稳定创建 QWebEngineView。
- 要点：
  - 在创建 `QApplication` 之前设置 `QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts, True)`；
  - 预导入 `PyQt6.QtWebEngineCore` 与 `PyQt6.QtWebEngineWidgets`；
  - 如需，`QApplication` 创建后可预创建一次 `QWebEngineView` 以稳定 WebEngine 插件链（可选）。
- 代码位置：`gui_launcher.py` 的 `main()` 内已实现上述预引导；
- 运行时自愈：`src/frontend/pdf-home/main_window.py` 在 `_init_ui()` 局部选择 WebEngine 类（先 compat，再直导入兜底），避免早期值拷贝导入为 None。
- 适用场景：Clipboard API 不可用或用户手势校验导致失败时，前端通过 QWebChannel 调用 Python 槽设置系统剪贴板。
- Python 端：`src/frontend/pdf-viewer/pyqt/pdf_viewer_bridge.py#setClipboardText(text: str) -> bool`
- JS 端：
  - `features/pdf-anchor/components/anchor-sidebar-ui.js` 的 `copyTextRobust(text, label)` 在 Clipboard API 与 `execCommand('copy')` 失败后，尝试：
    ```js
    new QWebChannel(qt.webChannelTransport, (channel) => {
      channel.objects.pdfViewerBridge.setClipboardText(String(text));
    });
    ```
  - `features/pdf-anchor/index.js` 的 `#copyToClipboard(id)` 同步增加同样回退；
  - 依赖：PyQt 主窗体在加载完成后自动注入 `qwebchannel.js`。

### 搜索透传参数（2025-10-07）
- `search:query:requested` 支持可选字段透传至 WS：
  - `sort`: 例如 `[{ field: 'visited_at', direction: 'desc' }]`
  - `pagination`: 例如 `{ limit: 0, offset: 0, need_total: true }`（`limit=0` 表示全量）
  - `focusId`: 例如 `'abc123'`，用于结果渲染后聚焦并滚动到特定条目
- 由 `SearchManager` 构建消息：`data = { query, tokens, sort?, pagination? }`
- 由 `SearchManager` 在 `search:results:updated` 中回传 `{ focusId }`，供 `SearchResultsFeature` 聚焦并 `scrollIntoView`
- 典型用法：侧边栏“最近阅读”点击 → 触发“按 visited_at 降序 + SQL LIMIT 截断”的搜索，并在结果中高亮/定位到点击的条目

### SQL 截断优化（2025-10-07）
- 对于“无关键词 + sort=visited_at desc + 无 filters”的请求，截断在 SQL 层执行：
  - 插件：`PDFInfoTablePlugin.query_all_by_visited(limit, offset)`，`ORDER BY visited_at DESC LIMIT ? OFFSET ?`
  - API：`PDFLibraryAPI.search_records(payload)` 优先分支匹配上述模式时，走插件方法，必要时通过 `count_all()` 获取总数
  - 目的：避免加载全量后在内存中切片，提高性能与响应速度

## 事件与功能开关变更（2025-10-07）
- 启用 `pdf-home` 的 `header` 功能（`config/feature-flags.json` → `header.enabled = true`）。

## Outline（大纲）节点与导航（2025-10-19 新增）
- 节点 ID 规范
  - 新增节点采用：`outlineItem-<8位Base64URL>`，例如 `outlineItem-1aB_CdEf`；
  - 生成规则：6 字节随机源，经 Base64 编码为 8 字符，并进行 URL-safe 处理（`+`→`-`，`/`→`_`，去除`=`）；来源：`features/pdf-bookmark/models/bookmark.js`。
  - 兼容：历史 ID（如 `bookmark-...`）仍可在存储/渲染中使用，但推荐逐步迁移为新前缀。
- “按ID导航”事件
  - 新事件：`PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`（`pdf-viewer:bookmark-navigate-by-id:requested`）；
  - 负载：`{ outlineItemId: string }`（兼容 `{ id }` 或 `{ bookmarkId }`）；
  - 消费方：`features/pdf-bookmark/index.js`（找到对应节点 → 复用点击导航流程 → 调用 `navigationService.navigateTo`）；
  - 成功/失败：继续复用 `BOOKMARK.NAVIGATE.SUCCESS/FAILED`。

### 统一数据模型（破坏性更新 2025-10-19）
- 模型统一：Bookmark 统一为“页码 + 位置百分比”
  - `pageAt: number`（1-based）
  - `position: number|null`（0~100，null 表示未指定）
  - 移除：`type/region/pageNumber`
  - 文件：`features/pdf-bookmark/models/bookmark.js`
- 导入规则（无 DB 大纲时从 PDF 原生导入）：
  - 解析 `dest` → `resolvePdfDest(pdfDocument, dest)` 得到 `{ pageNumber, x,y,zoom }`
  - 位置百分比估算：`yToPositionPercent(pdfDocument, pageAt, y)`；失败则置 `null`
  - 文件：`features/pdf-bookmark/index.js`（`#parseBookmarkNormalizedDest`）与 `pdf/pdf-dest-utils.js`
- 导航优先使用：`bookmark.pageAt/position`；旧数据仍可通过 `dest` 解析兜底
- UI：对话框改为 `name/pageAt/position` 三项，移除“类型/区域”输入
- 排序按钮事件统一使用三段式 `*:requested`：
  - `header:sort:requested`
  - `search:sort:requested`
  - 旧的 `*:clicked` 命名不再使用（测试与文档已同步更新）。

## 测试与命令（2025-10-25 新增）
- 冒烟测试（Jest，前端）：`pnpm test:smoke`（仅匹配 `__smoke__` 目录；执行极快、不依赖真实网络/GUI）
- 冒烟测试（PyTest，后端）：`pytest -m smoke -q`（根级 `pytest.ini` 已注册 `smoke` 标记）
- 全量测试：
  - 前端：`pnpm test`；
  - 后端：`pytest -q`；
- 预提交建议：`pnpm run test:pre-commit && pytest -m smoke -q`（先依赖图/快测，再按需跑全量）。

## 事件命名调整（2025-10-10）
- pdf-home（侧边栏与最近搜索）本地事件统一为三段式：
  - `search:clicked` → `search:item:clicked`
  - `limit:changed` → `limit:value:changed`
  - `sidebar:toggled` → `sidebar:toggle:completed`
  - `pdf:clicked` → `pdf:item:clicked`
- 涉及文件：
  - `src/frontend/pdf-home/features/sidebar/components/sidebar-panel.js`
  - `src/frontend/pdf-home/features/sidebar/recent-searches/index.js`
  - `src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js`
  - `src/frontend/pdf-home/features/sidebar/recent-opened/feature.config.js`
  - `src/frontend/pdf-home/features/sidebar/recent-added/feature.config.js`

## 第三方 Toast 使用规范（pdf-home 添加流程）
- 依赖：`izitoast`（已加入 package.json）
- 统一通过适配器调用：`src/frontend/common/utils/thirdparty-toast.js`
  - `pending(id, message)`：右上角粘性提示（timeout: false），需后续 `dismissById(id)` 关闭
  - `success(message, ms=3000)`：成功提示
  - `warning(message, ms=4000)`：警告提示
  - `error(message, ms=5000)`：错误提示
  - `dismissById(id)`：关闭 `pending(id)` 创建的提示
- 样式：适配器内部已 `import 'izitoast/dist/css/iziToast.min.css'`，无需重复引入
- 位置：统一右上角（topRight），与既有规范一致
- 适用范围：当前仅在 `pdf-home` 的“添加 PDF”流程中使用；其他模块暂不修改

###（新增 2025-10-17）pdf-home 全局 WS 错误 → toast 透传
- 位置：`src/frontend/pdf-home/core/pdf-home-app-v2.js`
- 监听事件：
  - `WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED` → `toast.error('<type>: <msg>')`
  - `WEBSOCKET_MESSAGE_EVENTS.ERROR` → 从 `payload.message/error_message/error.code/data.message` 提取文案
  - 兜底：在 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED` 中捕获所有以 `:failed` 结尾的 `type`，toast 错误
- 适配器：`src/frontend/common/utils/thirdparty-toast.js`（iziToast；固定右上角；提供降级 DOM）
- 目的：统一 pdf-home 的错误可视化体验，与 pdf-viewer 保持一致，减少定位成本

###（新增 2025-10-17）pdf-viewer 注册消息与事件白名单更新
- 变更：
  - `src/frontend/common/event/event-constants.js`
    - 新增 `WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_COMPLETED = "pdf-viewer:register:completed"`
    - 新增 `WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_FAILED = "pdf-viewer:register:failed"`
  - `src/frontend/common/ws/ws-client.js`
    - `VALID_MESSAGE_TYPES` 追加允许入站：
      - `pdf-viewer:register:completed`、`pdf-viewer:register:failed`
      - `pdf-viewer:navigate:requested|completed|failed`
  - `src/frontend/common/event/pdf-viewer-constants.js`
    - 新增 VIEW_MODE 组：
      - `pdf-viewer:render-mode:changed`

###（新增 2025-10-18）PDF 目的地解析统一
- 新增工具：`src/frontend/pdf-viewer/pdf/pdf-dest-utils.js`
  - 导出 `resolvePdfDest(pdfDocument, dest)` → `{ pageNumber(1-based), x|null, y|null, zoom|null }`
  - 支持三类输入：
    - 字符串命名目的地：`pdfDocument.getDestination(name)`→数组→解析；
    - 数组：`[pageRef, destType, left, top, zoom]`（`pageRef` 为 number 时视为 0-based 索引，统一 +1）；
    - 页面引用对象：通过 `pdfDocument.getPageIndex(ref)+1`。
- 调整调用点：
  - `features/pdf-bookmark/index.js#parseBookmarkDest()` 改为调用上述工具（消除与旧解析的重复）；
  - `bookmark/bookmark-data-provider.js#parseDestination()` 改为调用上述工具，并修复“pageRef 为 number 未 +1”的偏移问题。
- 行为增强：
  - `ui/bookmark-sidebar-ui.js`、`features/pdf-outline/components/outline-sidebar-ui.js` 在具备 `region.scrollY`（百分比）时，向 `NAVIGATION.URL_PARAMS.REQUESTED` 一并传递 `position`，提升落点准确性；缺省仍为纯页级跳转。
  - 2025-10-19 修正（严格）：`features/pdf-outline/components/outline-sidebar-ui.js` 与 `ui/bookmark-sidebar-ui.js` 仅读取 `pageAt/position`；无效即报错并拒绝跳转；不再做 `pageNumber/region.scrollY` 的回退。
  - 2025-10-19 严格：`features/pdf-bookmark/models/bookmark.js` 去掉默认 `pageAt=1`；`fromJSON` 不再接受旧字段；`loadFromStorage` 跳过无效节点。
  - 2025-10-20 后端统一：`backend/api/pdf-viewer/bookmark/service.py` 的 `list_bookmarks/save_bookmarks` 读写 `pageAt/position`；兼容旧数据读取（pageNumber/region.scrollY→pageAt/position），写入仅保存 `pageAt/position`。


###（新增 2025-10-17）PDF.js 资源路径（生产）使用规范
- 构建脚本会在 `index.html` 注入：`window.__PDFJS_VENDOR_BASE__='/static/vendor/pdfjs-dist/'`；
- 运行时优先从该基址解析 PDF.js 资源：
  - `workerSrc = ${base}build/pdf.worker.min.mjs`
  - `cMapUrl = ${base}cmaps/`
  - `standardFontDataUrl = ${base}standard_fonts/`
- 回退策略（开发环境）：
  - 若未注入上述变量，则通过 `new URL('@pdfjs/...', import.meta.url).href` 解析（依赖 Vite alias）。
- 受影响文件：
  - `src/frontend/pdf-viewer/features/pdf-reader/components/pdf-loader.js`
  - `src/frontend/pdf-viewer/features/pdf-reader/services/pdf-manager-service.js`
  - `src/frontend/pdf-viewer/pdf/pdf-config.js`
  - `src/frontend/pdf-viewer/pdf/pdf-loader.js`
- 目的：避免生产环境出现 `/static/@pdfjs/...` 404，统一走 `/static/vendor/pdfjs-dist/...`。

###（新增 2025-10-17）前端错误自动 Toast 策略
- 背景：仅 WS 错误会 toast，前端模块自身 `logger.error()` 默认不 toast；
- 方案：在 pdf-viewer 入口启用 Logger 的全局自动 toast，仅对 `error` 级别生效：
  - 位置：`src/frontend/pdf-viewer/main.js`
  - 代码：`enableAutoToast({ levels: [LogLevel.ERROR], defaultMs: 6000 })`
- 说明：
  - 仍可在单次日志调用时通过追加参数 `{ toast: true | { type, ms } }` 覆盖行为；
  - 可用 `window.disableAutoToast()` 临时关闭（开发调试）。
      - `pdf-viewer:mouse-mode:changed`

- 目的：
  - 避免后端返回 `pdf-viewer:register:completed` 被前端拦截为未注册类型，导致注册链路中断→ viewer 空白。
  - 将 UI 模式类事件纳入全局事件白名单，消除“未注册的全局事件”错误噪音。

###（新增 2025-10-25）outline=1 透传规范（WS 与 QWebChannel 一致）
- GUI 勾选“启用 Outline”后写入 `logs/debug-info.json: { outline: 1 }`；  
- 两条打开 viewer 路径都需统一把 `outline=1` 追加到 URL：  
  - QWebChannel：`src/frontend/pdf-home/pyqt-bridge.py` 读取 debug-info 并在 URL `&outline=1`；  
  - WebSocket：`src/backend/launcher.py (BackendLauncher)` 读取 debug-info / runtime-ports 并在调用 `start_pdf_viewer_hosted(..., enable_outline=True)` 时透传；前端 launcher 统一将 `&outline=1` 追加到 URL；  
- 前端判断：`common/utils/feature-flags.isOutlineEnabled()` 优先 URL 参数，其次 localStorage；  
- UI 提示：`pdf-viewer/bootstrap/app-bootstrap-feature.js` 检测到启用时 toast “当前为 Outline 模式”。
###（新增 2025-10-17）QtWebEngine 远程调试端口（Hosted 模式）
- 约束：同一进程只能启用一个 `QTWEBENGINE_REMOTE_DEBUGGING` 端口。
- 规范：
  - pdf-home 优先设置端口（默认 9222），并在启动前设置环境变量；
  - pdf-viewer 在创建 `QWebEngineView` 之前检测该环境变量：
    - 已存在 → 复用端口，并记录日志 `[RemoteDebug] 已检测到进程级端口，复用 ...`；
    - 不存在 → 设置 `self._remote_debug_port` （默认 9223，但在 Hosted 场景通常不会生效）。
- 效果：Hosted 下统一使用 pdf-home 端口（通常 9222）；Standalone 下各自设置。

### 标注保存策略（pdf-viewer / 2025-10-08）
- AnnotationManager 在创建标注时的保存路径：
  - 远端保存：当 `wsClient.isConnected()` 为 true 且已设置 `pdfId` 时，调用 WS 接口保存；
  - 本地回退：若未连接 WS 或未设置 `pdfId`，回退到本地 Mock 保存，确保 `ANNOTATION.CREATED` 事件仍然发出，侧边栏可及时展示。
- pdfId 的设置：
  - AnnotationFeature 监听 `NAVIGATION.URL_PARAMS.PARSED`（从 URL 解析到 `pdf-id`）与 `FILE.LOAD.SUCCESS`（从 `filename` 推断 id，去掉 .pdf 后缀），调用 `AnnotationManager.setPdfId()`；
  - 建议 pdf-viewer 启动带上 `?pdf-id=xxx`，避免依赖文件名推断。
- 验证方法：
  - 运行 `node AItemp/manual-tests/test-annotation-create-fallback.mjs`，应输出 `[OK] CREATED emitted with screenshot annotation`；
- 界面手测：截图→保存→侧边栏出现新标注卡片。

## WebSocket 消息白名单与路由（annotation 案例 / 2025-10-08）

- 白名单 vs 路由：白名单只负责“放行”（event-constants.js），路由（ws-client.js）负责“命名与结算”。缺任一都会出问题。
- 必做：新增功能域消息时，同时补充白名单与 switch-case 路由分支，让 `*:completed/*:failed` 能触发 `_settlePendingRequest`。
- 类型规范：三段式小写（例：`annotation:list:completed`），前后端需完全一致。
- 详情参见：`docs/TECH/WS-MESSAGE-ROUTING-GUIDE.md`

## 启动与编排（AI Launcher）
- 模块化服务管理：
  - `ai-scripts/ai_launcher/core/service_manager.py`
  - `ai-scripts/ai_launcher/core/process_manager.py`
  - `ai-scripts/ai_launcher/cli/command_parser.py`
- 示例服务：
  - `services/persistent/ws_service.py`：WebSocket 转发器
  - `services/persistent/pdf_service.py`：HTTP 文件服务器
  - `services/persistent/npm_service.py`：Vite 开发服务器
- 示例入口：`ai-scripts/ai_launcher/example_run.py`（支持 `start/stop/status`）

## AI Launcher 使用方法（ai_launcher.py）

### 概述
- **主要入口**：项目根目录的 `ai_launcher.py`
- **功能**：统一管理前后端服务的生命周期（Vite开发服务器 + WebSocket服务器 + HTTP文件服务器 + 前端窗口）
- **重要原则**：⚠️ 在AI自动化开发环境中，严禁直接运行 `npm run dev` 或 `python app.py`，必须使用 `ai_launcher.py` 以避免终端阻塞

### 基本命令

#### 1. start - 启动服务
```bash
python ai_launcher.py start [选项]
```

**服务启动顺序**：
1. Vite 开发服务器（端口 3000，可配置）
2. 后端服务器（WebSocket + HTTP 文件服务）
3. 前端模块窗口（pdf-home 或 pdf-viewer）

**命令行参数**：
- `--vite-port <端口号>` - 指定 Vite 开发服务器端口（默认：3000）
- `--msgServer-port <端口号>` - 指定 WebSocket 服务器端口（默认：8765）
- `--pdfFileServer-port <端口号>` - 指定 PDF 文件服务器端口（默认：8080）
- `--module <模块名>` - 指定启动的前端模块，可选值：
  - `pdf-home` - PDF 文件管理界面（列表、添加、删除）
  - `pdf-viewer` - PDF 阅读器界面（渲染、缩放、翻页）
- `--pdf-id <标识>` - 传给 pdf-viewer 的 PDF 文件标识（仅 pdf-viewer 模块使用）

**使用示例**：
```bash
# 启动 pdf-home 模块（默认端口）
python ai_launcher.py start --module pdf-home

# 启动 pdf-viewer 并打开指定 PDF
python ai_launcher.py start --module pdf-viewer --pdf-id 12345

# 自定义所有端口启动 pdf-home
python ai_launcher.py start --module pdf-home --vite-port 3001 --msgServer-port 8766 --pdfFileServer-port 8081

# 仅启动后端服务（不启动前端窗口）
python ai_launcher.py start
```

## 静态资源提供规则（参数式组件根，2025-10-14）
- 插件（Anki）环境：
  - 组件根：`<addon_root>/lib/pdf_sys`
  - 静态目录：仅 `<component_root>/static`
- 工程回退（桌面开发 / dist）：
  - 优先 `<project_root>/dist/latest/static`，再 `<project_root>/static`，最后 `<project_root>`（兜底）
- 路由：
  - `/pdf-viewer` 与 `/pdf-viewer/`：优先 `/static/pdf-viewer/index.html`
  - `/pdf-home` 与 `/pdf-home/`：优先 `/static/pdf-home/index.html`
- 资源重写：
  - `/pdf-(home|viewer)/assets/*` → `/static/*`
  - `/js/*` → `/static/*`；`/pdf-(home|viewer)/js/*` → `/js/*`
  - `/pdf-(home|viewer)/config/*` → `/static/<module>/config/*`
- MIME 修正：`.js|.mjs → text/javascript`、`.css → text/css`


#### 2. stop - 停止服务
```bash
python ai_launcher.py stop
```

**功能**：按顺序停止所有正在运行的服务
1. 前端模块窗口
2. Vite 开发服务器

## Anki 插件事件桥接（可选）

模块：`src/integrations/anki_event_bridge.py`

- 用途：在 Anki 插件环境中订阅插件侧事件总线（`hjp_linkmaster_dev.lib.common_tools.event_bus`），接收“打开 pdf-viewer / 打开 pdf-home”请求并启动对应窗口。
- 事件命名（与本仓对齐）：
  - 打开 viewer：`pdf-library:open:viewer`（兼容 `open_pdf` / `pdf-library:viewer:requested`）
  - 打开 home：`pdf-library:open:home`
- 插件侧用法：
  ```python
  from src.integrations.anki_event_bridge import setup_bridge
  setup_bridge()  # 若 event_bus 可导入，则自动订阅 request 通道
  ```
- payload 示例：
  ```python
  { 'type': 'pdf-library:open:viewer', 'data': { 'file_id': 'sample', 'viewer_options': { 'page': 5, 'position': 50, 'anchor_id': 'pdfanchor-test' } } }
  { 'type': 'pdf-library:open:home', 'data': {} }
  ```

## Integrations 构建脚本

脚本：`build.integrations.py`

- 作用：将 `src/integrations` 复制到目标构建目录（默认 `dist/latest/src/integrations`），并输出元信息 JSON（UTF-8 + \n）。
- 用法：
  ```bash
  python build.integrations.py --dist dist/latest --clean
  ```
- 说明：默认还会确保 `dist/latest/logs` 目录存在（桥接模块日志目录）。

### 与 rebuilda_all 集成
- 在 `rebuilda_all.py:build_all()` 中，已追加：
  ```bash
  python -X utf8 build.integrations.py --dist dist/latest --clean
  ```
- 因此执行 `python rebuilda_all.py` 的构建流程后，产物将包含：
  - `dist/latest/src/integrations/*`
  - `dist/latest/build.integrations.meta.json`
3. 后端服务器

**清理操作**：
- 杀死所有相关进程
- 清理进程信息文件（`logs/dev-process-info.json`, `logs/frontend-process-info.json`）
- 记录停止日志到 `logs/ai-launcher.log`

#### 3. status - 查看状态
```bash
python ai_launcher.py status
```

## 后端数据库路径解析与参数（2025-10-12 更新）

- 默认数据库位置：
  - 源码运行：`<repo>/data/anki_linkmaster.db`
  - dist 运行：`<repo>/dist/latest/data/anki_linkmaster.db`
  - Anki 插件（lib/pdf_sys）：`<anki_addons>/.../lib/pdf_sys/data/anki_linkmaster.db`
- 解析规则（优先级）：
  1) 模块路径在 `dist/latest/src` 或 `pdf_sys/src` 下 → 使用其根目录；
  2) 否则，若 CWD 向上可找到 `dist/latest` 或 `pdf_sys` → 使用该目录；
  3) 否则回退 `<repo>`；
  最终与 `data/anki_linkmaster.db` 拼接。
- 参数传递（覆盖路径）：
  - Python API：`PDFLibraryAPI(db_path='绝对路径')`
  - 嵌入式 WS 服务器：`EmbedMsgCenterServer(db_path='绝对路径')`
  - 标准 WS 服务器（子进程）：`python -m src.backend.msgCenter_server.standard_server --port 8765 --db-path 绝对路径`
  - 后端启动器（Hosted）：`BackendLauncher(parent_app=..., db_path='绝对路径')`

**输出信息**：
- Vite 开发服务器状态（PID、端口、运行时间）
- 前端模块状态（模块名、PID、启动参数）
- 后端服务器状态（WebSocket 端口、HTTP 端口、健康状态）

### 端口配置

**优先级**（从高到低）：
1. 命令行参数（`--vite-port` 等）
2. 运行时配置文件（`logs/runtime-ports.json`）
3. Vite 日志文件（`logs/npm-dev-vite.log`）
4. 默认值（Vite: 3000, WebSocket: 8765, HTTP: 8080）
5. 可用性自动探测（如果默认端口被占用）

**端口冲突处理**：
- 自动检测端口占用

## 构建系统（Step1：后端 / 2025-10-10）
- 脚本：`build.backend.py`
- 目标：将后端源码发布到 `dist/latest/`，用于后续打包与运行。
- 复制内容：
  - `src/backend` → `dist/latest/src/backend`
  - `core_utils` → `dist/latest/core_utils`
  - 创建 `dist/latest/logs/`
- 忽略清单：`__pycache__/ .pytest_cache/ .git/ .venv/ .vscode/ node_modules/ dist/ build/ coverage/ __tests__/ tests/`；文件后缀：`.pyc/.pyo/.pyd/.log`
- 运行：
  - `python build.backend.py --clean`（清理并重建 `dist/latest/`）
  - `python build.backend.py --dist dist/latest`（自定义输出目录）
- 说明：`src/backend/launcher.py` 会通过其父级目录两次向上解析 `project_root`，因此将 `core_utils` 与 `logs` 置于 `dist/latest/` 根即可满足相对路径依赖。

## 构建系统（Step2：前端 / 2025-10-10）
- 脚本：`build.frontend.py`
- 目标：以 Vite 多入口（pdf-home / pdf-viewer）构建前端静态资源到 `dist/latest/`，并复制 `pdfjs-dist` 为独立 vendor；在 HTML 中注入 `window.__PDFJS_VENDOR_BASE__='./vendor/pdfjs-dist/'`。
- 构建：使用本地 `node_modules/.bin/vite` 优先，其次 `pnpm exec vite`；参数 `--base=./ --outDir dist/latest`。
- 复制：`node_modules/pdfjs-dist/**` → `dist/latest/vendor/pdfjs-dist/**`。
- 注入：对以下文件进行注入（存在则注入，幂等）：
  - `dist/latest/pdf-viewer/index.html`
  - `dist/latest/pdf-viewer.html`
  - `dist/latest/pdf-home/index.html`
  - `dist/latest/pdf-home.html`
- 元数据：`dist/latest/build.frontend.meta.json`（UTF-8；记录 vendor 复制统计与注入列表）。
- 运行：
  - `python build.frontend.py --out-dir dist/latest --skip-install`
  - 跳过构建仅执行复制/注入：`python build.frontend.py --out-dir dist/latest --skip-build`

### 前端 Python 目录结构复制（2025-10-10）
- 复制到 `dist/latest/src/frontend/**`，用于从 dist 直接以 Python 启动器运行：
  - `src/frontend/pyqtui/**` → `dist/latest/src/frontend/pyqtui/**`
  - `src/frontend/pdf-home/**` → `dist/latest/src/frontend/pdf-home/**`
  - `src/frontend/pdf-viewer/pyqt/**` → `dist/latest/src/frontend/pdf-viewer/pyqt/**`
  - `src/frontend/pdf-viewer/launcher.py` → `dist/latest/src/frontend/pdf-viewer/launcher.py`
- 启动（生产模式）：
  - `python dist/latest/src/frontend/pdf-home/launcher.py --prod`
  - `python dist/latest/src/frontend/pdf-viewer/launcher.py --prod --pdf-id sample`

- 尝试杀死占用端口的旧进程
- 如果无法释放，自动选择可用端口

### 状态文件

#### logs/dev-process-info.json
记录 Vite 开发服务器进程信息：
```json
{
  "pid": 12345,
  "port": 3000,
  "command": "pnpm run dev -- --port 3000",
  "started_at": "2025-10-01T20:00:00"
}
```

#### logs/frontend-process-info.json
记录前端模块进程信息：
```json
{
  "module": "pdf-home",
  "pid": 12346,
  "ws_port": 8765,
  "vite_port": 3000,
  "pdf_port": 8080,
  "pdf_id": null,
  "started_at": "2025-10-01T20:00:05"
}
```

#### logs/runtime-ports.json
运行时端口配置（持久化）：
```json
{
  "vite": 3000,
  "websocket": 8765,
  "http": 8080
}
```

---

## PDF-Home 搜索与筛选补充（2025-10-07）

- SearchManager 负责透传 query/tokens，并支持可选的 `filters`/`sort`/`pagination`。
- FilterFeature 负责构建高级条件，应用后通过 `filter:state:updated` 更新全局状态。
- RecentSearchesFeature 会持久化最近搜索词到配置（config-read/write）。

### 已存搜索条件（SavedFilters）用法变更
- 原“搜索栏上的‘保存条件’按钮”已移除。
- 通过侧边栏“📌 已存搜索条件”的“＋”保存当前搜索条件：
  - 内容：关键词 `searchText`、筛选 `filters`、排序 `sort`；
  - 持久化：`pdf-library:config-write:requested → data/pdf-home-config.json.saved_filters`；
  - 应用：点击保存项 → 填充搜索框 → 发送 `filter:state:updated` → `search:query:requested`（含 filters/sort）。

#### logs/ai-launcher.log
启动器运行日志（UTF-8 编码）：
```
[2025-10-01 20:00:00] [INFO] Starting AI Launcher...
[2025-10-01 20:00:01] [INFO] Vite server started on port 3000 (PID: 12345)
[2025-10-01 20:00:02] [INFO] Backend services started
[2025-10-01 20:00:05] [INFO] Frontend module 'pdf-home' started (PID: 12346)
```

### 参数映射关系

ai_launcher.py 会自动将参数映射到各个服务：

| ai_launcher 参数 | 后端服务参数 | 前端模块参数 |
|-----------------|------------|------------|
| `--msgServer-port` | `--ws-port` | `--ws-port` |
| `--pdfFileServer-port` | `--http-port` | `--pdf-port` |
| `--vite-port` | - | `--vite-port` |
| `--pdf-id` | - | 不传递（内部使用） |

### 故障排查

**常见问题**：

1. **端口被占用**
   ```bash
   # 查看端口占用
   python ai_launcher.py status
   # 停止所有服务释放端口
   python ai_launcher.py stop
   ```

## 稳定性治理操作要点
- 契约（CDC）
  - 事件/消息负载以 JSON Schema 维护于 `docs/schema/events/*.schema.json`；
  - Producer/Consumer 各自提供契约测试于 `tests/contract/`；若任一契约失败，阻断合并；
  - Schema 版本策略：新增字段→向后兼容；字段移除/语义变更→标记弃用并提供兼容窗口与迁移指引。
- 回归基线（BCT）
  - `tests/bct/` 维护关键用户旅程用例（搜索分页与截断一致、双击打开 viewer、书签增删不影响其他分支、pdf-edit 保存成功与 Toast）；
  - 基线失败视为回归，必须先修复（或回滚）后再合并其他变更。
- 合并门禁（CI）
  - 变更需通过：契约（CDC）+ 基线（BCT）+ 冒烟（BVT）；
  - 小步提交与特性开关：不稳定功能默认关闭，在开关关闭路径保证兼容；
  - 多 worktree 并行时，建议按“模块边界”拆分 PR，避免跨域耦合。
- 可观测性
  - 统一 UTF-8 结构化日志；统计事件失败率、Schema 校验失败计数；
  - 关键错误（P0/P1）触发告警并支持一键回滚/关闭开关。

2. **Vite 启动失败**
   ```bash
   # 查看详细日志
   cat logs/npm-dev.log
   # 检查 node_modules 是否完整
   pnpm install
   ```

3. **前端窗口无法启动**
   ```bash
   # 查看启动器日志
   cat logs/ai-launcher.log
   # 检查 Python 虚拟环境
   python --version
   ```

4. **WebSocket 连接失败**
   ```bash
   # 查看后端日志
   cat logs/websocket-server.log
   # 确认 WebSocket 服务器正在运行
   python ai_launcher.py status
   ```

### 开发最佳实践

1. **开发前**：`python ai_launcher.py start --module <模块名>`
2. **开发中**：`python ai_launcher.py status` 检查服务状态
3. **遇到问题**：查看 `logs/ai-launcher.log` 和各服务日志
4. **开发后**：`python ai_launcher.py stop` 停止所有服务
5. **切换模块**：先 `stop`，再 `start --module <新模块>`

## PyQt 窗口生命周期策略（重要）
- 关闭行为：所有前端窗口（尤其是 `pdf-viewer`）必须设置 `WA_DeleteOnClose`，确保用户关闭窗口时对象被销毁，触发 `destroyed` 信号，便于宿主侧（如 `pdf-home`）清理 `viewer_windows` 映射。
- 设置方式（统一通过兼容层）：
  - `from src.qt.compat import QtCore`
  - `self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)`（PyQt6）；如不兼容，回退 `QtCore.Qt.WA_DeleteOnClose`
- 映射清理：`pyqt-bridge.py` 必须同时保留两条清理路径：
  - `viewer.destroyed.connect(lambda: pop(...))`
  - 打开前检查 `existing.isVisible()`，不可见则先移除再重建
- 目的：避免“关闭后再次打开需双击两次”的错误体验，提升窗口生命周期一致性。

### AI 开发环境特别注意

⚠️ **严禁直接运行以下命令**（会导致终端阻塞）：
- `npm run dev`
- `python app.py`
- `python src/backend/main.py`
- `python src/frontend/pdf-home/launcher.py`

✅ **正确做法**：
```bash
# 统一使用 ai_launcher.py
python ai_launcher.py start --module pdf-home
```

**原因**：
- 直接运行会占用终端，无法进行 AI 自动化操作
- ai_launcher.py 会在后台启动服务，记录进程信息
- 支持进程管理、日志收集、优雅停止等功能

## 测试与可运行性
- 每个模块需提供独立运行与最小验证路径：
  - 前端应用：独立 launcher + 日志文件检查。
  - WebSocket 转发：指令回环/路由测试。
  - HTTP 文件服：健康检查 + Range 请求测试。
  - Launcher：服务 `start/stop/status` 冒烟测试。

## Worktree 环境（Windows / PowerShell）
- Node 包管理：优先 `pnpm`，设置共享 store（示例 `C:\\pnpm-store`），在各 worktree 使用 `pnpm install --frozen-lockfile`；可选 Yarn Berry(PnP)。
- Node 版本：`nvm-windows` + `.nvmrc` 固定版本；结合 `direnv` 或终端集成自动切换。
- Python 虚拟环境：在仓库外集中创建 venv（如 `C:\\venvs\\anki-linkmaster-PDFJS`），按分支差异可创建多个；进入 worktree 时激活。
- 自动激活：可选 `direnv`/`posh-direnv` 实现进入目录即激活 Node/venv。
- Git worktree 配置：使用 `git config --worktree` 进行工作树本地化配置与 hooks 隔离。


## JS 控制台日志捕获（QtWebSocket 替代方案）
- 位置：`src/frontend/pdf-home/js_console_logger.py`
- 实现：通过 `QWebSocket` 连接 QtWebEngine DevTools 的 `webSocketDebuggerUrl`，监听 `textMessageReceived` 事件。
- 启动方式：在 `src/frontend/pdf-home/launcher.py` 中通过 `QTimer.singleShot(2000, ...)` 延迟初始化，确保运行在 Qt 主线程。
- 依赖：不再依赖第三方 `websocket-client`；仍使用 HTTP 请求读取 `http://localhost:<debugPort>/json` 获取目标。
- 日志：写入 `logs/pdf-home-js.log`，显式 UTF-8 编码，逐行写入并确保换行 `\n`。

## Babel/Vite 配置要点（2025-09-26）
- vite 使用 `vite-plugin-babel`，通过 `babelConfig.configFile = path.resolve(process.cwd(), 'babel.config.js')` 显式指定配置文件路径。
- `babel.config.js` 改为 ESM `import` 直接引入插件对象，避免字符串插件名在 Windows/虚拟路径解析失败。
- 顶层 devDependencies 必须包含：
  - `@babel/plugin-transform-private-methods`
  - `@babel/plugin-transform-class-properties`
  - `@babel/plugin-transform-optional-chaining`
  - `@babel/plugin-transform-nullish-coalescing-operator`
  - `@babel/plugin-syntax-dynamic-import`
- 验证脚本：
  - `node scripts/test-import-babel-plugin.mjs`
  - `node scripts/test-babel-transform.mjs`
## AI Launcher Vite 日志增强（2025-09-26）
- `ProcessManager.start(..., check_delay=0.5)`：默认在启动后短延迟检查子进程退出，若异常退出会清理 PID 并将尾部日志写入 `ai-launcher.process.<service>`。
- `ProcessManager.tail_log(lines=20)`：用于服务在失败时读取日志尾部摘要。
- `NpmDevServerService`
  - 日志文件固定为 `logs/npm-dev.log`（UTF-8）。
  - 失败时通过 logger `ai-launcher.service.npm-dev` 输出摘要，提示查看对应日志。
- 新增自动化测试 `tests/ai_launcher/test_process_manager.py` 验证上述逻辑。- npm-dev 服务改动（2025-09-26）
  - `ProcessManager.start` 新增 `env` 参数并在 Windows 下继续使用 UTF-8 日志；启动后若子进程快速退出会记录尾部输出。
  - `NpmDevServerService` 传入 `NO_COLOR=1`, `FORCE_COLOR=0`, `CLICOLOR{,_FORCE}=0`, `VITE_FORCE_COLOR=0`，并在启动后调用 ANSI 转义清理（`logs/npm-dev.log` 保持无色）。
  - 自动化覆盖见 `tests/ai_launcher/test_process_manager.py`。
## pdf-viewer 启动诊断同步 (2025-09-26)
- launcher.py 支持新的 CLI:
  - --diagnose-only：跳过 Qt 事件循环，输出 JSON 诊断。
  - --disable-webchannel / --disable-websocket / --disable-js-console / --disable-frontend-load：分别屏蔽组件。
- 诊断输出格式：components.<name> = { enabled, executed, note }。
- 配套测试：python ai-scripts/tests/test_pdf_viewer_launcher_diagnose.py。
- 推荐排查：先 --diagnose-only --disable-js-console 验证 JS 日志线程，再逐项恢复。

### 2025-10-05 PDFCardFeature 使用说明
- 入口：src/frontend/pdf-viewer/features/pdf-card/index.js 注册 PDFCardFeature
- 依赖：通过依赖容器暴露 cardSidebarUI，SidebarManager 的 
eal-sidebars.js 首次打开时调用 container.get('cardSidebarUI')
- Feature 注册顺序：需在 pp-bootstrap-feature.js 中放在 SidebarManagerFeature 之前，保证侧栏可获取 UI
- UI 类：CardSidebarUI 提供 initialize(container)、getContentElement()，并监听 PDF_CARD.LOAD.SUCCESS

### 2025-10-05 PDFInfoTablePlugin 使用说明
- 模块：src/backend/database/plugins/pdf_info_plugin.py，需搭配 Stage1 SQLExecutor 与 Stage2 EventBus。
- 构造：PDFInfoTablePlugin(executor, event_bus, logger=None)，启用前调用 enable() 以创建表和索引。
- 事件：发布事件命名统一为 	able:pdf-info:<action>:<status>；订阅时务必使用连字符版本（EventBus 不接受下划线）。
- 核心接口：
  - alidate_data(data)：按规范校验 uuid/title/时间戳/json_data。
  - CRUD：insert / update / delete / query_by_id / query_all(limit, offset)。
  - 扩展：search(keyword, fields=None, limit=50)、ilter_by_tags(tags, match_mode='any')、ilter_by_rating(min_rating, max_rating)、get_visible_pdfs()、update_reading_stats(uuid, reading_time_delta)、dd_tag(uuid, tag)、
emove_tag(uuid, tag)、get_statistics()。
- 测试：运行 pytest src/backend/database/plugins/__tests__/test_pdf_info_plugin.py（32 用例，覆盖建表/验证/CRUD/事件）。
- 样例数据：plugins/__tests__/fixtures/pdf_info_samples.py 提供 make_pdf_info_sample/make_bulk_samples 工具，便于生成标准化输入。
### 2025-10-05 PDFAnnotationTablePlugin 使用说明
- 模块：src/backend/database/plugins/pdf_annotation_plugin.py。
- 启用：先启用 PDFInfoTablePlugin 并插入 pdf_uuid，再实例化 PDFAnnotationTablePlugin(executor, event_bus, logger) 调用 enable()。
- 支持类型：screenshot / 	ext-highlight / comment，分别要求 rect/imagePath/imageHash、selectedText/textRanges/highlightColor、position/content 等字段。
- 常用方法：
  - query_by_pdf(pdf_uuid) / query_by_page(pdf_uuid, page_number) / query_by_type(pdf_uuid, ann_type)。
  - count_by_pdf(pdf_uuid) / count_by_type(pdf_uuid, ann_type)。
  - delete_by_pdf(pdf_uuid)（触发事件 	able:pdf-annotation:delete:completed）。
  - dd_comment(ann_id, content) / 
emove_comment(ann_id, comment_id)。
- 事件：启用时自动订阅 	able:pdf-info:delete:completed 并级联删除标注。订阅者 ID：pdf-annotation-plugin-<id>。
- 测试：运行 pytest src/backend/database/plugins/__tests__/test_pdf_annotation_plugin.py（44 用例）。

### 2025-10-05 PDFBookmarkTablePlugin 使用说明
- 模块：`src/backend/database/plugins/pdf_bookmark_plugin.py`。
- 依赖：启用前需先启用 `PDFInfoTablePlugin`，保持 pdf_uuid 存在；事件命名为 `table:pdf-bookmark:*:*`。
- 数据要求：`json_data` 含 `name/type/pageNumber`，`type=region` 时必须提供 `region.scrollX/scrollY/zoom`；`children` 为递归数组。
- 常用接口：`query_by_pdf`、`query_root_bookmarks`、`query_by_page`、`count_by_pdf`、`delete_by_pdf`、`add_child_bookmark`、`remove_child_bookmark`、`reorder_bookmarks`、`flatten_bookmarks`。
- 树操作：`add_child_bookmark` 自动设置 `parentId/order` 并更新父节点；`reorder_bookmarks` 根据 ordered_ids 更新 `order` 字段；`flatten_bookmarks` 返回附带 `level` 的扁平列表。
- 测试命令：`pytest src/backend/database/plugins/__tests__/test_pdf_bookmark_plugin.py`（39 用例）。

### 2025-10-05 SearchConditionTablePlugin 使用说明
- 模块：`src/backend/database/plugins/search_condition_plugin.py`。
- 条件类型：`fuzzy`(keywords/searchFields/matchMode)、`field`(field/operator/value)、`composite`(operator+conditions)。
- 排序模式：`mode=0` 默认；`mode=1` 需 `manual_order`；`mode=2` 需 `multi_sort` 列表；`mode=3` 需 `weighted_sort.formula`。
- 扩展接口：`query_by_name`、`query_enabled`、`increment_use_count`、`set_last_used`、`activate_exclusive`、`query_by_tag`、`search_by_keyword`。
- 事件：`table:search-condition:create|update|delete:completed`。
- 测试：`pytest src/backend/database/plugins/__tests__/test_search_condition_plugin.py`（29 用例）。
- 2025-10-05：新增 `PDFLibraryAPI`，提供 `list_records/get_record_detail/update_record/delete_record/register_file_info`，单位为秒/毫秒转换遵循 JSON-MESSAGE-FORMAT-001，WebSocket `pdf-library:list:records` 消息返回 `records`。

## 2025-10-05 Annotation事件规范
- AnnotationFeature 缺省使用 ScopedEventBus，跨模块交互统一经 `emitGlobal/onGlobal`。
- PDF_VIEWER_EVENTS 新增注解导航 SUCCESS/FAILED、侧边栏辅助按钮及通知错误常量，CRUD 失败常量也需使用同名常量调用。
- 工具类（Comment/Screenshot/TextHighlight）与 AnnotationManager/Event UI 必须引用常量，不得再硬编码字符串事件。
- 2025-10-05: AnnotationSidebarUI 卡片头部新增删除按钮，通过 `PDF_VIEWER_EVENTS.ANNOTATION.DELETE` 触发；TextSelectionQuickActionsFeature 在监听 `@annotation/annotation-tool:*` 时禁用快捷操作。
- 2025-10-05: 标注UI按钮表情化：QuickActionsToolbar 与 AnnotationSidebarUI 操作按钮改用 Unicode 表情，统一提供 aria-label/title 辅助文本。

### 2025-10-06 PDFLibraryAPI 扩展
- 新增接口：`list_bookmarks(pdf_uuid)` 返回 `{bookmarks, root_ids}`；`save_bookmarks(pdf_uuid, bookmarks, root_ids=None)` 负责树形书签覆盖写；`search_records(payload)` 支持多 token 权重排序 + 过滤 + 分页。
- 书签序列化：前端结构（含子节点）通过 `_flatten_bookmark_tree` 映射为 `pdf_bookmark` 行，`parentId`/`order` 与层级信息同步写入。
- 搜索逻辑：在内存层整合 title/author/notes/tags/subject/keywords，支持短语匹配（query），默认排序遵循 `match_score` → `updated_at`。
- 单测：`python -m pytest src/backend/api/__tests__/test_pdf_library_api.py`。
- WebSocket 消息扩展：`bookmark/list` -> data={pdf_uuid}，响应带 `bookmarks`/`root_ids`；`bookmark/save` -> data={pdf_uuid, bookmarks, root_ids}，成功返回 `saved` 数量，异常统一返回 `type=error`。
- WSClient 增强：提供 `request(type, payload, {timeout,maxRetries})` 泛化调用，维护 `_settlePendingRequest`，新增消息类型 `bookmark/list`、`bookmark/save` 及事件 `websocket:message:bookmark_list/save`；前端书签默认通过 `RemoteBookmarkStorage` 走 WebSocket，自动回落至 LocalStorage。

### 2025-10-06 加权排序公式构建器与搜索结果布局
- 校验：使用 `#hasFieldReference` 判断公式是否引用字段，floor(filename)/length(title) 等公式被视为合法。
- 搜索结果布局：`.search-results-container` 使用 `layout-single/double/triple` 类控制列数，按钮状态存储于 localStorage(`pdf-home:search-results:layout`)；布局按钮样式位于 search-results.css。

### 2025-10-06 PDFLibraryAPI.add_pdf_from_file 更新
- 新增 12 位十六进制 UUID 与 `<uuid>.pdf` 文件名校验，保持与 `StandardPDFManager` 副本策略一致。
- 默认优先调用 `StandardPDFManager` 并写表，失败时回滚并返回 `UPLOAD_FAILED`；当管理器禁用时回退至直接建表但仍记录原路径。
- 返回结构保持 `{success, uuid, filename, file_size|error}`，供 WebSocket 响应直接使用。
- WebSocket `handle_pdf_upload_request` 现透传 `PDFLibraryAPI` 结果，fallback 时解析 `(success, payload)` 元组并回传原始错误信息，前端可准确提示原因。
- `PDFManager.add_file` 现在在重复写入时直接发出"文件已存在于列表中"信号，Legacy 适配器即可透传该信息。

## 2025-10-06 PDF-Home 搜索 v001 变更说明
- 默认搜索字段：后端与前端均包含 `title, author, filename, tags, notes, subject, keywords`
- SQL 安全：统一使用参数绑定；所有 LIKE 条件采用 `ESCAPE '\\'` 语法并对 `%`、`_` 进行转义；tags 使用 JSON 文本包含匹配
- 事件契约：WebSocket `type: "pdf-library:search:records"`，响应 `status: "success"`，`data: { records, count, search_text }`
- UI 行为：SearchBar → SearchManager（发起 WS）→ SearchResultsFeature（渲染）；空搜索返回全部

## 2025-10-06 搜索语义（v001）
- 默认字段：title/author/filename/tags/notes/subject/keywords
- 关键词：按空格分词；关键词之间 AND；字段内 OR；LIKE 模糊匹配（转义 `%`、`_`，使用 `ESCAPE '\'`）
- UI 提示：SearchBar 占位符注明"空格=且"

### 日志策略更新（前端）
- EventBus：无订阅者日志→debug；websocket:message:received 默认 suppress。
- WSClient：type="response" 当作 ACK；仅 settle pending，不广播。
- ConsoleBridge：建议启用过滤规则，避免日志回环（下一步可加开关）。
- 代码风格：统一使用 getLogger().info/warn/error/debug，禁用裸 console.*。

## 前端脚本加载规范更新（PDF-Viewer）

- 归口：PDF-Viewer Assets
- 变更：src/frontend/pdf-viewer/assets/floating-controls.js 现使用 ES Module 语法（import getLogger）。
- 要求：在 src/frontend/pdf-viewer/index.html 中必须以模块方式加载：
  - <script type="module" src="assets/floating-controls.js"></script>
- 说明：统一使用项目 Logger，不得回退 console.*；如需在 HTML 直连脚本中使用 Logger，必须以模块脚本加载。

## 契约一致性与门禁（新增）
- 合并前必须先合入契约（docs/contracts/*）并通过评审。
- 响应消息需满足：事件名三段式映射至 type，且响应 status=success/error 与事件状态一致。
- 后续将提供轻量 Schema 校验脚本（前端/后端均本地可跑），未通过禁止合并。


- 当前契约样例位于: todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/schemas
- 规格说明: todo-and-doing/1 doing/20251006182000-bus-contract-capability-registry/v001-spec.md

- 新增脚本：scripts/validate_schemas.py（UTF-8-SIG 读取，检查Schema关键字段），建议在CI中执行。

## 新增：Annotation 域 WS 消息（v1）
- 请求：
  - nnotation:list:requested → data: { pdf_uuid }
  - nnotation:save:requested → data: { pdf_uuid, annotation }
  - nnotation:delete:requested → data: { ann_id }
- 响应：
  - nnotation:list:completed → data: { annotations: [], count }
  - nnotation:save:completed → data: { id, created?, updated? }
  - nnotation:delete:completed → data: { ok }
- 说明：前端 AnnotationManager 自动从 DI 容器获取 wsClient，可用即远程持久化；否则退化为 Mock。

## 代码格式化工具（2025-10-06）
- 使用 Prettier 统一批量格式化，配置文件 `.prettierrc.json`（100列、单引号、LF）。
- 默认忽略目录：`node_modules/`、`build/`、`dist/`、`logs/`、`AItemp/`、`todo-and-doing/`（见 `.prettierignore`）。
- 命令：
  - 写入格式：`pnpm run format`（封装 `scripts/run-prettier.mjs --write`，作用于 `src/`、`scripts/` 及根部配置文件）。
  - 校验：`pnpm run format:check`（同脚本 `--check`）。可用 `--pattern <glob>` 指定子集。
- 示例：`pnpm run format:check -- --pattern scripts/test-formatting-sample.js`
- 快速自测：`pnpm run test:format` 会在示例文件上执行 `format:check`，验证命令链路。


### 技术变更：Toast 方案
- 引入第三方库 iziToast 作为统一 toast 方案；废弃原先依赖 DOM 元素（#global-success/#global-error）的方式。
- 使用方法不变：
  - showSuccess(message, durationMs=3000)
  - showError(message, durationMs=5000)
  - showInfo(message, durationMs=3000)
  - hideAll()
- 实现位置：src/frontend/common/utils/notification.js（内部 import 'izitoast/dist/css/iziToast.min.css' 全局引入样式）
- 注意：duration=0 表示不自动关闭（iziToast 用 	imeout: false）。
# 技术变更记录（SQLite 搜索+筛选）

## UI 交互细则补充（2025-10-07）
- pdf-home 侧边栏（宽度 280px）展开时不得遮挡搜索结果区域：
  - 由 `SidebarContainer` 在交互层对 `.main-content` 施加行内样式，展开：`margin-left: 280px; width: calc(100% - 280px)`；收起：清空行内样式；
  - 首次渲染根据当前状态立即应用，避免初始遮挡。
  - 事件契约保持不变：仍发布 `sidebar:toggle:completed { collapsed: boolean }`。
  - 若后续统一改回纯 CSS，请在 `style.css` 内为 `.sidebar:not(.collapsed) + .main-content` 定义等效规则，并移除行内样式逻辑。

时间：2025-10-07 05:35

## 变更摘要
- 后端新增 `pdf_info_plugin.search_with_filters`：在 SQLite 内部执行“搜索 + 筛选”的 WHERE 条件。
- API/Service 统一使用以上方法收敛候选集，再在 Python 端计算 `match_score` 与分页，兼容既有排序与单测。
- WebSocket 路由 `pdf-library:search:requested` 负载扩展：可携带 `filters`、`sort`、`search_fields`。
- 前端 `SearchManager` 发送时传入 `filters`；`FilterBuilder` 输出与 SearchCondition 一致的条件对象；`FilterFeature` 将“应用筛选”改为触发后端搜索。

## 使用方式变更
- 前端触发搜索：
  - 原：`eventBus.emit('search:query:requested', { searchText })`
  - 新（可选条件）：`eventBus.emit('search:query:requested', { searchText, filters })`

## 注意事项
- `tags has_any` 使用 LIKE 近似匹配，后续可升级 FTS/虚表优化。
- `match_score` 排序仍在 Python 侧，若要纯 SQL 排序需设计打分公式或 FTS 排名函数。
## 书签存储一致性（pdf-viewer）
- 问题修复（2025-10-07）
  - saveToStorage 仅序列化“根节点树”（`rootIds -> tree`），不再将 Map 中所有节点作为顶层提交，避免后端将所有节点当作根导致覆盖写入异常。
  - loadFromStorage 递归将“根与所有子孙”写入内部 Map，保证 `getBookmark(id)` 可命中任意层级，排序/删除操作稳定。
- 验收基线
  - 删除根节点：仅该根及其子孙被移除；其它根不受影响；刷新后保持一致。
  - 删除子节点：仅该节点（及其子孙）被移除；父与同级以及其它根不受影响；刷新后保持一致。
### 大纲（原书签）拖拽排序索引策略（2025-10-08）
- UI 与数据层的配合：
  - UI 在 drop 事件中对同父情形计算 newIndex：`before => targetIndex`，`after => targetIndex + 1`；
  - 数据层（BookmarkManager.reorderBookmarks）在同父且 `oldIdx < targetIndex` 时执行一次左移修正（`targetIndex -= 1`），最终效果与语义保持一致；
- 这样可以消除“UI 与数据层双重修正”的叠加导致的偏移，避免回读后看起来“节点消失/跑飞”。
- 术语统一：UI 中文展示统一由“书签”改为“大纲”，事件常量与模块命名保持不变。

### 前端 Toast 统一规范（2025-10-09）
- pdf-viewer 模块内统一引用 `src/frontend/common/utils/*` 提供的 Toast：
  * `thirdparty-toast.js`：`pending/success/warning/error/dismissById`（右上角，带降级）
  * `notification.js`：`showInfo/showSuccess/showError/dismissById/hideAll`
- 约定：业务上 INFO 类提示使用 `notification.showInfo`，成功/警告/错误消息使用 `thirdparty-toast` 对应方法。
- 禁止在功能域内再实现 `#showToast` 或直接构建 Toast DOM（`toast.textContent = ...`）
- 测试：`src/frontend/pdf-viewer/__tests__/toast-usage.test.js` 用于守护此约定

### 截图标注跳转渲染兜底（2025-10-09）
- 兼容历史数据：当 screenshot 注释 data 无 `rectPercent` 但有 `rect` 时，前端在渲染前通过当前 canvas 尺寸换算百分比（`#convertCanvasToPercent`），保证跳转后仍能显示标记框；
- 定位计算：使用 `canvas.getBoundingClientRect()` 的大小并加上相对 `pageDiv` 的偏移，映射 `x/y/width/height`，避免缩放/布局导致的偏移误差；
- 颜色按钮：`MARKER_COLOR_PRESETS` 与 `DEFAULT_MARKER_COLOR` 保持可用，悬停删除按钮时出现颜色切换控件。

### 文本选择快捷操作（快速标注）路径大小写统一（2025-10-09）
- 模块解析在某些 HTTP/打包环境中大小写敏感，统一使用小写模块路径：`features/annotation/models/annotation.js`；
- 避免因同一路径大小写混用导致的重复实例/构造异常。

## 构建与运行（2025-10-10）
- 文档：BUILDING.md（与构建脚本同目录）
- 后端：
  - 构建：python -X utf8 build.backend.py
  - 启动：python -X utf8 dist/latest/src/backend/launcher.py start
- 前端（分模块构建）：
  - python -X utf8 build.frontend.pdf_home.py --out-dir dist/latest/pdf-home
  - python -X utf8 build.frontend.pdf_viewer.py --out-dir dist/latest/pdf-viewer
  - 两模块各自提供 ./assets 与 ./vendor（不共享），index.html 注入 window.__PDFJS_VENDOR_BASE__='./vendor/pdfjs-dist/'
- 生产启动：
  - pdf-home：python -X utf8 dist/latest/src/frontend/pdf-home/launcher.py --prod
- 调试与日志：dist/latest/logs/pdf-home-js.log、ackend-launcher.log、untime-ports.json
- 注意：不要使用 --emptyOutDir 清空 dist；所有 Python 命令以 UTF-8 执行。

## 生产静态路由（/pdf-home 与 /pdf-viewer）更新（2025-10-10）
- 新增：当请求为目录根但带查询串或无尾随斜杠时（如 /pdf-viewer?x=1、/pdf-viewer/?y=2），后端会自动映射到对应的 index.html 并保留原查询串；
- 支持两种构建布局：
  - 扁平：dist/latest/pdf-viewer/index.html
  - 嵌套：dist/latest/pdf-viewer/pdf-viewer/index.html
- 兼容配置路径重写：
  - /pdf-home/pdf-home/config/* → /pdf-home/config/*
  - /pdf-viewer/pdf-viewer/config/* → /pdf-viewer/config/*
- 影响：
  - 前端统一可以使用 http://127.0.0.1:{pdfFile_port}/pdf-viewer/?... 访问，无需关心实际 index.html 布局；
  - 开发模式下仍可回退到 http://localhost:{vite_port}/pdf-viewer/?...。

## 路由/构建输出路径调整（2025-10-10）
- 期望产物位置：dist/latest/src/frontend/pdf-viewer；
- 服务器路由：访问 /pdf-viewer/?... 时，自动映射到新目录的 index.html；若新目录不存在则回退到旧路径 dist/latest/pdf-viewer；
- 静态资源：若请求 /pdf-viewer/assets/* 且新目录存在，则改写到 /src/frontend/pdf-viewer/assets/*；
- 配置兼容：/pdf-viewer/pdf-viewer/config/* → /src/frontend/pdf-viewer/config/*；
- URL 构造：uild_pdf_viewer_url 保持 /pdf-viewer/?...，并以新目录存在性判断生产/开发。
- 构建：uild.frontend.pdf_viewer.py 默认输出更改为上述新路径（可覆盖）。
## Anki 桥接后端启动与 DB 定位（2025-10-13 更新）
- 目标：默认逻辑严格依赖 `src/backend/database/config.py` 的物理位置推导 `PROJECT_ROOT`，不显式传入 db_path。
- 实施：
  - 桥接使用 `BackendLauncher(parent_app=mw)`；不传 `db_path`；
  - `PDFLibraryAPI` 内部通过 `get_db_path()` 获取 `<PROJECT_ROOT>/data/anki_linkmaster.db`（`PROJECT_ROOT` 由 `config.py.__file__` 计算）。
- 影响：
  - 若在 Anki 环境导入插件副本，则 DB 落在插件库根的 `data/`；
  - 若导入到源码副本，则 DB 落在源码仓库根的 `data/`；此为预期（以模块物理路径为准）。
## 事件契约更新（20251018085714）

- （新增 2025-10-20）侧边栏点击改为“按ID导航事件”
  - 事件：`PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED`
    - 负载：`{ outlineItemId: string }`（兼容 `bookmarkId/id`，消费端会自动兼容取值）
  - 发送端：
    - `ui/bookmark-sidebar-ui.js`、`features/pdf-outline/components/outline-sidebar-ui.js` 在 `select_node.jstree` 中发射该事件；
    - 同时发出 `BOOKMARK.SELECT.CHANGED({ bookmarkId, bookmark })` 保持工具栏等状态一致；
  - 消费端：`features/pdf-bookmark/index.js:#handleNavigateByIdRequest()`
    - 通过 `BookmarkManager.getBookmark(id)` 定位节点；复用 `#handleNavigateRequest()` 导航；
    - 失败时发 `BOOKMARK.NAVIGATE.FAILED` 并记录日志。

- 事件：`PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED`
  - `pdfId: string`（必填，若由 URL/上下文提供则透传）
  - `pageAt: number|null`（可选；提供时需为 >=1 的整数）
  - `position: number|null`（可选；表示页面内垂直位置百分比 0-100；不提供请传 null，避免 undefined）
  - `anchorId?: string`（可选；`pdfanchor-` + 12 hex 或开发测试 `pdfanchor-test`）

- 校验器：`URLParamsParser.validate()`
  - 将 `undefined` 视为“未提供”，仅对 `number|null` 做校验；
  - 允许仅携带 `anchorId`（缺少 `pdfId` 时发出警告，交由后端解析映射）。

- 发送端规范：
  - 所有 emit 位置统一将空值规范化为 `null`，不要传 `undefined`；
  - 示例：`position: (typeof pos === "number" ? pos : null)`。

###（新增 2025-10-18）翻译功能的自动模式与触发方式
- 行为变更：`SelectionMonitor` 默认关闭自动翻译，仅在“翻译侧边栏打开”时启用；关闭侧边栏即禁用。
- 显式触发：
  - 划词快捷操作“翻译”按钮（source=`quick-actions`）；
  - 高亮标注菜单“翻译”按钮（source=`text-highlight`）。
- 自动触发：
  - 仅当翻译侧边栏打开时，划词会自动触发翻译（监听 `sidebar:opened:completed/closed:completed` 联动）。
- 受影响文件：`features/pdf-translator/index.js`、`features/pdf-translator/services/SelectionMonitor.js`。
- 兼容性：既有入口不变；仅抑制“侧边栏关闭时的误触发”。

## 统一跳转技术规范（提案，2025‑10‑20）

目的：将 URL/WS/UI/内部来源的跳转请求统一为单一“跳转意图（NavigationIntent）”数据结构，并通过统一事件完成调度与回执。所有示例均为 UTF-8，换行 `\n`。

事件（入口/中间态/结果）：
- `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.REQUESTED`
- `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.GATE.WAITING`（可选）
- `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.ACCEPTED`（可选）
- `PDF_VIEWER_EVENTS.NAVIGATION.EXECUTE.REQUESTED`（可选）
- `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.RESULT.SUCCESS`
- `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.RESULT.FAILED`

数据模型：
```json
{
  "traceId": "uuid-like or ws-msg-id",
  "source": "url|ws|ui|internal|test",
  "pdfId": "optional-12-hex",
  "target": {
    "kind": "annotation|anchor|outline|page",
    "id": "optional string for id-based",
    "pageAt": 1,
    "position": 25.0
  },
  "priority": "normal|high",
  "replace": true
}
```

门闸矩阵（由 GateTracker 维护）：
- page：`FILE.LOAD.SUCCESS`；presence(position)→建议等待 `RENDER.READY`
- outline：`FILE.LOAD.SUCCESS` + `BOOKMARK.LOAD.SUCCESS`
- annotation：`FILE.LOAD.SUCCESS` + `ANNOTATION.DATA.LOADED`
- anchor：`FILE.LOAD.SUCCESS` + `ANCHOR.DATA.LOADED` + `RENDER.READY`

执行与回执：
- annotation：发 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`，等待回执→包装为 `INTENT.RESULT.*`。
- anchor：发 AnchorFeature 既有跳转事件→包装回执。
- outline：发 `BOOKMARK.NAVIGATE_BY_ID.REQUESTED`（或按页执行）→包装回执。
- page：直接 `navigationService.navigateTo` → 包装回执。

WS 适配（msgcenter → front）：
```json
{ "action": "pdf-viewer:navigation-intent:requested", "payload": { /* NavigationIntent */ } }
```
- 由 `WsNavigationAdapter` 转为 `INTENT.REQUESTED`；按需回写 ACK（`pdf-viewer:navigation-intent:{completed|failed}`），透传 `traceId`。

验收：
- `traceId` 贯穿入口→门闸→执行→结果。
- 缺失门闸不回退默认页；仅等待或失败并报 `missing_gate`。
- 重复/抖动有去重与替换策略。
## 标注渲染加载策略（2025-10-18 更新）
- 高亮标注：
  - `TextHighlightTool` 统一通过 `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED` 接管初始渲染，清空旧 overlay 与菜单后重新渲染；
  - 新增 `pendingHighlightsByPage` 队列：若 `.textLayer` 尚未插入则暂存（以 page + annotationId 去重），待 `pagerendered/textlayerrendered` 时调用 `#flushPendingHighlightsForPage`；
  - `renderHighlightForAnnotation` 在成功时才落盘到 `#annotationHighlightRecords`，失败会自动重新排队；删除事件会清除 DOM、菜单与队列。
- 截图标注：
  - `ScreenshotTool` 监听 `ANNOTATION.DATA.LOADED`，对比新列表删除遗留方框，并为所有截图标注执行 `renderScreenshotMarker`；
  - 方框渲染仍内置 `MutationObserver` 兜底，当 canvas 未就绪时会延迟直到出现。
- 验证：`text-highlight-tool.test.js` 覆盖“数据加载→立即渲染”和“无 TextLayer→事件回补”两种情况；`screenshot-tool.test.js` 验证批量渲染及过滤。

---

### 技术更新（2025-10-25）
- 事件契约：添加 PDF 入口调整为全局事件 search:add:requested → Feature.add-files → WS pdf-library:add:requested（逐文件）。
- 桥接实现：优先使用 src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js；如未注入 qwebchannel.js，桥接会尝试动态加载并等待 window.qt.webChannelTransport 就绪。
- Feature Flag：dd-files 默认启用；eature-flags.json 去除 pdf-list 项，pdf-editor/pdf-sorter/pdf-edit 改为依赖 search-results。
- 注意：所有文件读写统一 UTF-8，显式保证 \n 换行；前端发送 WS 消息统一走 WEBSOCKET_EVENTS.MESSAGE.SEND。

---

### 技术更新（FilterFeature 收敛）
- 事件替换：@pdf-list/data:load:completed → search:results:updated。
- 事件负载：标准结果事件包含 { records, count, searchText, focusId, page }；为兼容性暂保留 iles/items 回退读取。
- 缓存策略：仅用于本地筛选的源数据缓存，不再要求“全量列表广播”。

---

### 用法变动（2025-10-26 15:25:40）— pdf-library:add:requested 契约对齐
- 出站消息必须包含：`type/timestamp/request_id/metadata/data`；其中 `metadata.version='1.0.0'`；`timestamp` 可由 `WSClient.send()` 兜底补充，但推荐显式设置；
- `data` 结构：仅 `{ filepath }`，不允许额外字段（如 `name`）。UI 可自行用于 toast 展示，不随 WS 上送；
- 参考实现：`src/frontend/pdf-home/features/add-files/index.js` 在发送时注入 `timestamp` 与 `metadata`，并保障 `data` 仅包含 `filepath`。

### 决策更新（2025-10-26 15:34:47）— 禁止 WSClient 自动补齐 metadata
- 原变更撤回：`WSClient.send()` 不再自动注入 `metadata`，仅补齐 `timestamp`；
- 代码位置：`src/frontend/common/ws/ws-client.js`；
- 规范要求：所有 `*:requested` 出站消息必须在业务侧显式提供 `metadata: { version: '1.0.0' }`；平台层不得兜底补齐；
- 风险与收益：若业务遗漏，将在后端 Schema 校验阶段暴露并快速定位到具体出站点，保证契约严格性。

### 能力扩展（2025-10-26 15:48:18）— wsClient.request 支持显式传入 metadata（非自动化）
- 改动：`wsClient.request(type, payload, { timeout, maxRetries, metadata })`；仅当调用方传入 `metadata` 时并入消息体；默认不注入；
- 影响：使依赖 `wsClient.request` 的调用点（pdf-edit、annotation、bookmark、anchor等）无需手写完整消息构造即可满足“显式 metadata”的要求；
- 配套更新：
  - pdf-viewer/adapters/websocket-adapter.js 对所有 `ANCHOR_*` 请求传入 `{ metadata:{version:'1.0.0'} }`；
  - annotation-manager.js 与 bookmark-storage.js 的 `request()` 调用均传入 metadata；
  - viewer 注册/visited_at/page_changed/zoom_changed 等通过 `send()` 的消息也显式加上 `metadata`。

### 消息类型使用约束（2025-10-27）
- 禁止使用任何 legacy 类型（如 pdf-home:get:pdf-list / pdf_page_request 等）；一律使用三段式 *:requested/*:completed/*:failed
- 违反将得到 400 LEGACY_MESSAGE_TYPE_NOT_SUPPORTED

### 用法变动（2025-10-27 19:33:01）— 标准服务器路由直连与依赖注入
- `standard_server.py` 不再保留大批 `handle_*` 包装；消息统一由 `core/msg_router.py` 绑定闭包直连各处理器；
- 特例：`pdf-library:search:requested` 仍由入口方法注入 `raw_message` 后转给处理器（用于严格过滤与兼容）；调用方无需感知；
- `pdf-page:*` 功能要求在构造 `StandardWebSocketServer(data_dir, db_path, page_transfer=...)` 时显式注入 `page_transfer`；缺失将返回带 `PAGE_EXTRACTION_ERROR` 的 `pdf-page:load:failed`；
- 测试与独立运行需显式传参 `data_dir` 与 `db_path`；禁止兜底。

### 用法补充（2025-10-27 21:53:57）— ServerAPIMixin
- 新增 `src/backend/msgCenter_server/core/server_api.py`，`StandardWebSocketServer` 继承该 Mixin；
- 公共方法未改名：`send_message/broadcast_message/get_client_count/get_client_ids/on_client_disconnected/on_socket_error`；
- 外部调用不受影响；仅实现位置从入口文件迁出。

### 用法变动（2025-10-29 23:59:40）— 前端 Jest 冒烟命令调整（Jest v30）
- 变更：`package.json` 将 `test:smoke` 从 `--testPathPattern=__smoke__` 调整为 `--runTestsByPath src/frontend/pdf-viewer/__smoke__/annotation-card-jump.smoke.test.js -i`（Jest v30 废弃旧参数）。
- 影响：调用侧统一执行 `pnpm run test:smoke` 即可，仅跑注释卡片跳转冒烟；全量测试仍为 `pnpm run test`。
- 新增文件：
  - `src/frontend/pdf-viewer/__smoke__/annotation-card-jump.smoke.test.js`（严格 UTF-8 与 `\n`）。


## 2025-10-28 22:23:09 — Backend Launcher 技术要点
- 文件读写统一 ncoding='utf-8'；日志文件先二进制截断，确保纯 UTF-8 文本。
- CLI 仍支持 start|stop|status；LegacyBackendLauncher 负责子进程管理。
- PyQt 集成的 BackendLauncher 保持严格参数校验：缺少 logs_dir|data_dir|db_path|pdfs_dir|static_dir 直接报错（禁止兜底）。
- 端口合并写回 logs/runtime-ports.json，保留其他端口键。
## 2025-11-01 — 工程守护与公共入口规范
- 新增 ESLint 规则：`custom/no-cross-feature-internals`（error；CI 门禁生效）
  - 目的：禁止 `features/<A>/**` 直接导入 `features/<B>/**` 内部文件；仅允许 `<B>/index.js` 或 `<B>/public.js`。
  - 例外：`__tests__/`、`__smoke__/`、`*.test.js` 允许跨特性引用（构造场景）。
- GitHub Actions：`.github/workflows/lint.yml` 执行 `pnpm run lint:features`，将上述规则作为 PR 门禁。
- 公共入口（public.js）约定：
  - 每个 feature 若需对外暴露 API/常量，增加 `public.js` 聚合导出，避免外部依赖内部目录结构。
  - 已落地：`features/url-navigation/public.js`、`features/pdf-translator/public.js`、`features/annotation/public.js`。
- DI/容器键名（约定）
  - `navigationService`、`pdfViewerManager`、`anchorSidebarUI`、`outlineSidebarUI`、`translatorSidebarUI`、`translationService`。
  - 原则：UI/服务由提供方在 install 时 `registerGlobal(<key>, instance)`，消费方从容器读取。
