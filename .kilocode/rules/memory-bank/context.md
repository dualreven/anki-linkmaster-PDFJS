# Memory Bank - Context（核心精简）

更新时间：2025-10-29

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
