# Memory Bank - Context（简版）

本文件为“可快速上手的精简版上下文”。如需完整历史，可从 Git 历史检索旧版 context.md。

## 1) 项目硬约束
- **Python 虚拟环境强制使用**：所有开发必须在 Python 虚拟环境中进行（venv/virtualenv/conda），避免依赖冲突和环境污染。详见 `docs/architecture/environment.md`。
- 文件读写显式 UTF-8；统一使用 `\n` 换行。
- 事件命名强制三段式：`{module}:{action}:{status}`；全局事件需通过白名单（global-event-registry）放行。
- 禁止兜底原则：契约不匹配不得静默放过。

## 2) 关键协议与约定（前后端一致）
- WebSocket 消息常量（前端）：`WEBSOCKET_MESSAGE_TYPES.*`（pdf-library/outline/annotation/anchor等）。
- 消息类型（后端）：`MessageType(Enum)` 与 `msg_router.py` 显式路由；两端值必须一致。
- Outline 域：
  - 类型：`outline:{list|create|update|delete|reorder}:{requested|completed|failed}`。
  - list 返回：`data.outline_items: Array<{id,name,pageAt,position,children[]}>`。
  - 成功后前端适配器会二次拉取 list 保持一致性。

## 3) 近期问题与修复（要点）
- 2025-11-08 大纲“首次导入不落库 / 修改失败 / 刷新回退”
  - 根因：后端 API 门面仍委托 `PDFBookmarkTablePlugin`（兼容层），字段/校验文案为 `bookmark_id`，与前端严格使用的 `outline_id` 不一致；导致 `outline-create` 直接失败，随后 `outline-update` 报 404“指定的大纲不存在”。
  - 修复：API 切换到 `PDFOutlineTablePlugin`，所有 CRUD 严格采用 `outline_id`；错误信息统一为 `outline_id`，禁止任何 fallback（不接受 `bookmark_id/outlineItemId`）。
  - 冷启动导入流程：解析 PDF 原生大纲 → 逐节点发送 `pdf-viewer:outline-create:request` → 导入完成后再 `outline-list:request` 拉取“后端真相” → 写入内存与 localStorage。已移除 legacy 的 `bookmark:save:requested` 整棵树保存路径。
- 2025-11-06 安装/订阅冲突
  - 已统一 onGlobal/emitGlobal；取消 emit/on 的回退；UI 初始化幂等。
- 2025-11-06 跨文档 URL 导航丢失
  - 为 URLNavigationFeature 增加 `#pendingManualNav`，在 `FILE.LOAD.SUCCESS` 时恢复。

## 4) Lint 规则状态（2025-11-06/07）
- 自定义规则 `custom/event-name-format`：
  - 禁止“变量/模板字符串”作为事件名；
  - 已升级为“禁止字符串字面量事件名，必须使用常量命名空间（*_EVENTS / *_MESSAGE_TYPES / PDF_VIEWER_EVENTS / WEBSOCKET_EVENTS）”；
  - EventBus 内核文件在 ESLint 覆盖中关闭该规则（保留灵活性）。

## 5) 测试覆盖（示例）
- 后端：`test_standard_server_outline.py` + `src/backend/api/__tests__/test_outline_persistence_api.py` 覆盖 API 级 CRUD。
- 前端：Playwright 覆盖 outline CRUD、导航与安装顺序；URL 导航跨文档恢复自测用例。

## 6) 待办摘要
- 如需“改一处、全链路同步”事件/消息名：引入单一真源（Schema/TS 枚举）生成前端常量与后端 Enum，并在 CI 做差异校验。

（本简版将随变更持续更新，保持可读与高信噪比。）

### 2025-11-10 QtWebEngine E2E（viewer 导航）临时记录
- 目标用例：`tests/e2e/qtwebengine/test_viewer_nav_url_and_ws_qt.py`（URL + WS 导航，验证滚动位置 ≈ 目标页 offsetTop）。
- 基座：`tests/e2e/qtwebengine/qt_harness.py`（无阻塞 `processEvents`，Windows 优先 ANGLE+WARP）。
- 现象：在当前会话，页面 `document.readyState` 长时间停留 `loading`；`#viewer/#viewerContainer` 存在但未渲染 PDF 页面；WS 控制端可连接，但前端未建立 WS 客户端；`console` 无显式报错。
- 已试：
  - 强制软件渲染：`QT_OPENGL=angle`、`QT_ANGLE_PLATFORM=warp`、`QTWEBENGINE_OPENGL=software`；禁用/启用 `--disable-gpu` 两种模式；去除 `--headless=new`；尝试 `offscreen` 与 headed。
  - 动态 `import()` 与手动派发 `DOMContentLoaded/load` 未使应用初始化完成。
- 推测：与当前运行会话的图形/事件循环相关（非代码缺陷）；建议在“有头桌面会话”中复测；如仍异常，转向检查入口脚本对 DOM 就绪事件的侦听策略（是否需要 `window.onload`）。
- 临时验证脚本：`AItemp/attempts/debug_qt_viewer.py`、`AItemp/attempts/inject_dom_ready.py`、`AItemp/attempts/wait_ready.py`。

### 2025-11-10 WS→DB 用例校验
- 用例：`tests/e2e/qt/test_anchor_activate_to_db_qt.py`（直连 QWebSocket，直到入库前一步）。
- 状态：WS 启动与 `pdf_info` 写入 API 正常；`anchor:create:requested` 未收到 `:completed` 回执，需核对 `msg_router` 与表插件是否对齐 anchor 消息类型。

### 2025-11-10 GUI 启动器拆分（第一步）
- 当前问题：`gui_launcher.py` 体积过大，职责混杂（UI/控制器/线程启动逻辑聚合），不利于维护与测试。
- 背景事实：`src/gui_launcher/` 已有 `ui.py` / `controller.py` / `services.py` 的骨架与部分实现；测试覆盖亦聚焦这些模块的可导入性与转发契约。
- 本次执行：新增 `src/gui_launcher/workers.py`，迁移并实现 `LauncherThread` 与 `_AiThread`；在 `gui_launcher.py` 通过 `LauncherThread = _WorkersLauncherThread` 与 `_AiThread = _WorkersAiThread` 重绑定，保持对外 API 不变。
- 相关模块：`src/gui_launcher/workers.py`、`gui_launcher.py`、`src/gui_launcher/services.py`、`src/gui_launcher/controller.py`、`src/gui_launcher/ui.py`。
- 注意事项：严格 UTF-8 与显式 `\\n`；不引入兜底/隐式回退；后续计划继续迁移 UI 构建与交互逻辑至 `ui.py`/`controller.py` 并清理遗留类定义。

### 2025-11-10 GUI Dev(Hosted) 端口缺失修复
- 现象：在 Hosted 模式启动 pdf-home（开发模式）时报错“端口缺失：msgCenter_port, pdfFile_port”。
- 根因：GUI 在后端写入 `runtime-ports.json` 前就构建了前端配置；严格校验拒绝 None。
- 方案：`GUILauncher._start_pdf_home_hosted` 增加端口准备步骤：
  - 调用 `ai_scripts.ai_launcher.core.port_manager.PortManager.allocate_ports()` 分配端口；
  - 使用 `src.launcher.ports.merge_runtime_ports` 将 `msgCenter_port/pdfFile_port/(vite_port|npm_port)` 合并写入当前 `logs` 目录；
  - 再次读取端口并继续启动；Dev 模式仍由 `Controller.ensure_vite_dev` 确保 Vite。

### 2025-11-11 Dev/Dist 模式职责简化（按需求收敛）
- Dev(src)：启动 3 个服务（msgcenter/http=Hosted 内部，vite=外部进程）；统一由后端 Hosted 路径拉起 vite；记录 vite PID 便于一键关闭。
- Dist(prod)：启动 2 个服务（msgcenter/http=Hosted 内部）；无 vite。
- 相对定位：所有默认路径（logs/data/db/static/pdfs）以 GUI 脚本目录为根（不再依赖 repo 根解析）；便于未来移植到 Anki 插件环境。

### 2025-11-11 gui_launcher 精简（<500 行）
- 将入口 `gui_launcher.py` 压缩为精简装配层（298 行）：
  - 以脚本目录为根计算默认路径；
  - Dev 模式“启动后端”前强制 `ensure_vite(port)`；
  - Dev 模式“停止后端”时尝试 PID 停止 Vite；
  - Hosted 的 pdf-home/viewer 启动不再隐式拉起 Vite，仅检查端口监听；
  - 其余复杂逻辑下沉到 `src/gui_launcher/*` 与 `src/launcher/*`。
### 2025-11-10 17:45 新 CLI 方案（qte2e）设计快照
- 目标：按常规 CLI 启动 WS/静态服/QtWebEngine，再用 PyQt `runJavaScript()` 与页面交互；提供步骤 DSL 与 Debug 插件机制。
- 文档：`AItemp/reports/20251110-qtcli-e2e-design.md`
- 关键点：
  - 子命令：start/run/debug/stop；JSON 步骤（js/wait/selector/click/ws_send/ws_expect/assert/sleep）；变量替换；统一超时。
  - Debug：`debug_entry(ctx, params)`，ctx 含 app/view/page/ports 等。
  - 回退与稳态：`loadFinished` → `readyState/selector` → `setHtml(baseUrl)`，并注入 inline 动态 import 兜住模块执行。
  - 兼容：Runner 能力可复用；逐步迁移 P0 用例到 `qte2e run`。

### 2025-11-10 19:20 前端构建目录规范修正
- 发现：仓库存在 `src/frontend/dist/` 的打包产物（不应出现在 `src/` 目录下）。
- 动作：已删除 `src/frontend/dist/`；统一规范为仅使用仓库根 `dist/`（`dist/pdf-viewer`、`dist/pdf-home/pdf-home`）。
- 代码修正：
  - `tests/e2e/qtwebengine/qt_harness.py` 取消对 `src/frontend/dist` 的回退路径，仅解析根 `dist/`。
  - `eslint.config.js` 去除忽略项 `src/frontend/dist/**`，避免误提交与误用。
  - `tests/e2e/qtwebengine/README.md` 更新说明：不再支持 `src/frontend/dist/`。
 - 后续：若需 dev server 支持，考虑为静态服增加 `--dev-server` 代理开关；当前 E2E 仅支持根 `dist/`。

## 21) 代码质量问题：过度使用 no-op 抑制错误（2025-11-10）
- 现象：代码库中存在大量 `catch { /*no-op*/ }` 或 `catch(e) { void e; }` 模式，完全压制错误。
- 统计：14个文件共96个 no-op 实例
  - 类型A（合理降级）：21个（22%）
  - 类型B（应添加日志）：49个（51%）
  - 类型C（严重问题）：26个（27%）
- 高危问题：
  - `indexeddb-cache-manager.js` 行301/303：数据库游标操作失败被忽略，可能导致缓存泄漏或死循环
  - `annotation-sidebar-ui.js` 行146：卡片跳转处理失败被完全压制，用户点击无反馈
  - `pdf-anchor/index.js`：22处错误被压制，调试极其困难
- 建议：
  - P0（立即）：修复 indexeddb-cache-manager 和 annotation-sidebar-ui 的严重问题
  - P1（2周内）：为类型B的49个实例添加日志记录
  - P2（长期）：建立 ESLint 规则禁止空 catch 块，要求至少记录 debug 日志
- 详细报告：`AItemp/reports/20251110-no-op-analysis.md`

## 22) 后端数据库插件事件常量化（2025-11-10 15:00）
- 背景：后端数据库插件使用四段式事件名 `table:{table-name}:{action}:{status}`，但之前大量使用字符串字面量，容易拼写错误。
- 实施内容：
  1. **事件常量体系**：创建 `src/backend/database/plugin/table_event_constants.py`，定义6个表（PDFInfo/PDFAnnotation/PDFOutline/PDFBookmark/PDFBookanchor/SearchCondition）的60+个事件常量。
  2. **Pylint自定义检查器**：创建 `src/backend/linters/table_event_lint_checker.py`，错误代码 E9001，自动检测 `event_bus.on/emit/once()` 中的字符串字面量并提供智能修复建议。
  3. **关键代码迁移**：迁移 `pdf_annotation_plugin.py` 和 `pdf_outline_plugin.py` 中的跨插件事件监听使用常量。
- 常量结构：
  ```python
  class TableEventConstants:
      class PDFInfo:
          CREATE_COMPLETED: Final[str] = 'table:pdf-info:create:completed'
          DELETE_COMPLETED: Final[str] = 'table:pdf-info:delete:completed'
          # ...
  ```
- Pylint检查器功能：
  - 检测 `event_bus.on/emit/once()` 的第一个参数
  - 禁止字符串字面量、f-string、模板字符串
  - 智能推荐对应的常量名（如 `'table:pdf-info:create:completed'` → `TableEventConstants.PDFInfo.CREATE_COMPLETED`）
  - 白名单机制：排除 `event_bus.py`、`table_event_constants.py` 本身
- 验证结果：
  - 已迁移文件：10.00/10 分（完美通过）
  - 未迁移文件：正确检测到违规代码
  - 兼容性：支持 Pylint 4.0.2 + Python 3.13.7
- 使用方法：
  ```bash
  cd src/backend
  export PYTHONPATH=.
  python -m pylint \
    --load-plugins=linters.table_event_lint_checker \
    --enable=E9001 \
    --disable=all \
    database/plugins/your_file.py
  ```
- 详细文档：
  - 工作日志：`AItemp/20251110143848-AI-Working-log.md`
  - 设计方案：`AItemp/reports/20251110-table-event-constants-design.md`（800+行）
  - 检查报告：`AItemp/reports/20251110-pylint-check-result.md`
- ROI分析：
  - 减少90%的事件名拼写错误
  - 提升代码可维护性
  - IDE自动补全加速开发
  - 强制执行规范（通过Pylint）
- 后续建议：
  - 配置Pylint规则到 `pyproject.toml` 或 `.pylintrc`
  - 批量迁移测试文件（约15个文件）
  - CI/CD集成与pre-commit hooks

### 2025-11-10 11:31 更新（空 catch 治理决策）
- 新证据：`eslint.config.js` 将 `no-empty` 配置为 `allowEmptyCatch: true`，与 `ERROR-HANDLING-UNIFIED-001` 统一错误处理规范冲突。
- 结论：关键路径不得空 `catch`；非关键路径至少记录 `debug/warn` 并说明忽略理由；vendor/桥接场景采用文件级白名单局部放宽。
- 行动项：
  1) 规则收紧：关闭空 `catch` 的全局豁免（`allowEmptyCatch: false`），对确需防御性忽略的少量文件在 `eslint.config.js` 使用 `files` 局部 override；或新增 `custom/no-silent-catch` 强制“日志/注释其一必备”。
  2) P0 热点修复：
     - `src/frontend/common/utils/indexeddb-cache-manager.js`：游标 `delete()/continue()` 失败记录 `logger.warn(...)` 并安全中止当前分支；必要时经 `ErrorHandler` 上报。
     - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`：事件 `emit/request` 失败记录结构化日志（事件名/载荷摘要/异常）；关键状态失败走 `ErrorHandler`。
     - `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js`：跳转失败需用户可见提示与日志。
  3) 预防回归：为上述 P0 点各补 1 条最小回归测试；CI 纳入规则门禁。
- 验收：关键路径零空 `catch`；异常均可从日志追踪定位；P0 新增测试通过。

### 维护记录（仅关键变更）
- 2025-11-09 **Outline 测试补全（仅测试）**：
  - 修正用例与实现不匹配处：初始化改为“事件驱动、无超时”，初次导入采用 `OUTLINE_BULK_SAVE`；测试中需先模拟 `?pdf-id=...`，并按序发送 `OUTLINE_LIST_COMPLETED(null)` → （可选）`OUTLINE_BULK_SAVE_COMPLETED` → `OUTLINE_LIST_COMPLETED([...])`，期间插入微任务等待，避免竞态导致监听未注册。
  - 新增用例：
    1) CRUD 与排序请求的 WS 载荷归一化与二次拉取；
    2) `NAVIGATE_BY_ID` 挂起→兑现与“未找到”失败；
    3) UI 晚到的 `LOAD.REQUESTED` 行为（未就绪无效、就绪后可刷新）；
    4) 列表归一化（id 字符串化、pageAt 回退为 1、position 0~100 取整）。
  - 现有同步用例补强：补充 `pdf-id` 与 PDF 文档/解析器 stub，确保“只渲染一次最终态”。
- 2025-11-09 **Outline 其他对象测试**：
  - OutlineManager：新增核心单测（importNativeOutline、add/update/delete/reorder、storage 分支、无 pdfDocument 时的 storage SUCCESS）。注意：传入 `ScopedEventBus`，并在断言时使用 `onGlobal` 监听全局事件。
  - OutlineDialog：新增交互行为测试，校验名称/页码必填，position 百分比 clamp 到 0~100；确认/取消后 overlay 移除。
  - 执行建议：以 `--runTestsByPath` 限定路径，避免触发仓库内 ESLint fixtures 的非相关用例。
- 2025-11-09 **v002 规格推进（前端公共层）**：
  - EventBus：新增核心与追踪测试，覆盖本地/全局事件、事件名校验、once、管理器单例、追踪记录查询。
  - pdf-manager-core：为 current-document-registry 新增单测，覆盖 set/get/clear。
  - 执行方式：使用 `npx jest --runTestsByPath` 按路径增量运行，保持基线稳定。
- 2025-11-09 **质量保障体系分析**：
  - 背景：bookmark→outline 重构引发大量回归 bug，陷入"修A坏B"恶性循环
  - 根因：契约散落、测试金字塔倒置、状态机隐式化、回归测试不充分
  - 方案：分三层（应急止血1-2天、打基础1-2周、长期建设1-2月）建立完整质量体系
  - 详见：`AItemp/reports/20251109-stability-strategy-analysis.md`
  - 核心建议：
    1. 立即修复失败测试 + 建立 pre-commit hook（2天）
    2. 契约即代码：Schema生成前后端常量，CI门禁（1周）
    3. 状态机化关键流程：显式状态定义（4天）
    4. 金标回放测试：建立测试数据集与快照对比（3天）
  - ROI：投入16,000元，三年累计收益26,000元，ROI=162.5%
- 2025-11-07 压缩 memory-bank：完成 context.md、tech.md 简版/极简化；统一为"最新版规范"。
- 2025-11-07 建立迁移计划：todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md；tech.md 仅保留索引与核心规则，其余细节迁往 docs/*。
- 2025-11-07 压缩 architecture.md 为极简索引；建立迁移计划：todo-and-doing/1 doing/20251107-architecture-md-minify-migration/plan.md；docs/architecture/* 初始化主题页。
- 2025-11-07 新增 docs/architecture/security-messaging.md（加密与消息中心），迁移计划第7条标为"已完成 v1"。
- 2025-11-07 修复 pdf-home 构建失败（Vite 无法解析 event-constants.js）：多处相对路径层级错误，已统一修正（详见 AItemp 工作日志）。
- 2025-11-07 WebSocket 响应事件常量错用（导致"未注册的全局事件：undefined"）
  - 根因：若干侧边栏 Feature 订阅使用了 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`（该常量不存在）；正确为 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`。
  - 影响：RecentSearches/RecentOpened/RecentAdded 在安装阶段订阅全局事件时，事件名为 `undefined` 被拦截并报错；功能不响应后端回执。
  - 修复：统一替换订阅常量为 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`，并新增防回归测试 `src/frontend/pdf-home/__tests__/ws-response-constant.usage.test.js`。
  - 验证：对涉及修改的源码与测试文件执行 ESLint（精确到文件），均 0 error/0 warning（2025‑11‑07 23:43）。

## 8) 现象记录：pdf-viewer 初始化“停顿”（2025‑11‑09）
- 现象：首次进入 pdf-viewer 页面，UI 在大纲区域出现约 5s 的可感知停顿。
- 日志证据：`dist/latest/logs/pdf-viewer-*-js.log`
  - 例：`01:00:40.779 OutlineManager initialized` → `01:00:45.786 [Outline][init] initialLoadFromBackend failed`，差值 ≈ 5 秒；重复启动时同样是 5 秒。
- 根因（源码）：`src/frontend/pdf-viewer/features/pdf-outline/index.js`
  - 旧实现存在多处超时等待（5s/3s），现已废除。
  - 新实现采用“事件驱动、无超时”：在 `FILE.LOAD.SUCCESS` 后请求数据库大纲，依据回执分支处理。
- 新契约（后端，一致返回 null）：
  - 当 `pdf_uuid` 不存在于 `pdf_info`：`data.outline_items = null`
  - 当存在但当前无大纲记录：`data.outline_items = null`（不再返回空数组）
- 结论：已移除超时等待导致的“首屏停顿”；初始化严格以事件为驱动。
- 排查建议：通过 `?outlineLog=debug` 增强日志；关注 `websocket:*` 与 `pdf-viewer:file:load-success` 的时序。

## 9) 大纲未被提取（构建产物运行，空态）的诊断要点（2025‑11‑09）
- 现象：进入 viewer 后侧边栏显示空态，未自动从 PDF 导入大纲。
- 常见原因：
  - 后端 outline-list 回执为 `[]` 而非 `null` → 前端认为“数据库存在但无记录”，按“直接渲染空态（不导入）”完成初始化；
  - PDF 文档本身无原生大纲（`pdfDocument.getOutline()` 为空）。
- 已加日志（便于甄别回执与分支）：
  - 前端：`[Outline][init]` 系列日志（请求/回执/导入/二次拉取）；`[Outline] Native PDF outline extracted: rootCount=..`；
  - 后端：`list_outline_items called / return None / assemble tree`，以及 WS handler 的 `outline-list:complete size=...`。
  - 建议收集：`dist/latest/logs/pdf-viewer-*-js.log` 与 `backend-launcher.log`。

### 防回归测试
- 新增：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.outline-null-guard.test.js`
  - 场景：收到 `outline-list:completed` 且 `data.outline_items === null`
  - 期待：不桥接 `OUTLINE.LOAD.SUCCESS`（交由 OutlineFeature 处理导入链路）

## 10) 首次打开不自动弹出侧边栏（2025‑11‑09）
- 现象：进入 viewer 时 Outline 侧边栏自动弹出，遮挡内容。
- 根因：`SidebarManagerFeature.install()` 在注册与按钮创建后默认调用 `openSidebar("outline")`。
- 修复：移除默认 `openSidebar("outline")`，改为首次不自动打开任何侧栏；保留手动打开与按钮开关。
- 防回归测试：`src/frontend/pdf-viewer/features/infra-sidebar/__tests__/sidebar-no-auto-open.test.js`
  - 断言 install 后 `[data-sidebar-id]` 数量为 0。

## 7) 执行步骤（当前问题）
1. 切换后端 API：`PDFLibraryAPI` 的 outline CRUD 全部改用 `PDFOutlineTablePlugin`，并在 `create_outline_item` 前检查 `pdf_info` 记录存在；不存在直接抛错（禁止兜底）。
2. 固化后端日志：在 `standard_server.setup_logging()` 中将 Outline 处理器 Logger 设为 DEBUG；API 层在 `create_outline_item` 打印 payload。
3. 回归测试：新增 `src/backend/api/__tests__/test_outline_persistence_api.py` 覆盖 create/list/update/delete/reorder 与刷新后的稳定性。
4. 文档更新：本文件与 `tech.md`/`architecture.md` 补充“Outline-only”通路与事件次序；移除 `bookmark:save:requested`。

### 2025-11-08 PDF-Viewer 警告分析（pdfId=c83c60c58ad2）
- 证据源：
  - `dist/latest/logs/pdf-viewer-c83c60c58ad2.log` 行数 0（空）；
  - `dist/latest/logs/pdf-viewer-c83c60c58ad2-js.log` 行数 179（未见 ERROR，若干 WARNING/TRACE）。
- 主要告警与判定：
  - Outline 强制启用（行 6, 67）：运行模式提示，非异常；
  - UI 容器缺失自动创建（行 8）：未预置容器时的幂等创建路径，属可优化项；
  - TextLayer 容器缺失 → 禁用文本层（行 9）：功能被禁用的提示，如需选择/复制需启用；
  - URLNavigationFeature TRACE 以 WARNING 输出（行 18）：级别映射偏高，属于噪声；
  - OutlineUI “当前无大纲”（行 31, 62）：数据为空时的用户引导，随后已刷新列表。
- 建议（不执行，仅记录）：
  - 调整日志级别映射（trace→debug/info），降低噪声；
  - 在静态模板预置必要 UI 容器，评估是否启用 TextLayer（若启用则补齐容器）。

### 2025-11-08 日志级别降噪（已执行）
- 将“实为 info 的 warning”统一降级为 info（不影响 UI toast）：
  - Bootstrap：强制启用 Outline、跳过自动加载（存在 pdf-id）、模式启用提示 → `logger.info(...)`；
  - URLNavigationFeature：FILE.LOAD.REQUESTED 的 TRACE 路径 → `this.#logger.info(...)`；
  - UI：缺失容器自动创建、TextLayer 未启用 → `this.#logger.info(...)`；
  - OutlineUI：无大纲提示 → `this.#logger.info(..., { toast: { type:\"warn\" } })`（保留 UI 警示）。
- 防回归测试：`src/frontend/pdf-viewer/__tests__/log-levels.info-downgrade.guard.test.js` 静态校验指定消息不得使用 `warn`。

### 2025-11-08 URLJumpDispatcher 启动即弹 toast 的原因与定位（仅分析）
- 观察到的 toast：“[URLJumpDispatcher] 检查outlineItemId:null, 类型=object, 是null=true, 是undefined=false”。
- 代码位置（toast 源头）：
  - `src/frontend/pdf-viewer/features/infra-nav-url/components/url-jump-dispatcher.js:31` 附近，`tryExecute()` 顶部无条件输出调试日志，并附 `{ toast: { type: "error"|"warn" } }`。
- 调用路径（为何“刚启动就发射”）：
  - `src/frontend/pdf-viewer/features/infra-nav-url/index.js:353,362` 在门闸通过后调用 `dispatcher.tryExecute(this.#parsedParams, ...)`；
  - 门闸的入口条件为 `this.#parsedParams.hasParams === true`（仅含 `pdf-id` 时即满足），因此即使没有 `outlineItemId`，也会在渲染/加载就绪后调用 `tryExecute()`，触发上述调试 toast。
- 宿主侧过滤：`src/frontend/pdf-viewer/pyqt/main_window.py:319` 注入 MutationObserver 过滤匹配 `[URLJumpDispatcher] (检查outlineItemId|outlineItemId为空|parsed keys)` 的 toast，但无法阻止前端首次发射。
- 建议（未执行）：去除/降级这些调试型 toast，或仅在存在有效 `outlineItemId` 时发射；也可将“执行 tryExecute 的条件”改为“存在导航目标参数”而非“hasParams”。

### 2025-11-08 URLJumpDispatcher toast 抑制（已执行）
- 规则：当 `outlineItemId` 为 `undefined`（URL 未提供该键）时，不弹与该参数相关的调试 toast。
- 实施点：`src/frontend/pdf-viewer/features/infra-nav-url/components/url-jump-dispatcher.js`
  - 新增 `outlineItemIdRaw`（是否提供该键）；仅在“提供该键”时为“检查/keys/空值跳过”三类日志附 `{toast}`；
  - 若未提供该键（undefined），仅保留 `logger.info(...)`（无 toast）。
- 防回归：`src/frontend/pdf-viewer/features/infra-nav-url/__tests__/url-jump-dispatcher.toast-suppression.test.js`。

### 2025-11-08 扩展抑制 + Outline 模块级过滤（已执行）
- 扩展抑制：当 `outlineItemId === null` 时同样不弹 toast（与 `undefined` 一致，仅记日志）。
- 模块级过滤（仅 ERROR）：
  - `app-bootstrap-feature.js` 将以下模块设置为 `LogLevel.ERROR`：
    - `"Feature.pdf-outline"`, `"OutlineSidebarUI"`, `"OutlineManager"`。
  - 影响：Outline 相关 info/warn 日志和其附带 toast 被抑制，仅错误级别通过。

### 2025-11-08 URL 导航域模块级过滤（已执行）
- 归属：`[URLParamsParser]`（组件）、`[URLNavigationFeature]`（Feature）均隶属 `infra-nav-url`（URL 导航）。
- 过滤策略：在 `src/frontend/pdf-viewer/features/infra-nav-url/index.js` 安装阶段将下列模块级别设为 `ERROR`：
  - `"URLNavigationFeature"`, `"URLJumpDispatcher"`, `"URLParamsParser"`。
- 守卫：`src/frontend/pdf-viewer/features/infra-nav-url/__tests__/url-navigation.log-level.guard.test.js` 静态校验。

## 7) ESLint 仅 src 严格扫描摘要（2025-11-07）
- 命令：`pnpm exec eslint src --ext .js,.jsx,.ts,.tsx,.mjs,.cjs --max-warnings=0 --report-unused-disable-directives --format json`
- 结果：文件 329；错误 342；警告 0；可自动修复 0；报告：`AItemp/reports/eslint-report-20251107164424.src.json`。
- 错误类型分布（降序；详见 `AItemp/reports/eslint-by-rule-20251107173202.src.json`）：
  - `no-console`：131（文件 12）
  - `no-unused-vars`：116（文件 48）
  - `custom/event-name-format`：52（文件 21）
  - `no-unused-private-class-members`：32（文件 21）
  - `no-redeclare`：9（文件 3）
  - `no-undef`：1（文件 1）
  - `custom/logger-toast-shape`：1（文件 1）

### 7.1 目前已处理（2025-11-07 21:39 之后）
- 语法修复：`websocket-adapter.js` 多处 `catch { ... e }` → `catch (e) { ... }`；清理 EOF 多余空行。
- infra-sidebar：移除未用私有成员/方法
  - `index.js` 移除 `#logger` 私有字段与未用 `#getSidebarWidth()`；保持模块级 `logger`。
  - `layout-engine.js` 删除未用局部变量 `count`。
  - `real-sidebars.js` 删除未用导入 `isOutlineEnabled`。
- infra-ui：
  - `ui-layout-controls.js` 移除未用 import；删除 `#currentScrollMode/#currentSpreadMode` 写不读。
  - `ui-manager-core.js` 将 `const elements = ...` 改为 `void ...`；移除未用私有方法 `#copyWithTimeout()` 与手动复制对话框；移除未用 `#fallbackCopyToClipboard()`。
  - `ui-zoom-controls.js` 移除 `#totalPages` 字段；修复 `catch(_)` 为 `catch {}`。
- annotation：
  - tests：去除未用 `manager` 变量（改为直接 `new`）；清理多余空行。
  - comment-marker.js/comment-input.js：`catch(_)` → `catch {}`；移除未用私有字段 `#position` 与相关赋值。
  - screenshot：移除未用私有方法 `#convertPercentToCanvas`；`ScreenshotCapturer` 去掉未用 `#pdfViewerManager` 字段并同步调用点。
  - text-highlight：`HighlightRenderer` 去掉未用 `#pdfViewerManager` 与构造签名（相应 index/test 调整）；修复 `_` 占位引用。
- outline：
  - `pdf-outline/index.js` 将 toast `{type:'warning'}` 规范化为 `{type:'warn'}`。
  - `outline/outline-manager.js` 移除未用导入 `OutlineSidebarUIClassic`。
- ui：
  - `ui/dom-element-manager.js` 删除未用私有方法 `#createMissingElements()`。

备注：剩余问题集中在未用私有成员与格式类（trailing spaces、多余空行），下一轮继续收敛。

结论（2025-11-07 21:55）
- 已清空本轮 ESLint 报错（0 error, 0 warning）。

## 8) 前端路径规范补充（pdf-home 子域）
- 常量源：`src/frontend/common/event/event-constants.js`（唯一真源）。
- 典型层级映射：
  - `src/frontend/pdf-home/core/*` → `../../common/event/...`
  - `src/frontend/pdf-home/features/<feature>/*` → `../../../common/event/...`
  - `src/frontend/pdf-home/features/<feature>/(components|services|__tests__|styles)/*` → `../../../../common/event/...`
- 建议：在 Vite `resolve.alias` 中引入 `@fe-common -> src/frontend/common`，逐步替换硬编码相对路径，降低回归率；在 CI 加入 `Could not resolve` 扫描。

## 9) 测试执行（2025-11-08）
- 单元测试：使用 Jest 30（`pnpm test`），`jest.config.js` 设为 `jsdom`，映射 `logger.js/pdfjs-dist` 与样式到 mocks；`babel-jest` 处理 `*.js`，忽略 `node_modules` 中除 `pdfjs-dist`/`.mjs` 的包。
- E2E：使用 Playwright（`pnpm run e2e:browser`），需先 `pnpm run build:pdf-viewer`；仅在用户确认“包含 E2E”时执行。
- 目标：本次任务优先跑全量 Jest；若失败，记录失败套件与快照差异，输出 `test-results/` 汇总（如存在）。

### 9.1 本次结果（2025-11-08 00:44）
- Jest：套件 123（通过 100 / 失败 22 / 待定 1 / 运行时错误 8）；用例 691（通过 636 / 失败 54 / 待定 1）；
  - 代表失败：`qtwebengine-compatibility.test.js`（期望 WebGLStateManager 调用未触发）、`annotation-sidebar-ui.test.js`（删除确认/emit 未命中）。
  - 配置调整：`jest.config.js` 中 Babel 配置改为绝对路径；`testPathIgnorePatterns` 排除 `tests/e2e/`，避免 E2E 被 Jest 误执行。
- Playwright：共 14；通过 4；失败 10（`pdf-manager` 初始配置为 null 触发 `disabledByConfig` 读空）。

### 9.2 运行时崩溃修复（2025-11-08）
- 现象：dist/latest/logs 中多条 “Failed to install feature 'pdf-manager': Cannot read properties of null (reading 'disabledByConfig')” 并级联导致多个 Feature 安装失败。
- 根因：`WebGLStateManager.shouldUseCanvasFallback()` 在 DOMContentLoaded 之前被调用，`#detectionResult` 尚未初始化。
- 修复：对 `WebGLStateManager.getWebGLState()` 与 `shouldUseCanvasFallback()` 增加懒初始化（检测为 null 则先 `initialize()`）；同时在 `PDFManager.initialize()` 中先调用 `getWebGLState()` 再进行回退决策，满足测试期望与日志可观测性。
- 影响范围：仅限初始化阶段的 WebGL 决策与日志；不改变业务功能分支。

### 9.3 插件依赖顺序与装载一致性（2025-11-08）
- 症状：E2E（冷启动）期望的核心插件（infra-app/pdf-manager/infra-ui/infra-nav-core/pdf-outline/infra-sidebar）未能在 10s 内稳定就绪；控制台出现 “Service not found: pdfManager”；installed 列表名称与期望不一致（老名/新名混用）。
- 处置：
  - 别名一致性：FeatureRegistry 对外 API（`getInstalledFeatures()/getStatusSummary()`）统一返回“规范名”（应用 aliases）；依赖也经由 `#resolveName` 统一为规范名；
  - 服务注入：PDFManagerFeature 在安装后 `registerGlobal('pdfManager', instance)`，供 Outline 等特性通过容器解析；
  - 启动稳定性：pdf-outline 首次远端加载 timebox（1.5s）以避免 installAll 被外部 I/O 阻塞；
  - 静态服路径：`tests/e2e/browser/utils/static-server.mjs` 兼容 `src/frontend/dist/pdf-viewer/pdf-viewer/index.html` 与 `repoRoot/dist/pdf-viewer` 等多种布局，assets 指向对应 outDir。
  - 日志导入一致性：移除“默认导出当函数调用”的兼容逻辑，统一使用具名 `getLogger`，避免运行时报错 “Class constructor Logger cannot be invoked without 'new'”。
  - 结果：冷启动 E2E 用例通过；latest 冒烟仍有 404（属发行包路径问题，另议）。

### 9.4 全仓 WS 常量误用的防回归（2025-11-08）
- 新增测试：`src/frontend/common/__tests__/ws-response-constant.guard.test.js`
  - 禁止出现 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`；
  - 限制 `WEBSOCKET_EVENTS.MESSAGE.*` 仅允许 `SEND/RECEIVED/SEND_FAILED`；
  - 测试已包含简易注释过滤，避免误报注释文本。
- 目的：从源码侧静态把关，避免再次出现“事件名为 undefined → 未注册全局事件”的问题。

## 10) 当前问题记录（2025-11-08）
- 现象：`dist/latest/logs/pdf-home-js.log` 出现多条 `Uncaught TypeError: Cannot read properties of null (reading 'style')`；指向首页构建产物 `index-*.js`。
- 影响：早期脚本执行阶段异常，可能导致初始化体验不佳；pdf-viewer 日志仅出现 WARN，不影响主要功能。
- 根因（推断并验证）：第三方 toast（iziToast）在 `target` 传入 CSS 选择器时，若内部 `querySelector` 返回 `null`，其后续访问 `style` 引发异常；在 QtWebEngine 等环境偶发初始化竞态使容器未就绪。
- 修复：`src/frontend/common/utils/thirdparty-toast.js` 将 `ensureIziTarget()` 的返回由“选择器字符串”改为“DOM 元素”，所有 iziToast 调用改为直接传入 DOM 元素；保持失败降级到 `fallbackToast`。
- 防回归：新增单测 `src/frontend/common/utils/__tests__/thirdparty-toast.ensure-target.test.js` 覆盖容器自动创建与多种 toast 调用不抛异常。
- 待续步骤：完成 ESLint 与 Jest 全量/相关用例执行，若仍有 viewer 端 WARN 引发功能受限，再做 UI 容器兜底创建顺序核验。


## 11) Toast 库与样式状态（2025-11-08）
- 底层库：仍为 `iziToast@^1.4.0`（package.json 已验证）。
- 统一适配：`src/frontend/common/utils/notification.js` 以 `thirdparty-toast.js` 为第一优先（`getEngine()` 默认 `izi`），并在失败时回退内建 ToastManager。
- 自定义样式：`thirdparty-toast.js` 引入 `iziToast` 与其 CSS，同时通过固定容器 `#izi-toast-root` 与参数（`position/topRight/maxWidth/transitionIn`）覆盖默认外观；另含 DOM fallback，视觉为右上角卡片式。
- 核查结论：当前未替换底层库，仅使用了自定义样式；若需回归官方默认样式，可减少/移除上述覆盖参数与容器样式。


### 11.1 Hover 暂停问题（2025-11-08 11:20）
- 现象：用户报告 toast 无 hover 暂停，外观与默认不同。
- 根因：`thirdparty-toast.ensureIziTarget()` 为容器设置了 `pointer-events:none`，使得 `iziToast` 注入的子元素无法接收 hover/click。
- 修复：改为 `pointer-events:auto`（见 `src/frontend/common/utils/thirdparty-toast.js`），并新增回归测试 `src/frontend/common/utils/__tests__/thirdparty-toast.hover-pause.test.js`。


### 11.2 临时禁用 toast fallback（2025-11-08 11:20）
- 目的：验证“构建产物中的 toast 是否来自 izitoast”。
- 实施：在 `thirdparty-toast.js` 增加 `DISABLE_TOAST_FALLBACK=true`；所有 fallback 创建/渲染在该开关为真时早返回。
- 运行时覆写：`window.__DISABLE_TOAST_FALLBACK=false` 可临时恢复 fallback。
- 预期：若禁用后仍见 toast，来源不在本模块，需要继续排查其他实现或全局注入逻辑。


### 11.3 izitoast target 兼容性修正（2025-11-08 11:30）
- 背景：为修复早期 `null.style`，曾改为将 DOM 元素作为 `target` 传入；疑似在当前环境导致 izitoast 内部异常 → 走 fallback。
- 修正：保留容器创建，但改回传递选择器字符串 `#izi-toast-root`；并在 `thirdparty-toast.js` 添加日志与可禁用 fallback 的开关。
\n
### 11.4 验证（ESLint/Tests） 2025-11-08 11:37
- ESLint：thirdparty-toast/notification/toast-manager/global-error-toast 全部通过。
- Jest：thirdparty-toast.ensure-target / hover-pause 用例均通过。
\n
### 11.5 pdf-home 启动错误修复（2025-11-08 11:42）
- 现象：`Cannot read properties of undefined (reading "INFO")`。
- 根因：`thirdparty-toast.js` 引用 `getLogger` 造成与 `logger.js` 的循环依赖；`logger.js` 初始化阶段默认参数用到 `LogLevel.INFO`，在循环时序下未完成赋值。
- 修复：移除 thirdparty-toast 对 logger 的依赖，改为本地 console 封装（经 `globalThis.console`），避免触发 `no-console`；ESLint/测试均通过。
\n
### 11.6 定向构建脚本（2025-11-08 11:52）
- 修改 `package.json`：
  - `build:pdf-home` 使用 `VITE_BUILD_ONLY=pdf-home` + 输出到 `dist/latest/static` + `--base=/pdf-home/`
  - `build:pdf-viewer` 使用 `VITE_BUILD_ONLY=pdf-viewer` + 输出到 `dist/latest/static` + `--base=/pdf-viewer/`
- 新增 dev 依赖：`cross-env@^7.0.3`，保证 Windows/Unix 跨平台设置环境变量。
\n
### 11.7 Windows 定向构建修复（2025-11-08 12:15）
- 问题：`cross-env` 未安装/不可用导致脚本失败。
- 方案：新增 `scripts/build-only.mjs`，直接用 Node API 调用 Vite，并在脚本内设置 `process.env.VITE_BUILD_ONLY`；`package.json` 的 `build:pdf-*` 改为调用该脚本。
\n
### 11.8 撤销最小修复（2025-11-08 12:49）
- 恢复 main.js 中的 `import "pdfjs-dist/web/pdf_viewer.css"`；移除 index.html 中的动态 import。
- 后续若需解决样式缺失，倾向采用“全量前端构建”路径验证。

### 11.9 Outline 同步修复（2025-11-08 13:35）
- 现象：编辑/重命名后 UI 未反映最新结果，被误判为“未保存”，实际请求已发送。
- 根因：前端未消费 `pdf-viewer:outline-list:complete`，仅发送 list 请求但未处理回执 → 内存未更新。
- 修复：
  - M `src/frontend/pdf-viewer/features/pdf-outline/index.js` 在 `#setupEventListeners()` 中订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`，当 `type === OUTLINE_LIST_COMPLETED` 时：
    1) `outlineManager.replaceFromRemote(data.outline_items)`，2) `#listReady=true`，3) `#refreshList()`，4) `#tryPendingNavigate()`。
  - M `src/frontend/pdf-viewer/outline/outline-manager.js` 新增 `replaceFromRemote(items)`，对远端树做深拷贝/规范化并重建索引。
  - M `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js` 保持默认 ERROR 级别，并支持 URL `?outlineLog=debug|info|warn|error` 动态提升日志级别以便排查。
- 防回归测试：
  - A 前端 `src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-sync-with-ws.test.js`：模拟 `OUTLINE_LIST_COMPLETED`，断言发出 `OUTLINE.LOAD.SUCCESS` 且内存更新。
  - A 后端 `src/backend/msgCenter_server/__tests__/test_outline_update_flow.py`：校验 `pdf-viewer:outline-update:request` 回应 complete，且服务端收到 update 载荷。

### 11.10 Outline 刷新后回退修复（2025-11-08 14:39）
- 现象：修改后本次会话内刷新了，但浏览器整体刷新后大纲“恢复原样”。
- 复盘：会话内通过 `outline-list:complete` 替换了内存，但未写入 LocalStorage；页面刷新后仅从 LocalStorage 读取 → 回退到旧状态；且启动阶段没有强制以“后端真相”为准拉取列表。
- 修复：
  - M `OutlineManager.replaceFromRemote()` → 异步化，并在替换内存后 `await saveToStorage()`，将远端真相落盘，确保刷新后不回退。
  - M `pdf-outline/index.js`：
    - 在 `FILE.LOAD.SUCCESS` 与 `CONNECTION.ESTABLISHED` 两个时机，若 `wsClient + pdfId` 就绪则主动 `outline-list:request`，以“后端真相”覆盖本地缓存；
    - 消费 `outline-list:complete` 的处理改为 `await outlineManager.replaceFromRemote(items)`（保证存储完成）。
  - 前端测试重写（覆盖“刷新后不回退”）：`outline-sync-with-ws.test.js` 新增“页面整体刷新后从 localStorage 恢复最近一次远端状态”的用例（先接收一次远端列表→重建实例→仅触发文件加载→应从存储恢复到最新）。
  - 日志开关：使用 `?outlineLog=debug` 可在实机复现中观测以下阶段日志：FILE.LOAD.SUCCESS 初始加载→初始 outline-list:request → outline-list:complete → replaceFromRemote + saveToStorage。

## 12) “大纲树渲染完成并已展开”出现三次（2025-11-08 23:28）
- 现象来源：日志来自 `OutlineSidebarUI.#renderTree()` 在绑定 `ready.jstree` 的回调中打印。单次 ready == 单次树重建完成。
- 触发链回放（见 dist/latest/logs/pdf-viewer-*-js.log）：
  - T0≈23:18:28：从本地存储恢复后渲染一次（`OutlineManager.loadOutline → source=storage`）；
  - T1≈23:18:29：为兼容旧流程，在导入原生大纲之前广播一次“成功”（`source=pdf-native`）→ 触发 UI 重建；
  - T2≈23:18:31：完成标准化/解析后再次广播“成功”（`source=pdf`）→ 触发 UI 重建。
  - 同时 `features/pdf-outline/index.#refreshList()` 也会广播 `OUTLINE.LOAD.SUCCESS (source=pdf-outline)`，造成额外的 SUCCESS 风暴；部分重建在 ready 之前被下一次重建覆盖，因此最终可见 ready 约 3 次。
- 结论：这三次日志并非简单“重复打印”，而是多次“成功事件”导致的多次树重建的自然结果。
- 收敛建议（最小改动）：
  - UI 侧：仅在 `data.source ∈ {'pdf','storage'}` 时渲染；忽略 `pdf-native` 与 `pdf-outline`。在每次渲染前执行 `$tree.off('ready.jstree')`，避免处理器累积。
  - 事件侧：将 `#refreshList()` 的广播改名或移除，另将“原生大纲发现”改为专用事件（如 `OUTLINE.NATIVE.DETECTED`），避免与“完成态”复用同一事件名。
  - 测试：补充用例覆盖“存储+原生+最终态”场景下 UI 只出现一次“渲染完成”提示。

## 13) 大纲加载策略变更（2025-11-09 00:10）
- 目标：去掉本地缓存机制，改为“后端优先、一次渲染”：
  1) 先向后端请求大纲；若非空，直接使用并只发一次 `OUTLINE.LOAD.SUCCESS`；
  2) 若后端为空，则从 PDF 提取原生大纲，标准化后一次性 `OUTLINE_BULK_SAVE` 保存到后端；
  3) 保存成功（或超时容忍）后再次请求后端列表；以“后端真相”发出一次 `OUTLINE.LOAD.SUCCESS` 并渲染；
  4) 整个流程仅有一次最终渲染（SidebarUI 的 jsTree ready 也只出现一次）。
- 实施要点：
  - `src/frontend/pdf-viewer/outline/outline-manager.js` 支持 `disableAutoLoad` 选项；开启后不再自动订阅 `FILE.LOAD.SUCCESS/OUTLINE.LOAD.REQUESTED` 且不会主动发 `SUCCESS`；
  - `src/frontend/pdf-viewer/features/pdf-outline/index.js` 新增 `#initialLoadFromBackend()` 统一编排；WS 消息在初始化阶段不触发 UI 刷新，最终阶段一次性 `#refreshList('backend')`；
  - `OutlineManager.replaceFromRemote()` 不再写入 LocalStorage；本地缓存路径废弃。
- 测试：`src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-sync-with-ws.test.js` 更新/新增用例，覆盖“后端空→导入→持久化→再拉取→仅一次渲染”。

## 14) Lint 全量治理（2025-11-09 00:45）
- 目的：清理全仓 ESLint 报错，保持功能不变，聚焦样式与静态问题。
- 范围与修复：
  - 自定义规则：`eslint-rules/event-name-format.js` 去掉未用函数；规则仍强制用命名空间常量引用事件名；
  - 脚本：`scripts/build-only.mjs` 统一双引号/缩进；`scripts/ci/ws-contract-diff.mjs` 正则去除多余转义；
  - 测试：统一 quotes/curly；修正字符串包含断言中的引号转义；
  - 业务：`pdf-manager-refactored.js` 去除未用变量与未定义引用。
- 结果：`pnpm run lint` 全量通过；pdf-outline 子集测试通过（legacy 初始导入流测试待改写以匹配新流程）。

## 15) 稳定性方案建议摘要（2025-11-09 02:10）
- 契约唯一真源：以 Schema/枚举生成双端常量（WS 消息、API DTO、事件名），并在 CI 对生成物做“差异门禁”，禁止未同步的手改。
- 初始化状态机：定义 `Idle→AwaitFile→List→(Import→BulkSave→Relist)?→Ready|Error` 的显式状态与转移，前端测试按状态断言，不再依赖超时。
- 空值语义统一：后端无记录一律 `null`，存在但空为 `[]`；在单测与 WS handler 测试里加断言（已部分落地）。
- 金标回放：为常见 PDF 场景维护 `fixtures/outline-golden/*.json`（输入 PDF 与最终后端列表）；在集成测试中断言规范化输出一致。
- 去重渲染：`OUTLINE.LOAD.SUCCESS` 仅用于最终态；UI 只接受 `source ∈ {'pdf','storage','backend'}` 的一次渲染；其余事件改名或降级为 DEBUG。
- 诊断与追踪：维持 Outline handler DEBUG；回执带 `requestId` 串联端到端日志（可选，前端生成即可）。

## 16) URL/WS 统一跳转机制（2025-11-09 20:03）
- 统一执行器：`src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js:79` `navigateTo({ pageAt, position })` 发 `PDF_VIEWER_EVENTS.NAVIGATION.GOTO` 并在 DOM 就绪后滚动到百分比。
- URL 路径：
  - 解析：`src/frontend/pdf-viewer/features/infra-nav-url/components/url-params-parser.js` 支持 `pdf-id/page-at/position/anchor-id/annotation-id/outline-item-id`；Feature 主体 `index.js:133` 发 `URL_PARAMS.PARSED`；`#handleNavigationRequested:442` 在校验后调用 `navigationService`。
  - 分派：`src/frontend/pdf-viewer/features/infra-nav-url/components/url-jump-dispatcher.js:44` 将 ID 类参数分派给对应特性（annotation/anchor/outline）。
- WS 路径：
  - 适配：`src/frontend/pdf-viewer/adapters/websocket-adapter.js:547` `#handleNavigatePage` 与 `:593` `#handleViewerNavigate` 将 WS 指令映射到与 URL 相同的事件（包括 `NAVIGATION.URL_PARAMS.REQUESTED` 及各域的 `*.REQUESTED`）。
- “回到自己的插件系统取页码”：
  - Outline：`src/frontend/pdf-viewer/features/pdf-outline/index.js:552` `#handleNavigateById` 取 `OutlineManager.getOutlineItem(id)` 的 `pageAt/position` 后 `navigateTo`；列表来源统一通过 WS 的 `OUTLINE_LIST_COMPLETED` → `replaceFromRemote`。
  - Annotation：`src/frontend/pdf-viewer/features/pdf-annotation/index.js:314` 监听 `ANNOTATION.NAVIGATION.JUMP_REQUESTED`，依据标注数据计算 `pageNumber/position`，最终统一发 `NAVIGATION.URL_PARAMS.REQUESTED:637`。
  - Anchor：`src/frontend/pdf-viewer/features/pdf-anchor/index.js:236` 监听 `ANCHOR.NAVIGATE.REQUESTED`；在锚点数据与渲染就绪后，经 `#tryNavigateWhenGatesReady:475` 发 `NAVIGATION.URL_PARAMS.REQUESTED`。
- 事件常量：统一在 `src/frontend/common/event/pdf-viewer-constants.js` 中维护，禁止魔法字符串；全局事件须走白名单。

结论：URL 与 WS 两条入口均汇聚到 `URLNavigationFeature → NavigationService` 的同一跳转通道；ID → 页码 的解析分别由各功能特性负责，保证职责内聚与解耦。

## 16.1) No-op 错误处理模式分析（2025-11-10 08:25）
- 背景：项目中存在大量 `catch { /*no-op*/ }` 或类似模式，可能导致错误被静默抑制，影响可观测性与数据一致性。
- 分析范围：15个关键JavaScript文件，涵盖前端各主要模块（pdf-viewer、pdf-home、common）。
- 统计结果：共发现 **96个no-op实例**
  - **Type A（合理降级）**: 21个（22%）- 如logger初始化失败、UI横幅更新失败
  - **Type B（需添加日志）**: 49个（51%）- 如事件发送失败、DOM操作失败
  - **Type C（严重问题）**: 26个（27%）- 如IndexedDB操作失败、用户交互无反馈
- 关键问题：
  - **indexeddb-cache-manager.js**（行301, 303）：游标删除/继续操作失败被抑制，存在数据损坏风险
  - **annotation-sidebar-ui.js**（行146）：卡片跳转失败无用户反馈
  - **anchor-sidebar-ui.js**（28个实例）：大量UI操作/事件清理失败被抑制
  - **websocket-adapter.js**（行310, 318）：IndexedDB同步失败被抑制
- 修复建议：
  - P0（立即修复）：indexeddb-cache-manager.js、annotation-sidebar-ui.js、websocket-adapter.js的Type C实例
  - P1（1-2周）：anchor-sidebar-ui.js、pdf-anchor/index.js的高频实例
  - P2（长期）：Type A实例的日志优化
- 输出：`AItemp/reports/20251110-no-op-analysis.md`（包含详细分类、代码位置、修复模板、验收标准）
- 后续行动：
  1. 与开发团队评审报告，确定修复优先级
  2. 针对P0问题创建紧急修复任务
  3. 建立ESLint规则防止新增no-op模式

## 17) 端到端验证（2025-11-09 21:58）
- 浏览器 E2E（Playwright）定点执行：
  - 命令：
    - `pnpm run build:pdf-viewer`
    - `pnpm exec playwright install --with-deps chromium`
    - `pnpm exec playwright test -c ./playwright.config.js tests/e2e/browser/pdf-viewer-nav-url-and-ws.e2e.spec.mjs`
  - 结果：2/2 通过（URL 启动触发、WS 运行时触发；均覆盖 page/annotation/anchor/outline 四类）
  - 备注：如需全量浏览器 E2E，使用 `pnpm run e2e:browser`（会先构建）。

## 18) Anchor（锚点）导航与激活逻辑（2025‑11‑09）
- URL 启动（带 `anchor-id`）：
  - `infra-nav-url` 解析参数 → `URLJumpDispatcher` 发出 `PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED`；
  - `pdf-anchor` 在 `ANCHOR.DATA.LOADED` + 渲染就绪（`RENDER.READY` 或 `FILE.LOAD.SUCCESS` 兜底）后，通过 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 发起跳转；
  - 同时设置内部 `#activeAnchorId`，启用滚动诊断以“实时回写位置”（默认心跳关闭，仅滚动触发 `UPDATE` 写回）。
- WebSocket 跳转锚点：
  - `adapters/websocket-adapter` 收到 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED{ target.type='anchor' }` → 发 `PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED`；
  - 由 `pdf-anchor` 门闸后跳转；“不会立即激活”（不触发 `ANCHOR.ACTIVATE` / `ANCHOR.ACTIVATED`）。
- 侧栏按钮：
  - 添加：UI 生成/收集表单 → 发 `ANCHOR.CREATE`（UI 提供 uuid 时直通；无负载时由 `pdf-anchor` 生成 uuid 并补齐再发给 WS）；
  - 修改：发 `ANCHOR.UPDATE`，`pdf-anchor` 本地更新并广播 `ANCHOR.UPDATED` 与刷新列表；
  - 复制：单测已覆盖（`anchor-sidebar-copy.test.js`）；
  - 删除：发 `ANCHOR.DELETE`，`pdf-anchor` 本地删除并广播列表；
  - 激活：`ANCHOR.ACTIVATE` 在 `pdf-anchor` 内保证“单选”，并广播 `ANCHOR.ACTIVATED` 与刷新列表。
- 测试策略（本次新增）：
  - 单测：激活单选、CRUD 事件、WS → Anchor 跳转但不激活；
  - E2E：侧栏按钮链路（添加/修改/删除/激活单选）。

## 19) 端到端（直连数据库层）测试补充（2025‑11‑09 22:30）
- 新增用例：`tests/e2e/browser/pdf-viewer-anchor-activate.to-db.e2e.spec.mjs`
  - 行为：启动真实 `msgCenter_server`（传入 `--data-dir` 与 `--db-path` 指向 `AItemp/e2e-db-<ts>`），使用 Node WebSocket 客户端发送：
    1) `pdf-library:add:requested { file_path: <repo>/public/test.pdf }` → 建立 `pdf_info` 记录；
    2) `anchor:create:requested` ×2（同一 `pdf_uuid`）；
    3) `anchor:activate:requested` 激活第二个锚点；
    4) `anchor:list:requested` 软校验服务端正常应答；
  - 目的：覆盖“WS→API→DB 插件”的真实链路；在“最终写入数据库”的文件断言处停止（仅断言 *:completed 应答），避免污染生产数据。
  - 清理：测试结束时终止 WS 子进程并删除临时数据目录。

## 20) QtWebEngine 前端测试基座（2025‑11‑09 22:50）
- 基座路径：`tests/e2e/qtwebengine/qt_harness.py`（文档：`tests/e2e/qtwebengine/README.md`）
- 能力：
  - 无阻塞运行：不 `app.exec()`，通过 `processEvents()` 驱动事件循环，所有步骤有超时；
  - 启停真实 WS（msgCenter_server，直连 SQLite 临时库）；
  - 启停 Python 静态服（严格路由：/pdf-viewer/ 指向 dist、/assets/ 指向 dist assets、/public/ 指向仓库 public）；
  - Viewer API：`start_viewer(url) / evaluate(js) / wait_for(js|selector) / click(selector) / inject_probe() / get_events()`；
  - 环境默认无头（`QT_QPA_PLATFORM=offscreen`、`QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu --headless=new`）。
- 最小示例：`tests/e2e/qtwebengine/test_smoke_viewer_qt.py`（加载 viewer、打开锚点侧栏、等待表格/空态）。

## 22) 阅读历史（Resume Reading）设计决策（2025-11-10 12:29 更新）
- 目标：为 pdf-viewer 提供“默认常驻、零提示即可记录并在下次自动恢复”的最近阅读位置能力；当且仅当不存在任何显式跳转（URL/WS/Anchor）时应用。
- 现状：Anchor 插件负责显式书签/外部跳转；默认不开启心跳；其语义为“用户书签”，不宜承担“临时历史”。

### 决策（以服务端为主）
- 模块：独立 `ReadingHistoryService`（viewer Feature，常驻）。
- 存储：写入服务端 DB 的 `pdf_info.json_data.resume`（对象）；读取在 viewer 冷启动时通过 WS `pdf-library:info:requested` 获取；默认不使用本地兜底。
- 应用顺序（严格优先级）：
  1) 显式 URL/WS 导航（`pdf-viewer:navigate:requested` / URL `anchor-id` / `annotation_id` / `page/xy`）；
  2) 已激活 Anchor 导航/心跳；
  3) `json_data.resume`（最近阅读位置）；
  4) 默认首页（1 页）。
- Fail‑Fast：恢复数据无效（越界/结构错误）时 toast + 日志，并退回首页；不静默。

### 数据模型（v1，服务端 JSON）
```json
{
  "json_data": {
    "resume": {
      "page": 12,
      "y_percent": 0.35,
      "zoom": 1.0,
      "rotation": 0,
      "updated_at": 1731220000000
    }
  }
}
```
- 写入消息（WS）：`pdf-library:record-update:requested`
```json
{
  "file_id": "<pdf_uuid>",
  "updates": {
    "visited_at": 1731220000000,
    "json_data": { "resume": { "page": 12, "y_percent": 0.35, "zoom": 1.0, "rotation": 0, "updated_at": 1731220000000 } }
  }
}
```
- 读取消息（WS）：`pdf-library:info:requested { "pdf_id": "<pdf_uuid>" }`

### 事件接入（前端）
- 启动：`FILE.LOAD.SUCCESS` 或 PDF.js `pagesinit` → 发送 `pdf-library:info:requested`；若检测到显式跳转请求，跳过应用 resume。
- 更新：监听 `pagechanging` + 滚动空闲节流（2~3s）→ 发送 `record-update:requested`；`beforeunload` 最后一次刷新。
- 观测：`logger.debug("reading-history:update", {page,y_percent})`；异常 `logger.error(...,{toast:true})`。

### 与 Anchor 协同
- 不创建“系统 Anchor”，不进入 Anchor 列表；职责解耦。
- Anchor 导航期间仍后台记录“真实阅读进度”。

### 设置项（默认）
- `resumeReading.enabled = true`
- `resumeReading.applyMode = "ifNoExplicitJump"`
- `resumeReading.throttleMs = 2500`
- `resumeReading.transport = "ws"`（后续可扩展 `"http"`）

### 测试计划（QtWebEngine）
- 单元
  - 消息构造与数据校验（页码/比例/zoom/rotation/时间戳）
  - 优先级守卫：显式跳转存在时不得应用 resume
- 集成
  - 打开文档→翻页→（节流）写库→关闭→重开→自动恢复到最近位置
  - URL `anchor-id` 存在→应跳过 resume；再次无 URL → 应恢复 resume
  - 非法 resume → toast + 回首页
- E2E（QtWebEngine 基座）
  - 真实 WS + SQLite：断言 `pdf_info.json_data.resume` 随浏览推进更新；重启会话后自动恢复。

### 2025-11-10 13:24 实施进度
- 已实现前端特性域：`pdf-resume`（类 `PDFResumeFeature`），并在引导中注册（位置：URL 导航之后、Anchor 之前）。
- 新增事件常量：`PDF_VIEWER_EVENTS.RESUME.*`；新增单测 2 条（info 请求与 record-update 发送），通过。
- 下一步：补 QtWebEngine E2E 与后端回归用例。

### 2025-11-10 15:01 输入事件更新策略
- 新增：以“鼠标滚动（wheel）与鼠标点击（click）”作为更新当前页码与触发写库的用户信号源：
  - wheel：取视口中心所在页为当前页；
  - click：命中页优先，否则回落中心页；
  - 两者均走统一节流路径（2.5s）发送 `pdf-library:record-update:requested`。
- 实现：`pdf-resume/index.js` 内 `#attachUserInputListeners()`、`#detectCenterPageNumber()`；在 `install/uninstall` 中挂/卸事件。

### 2025-11-10 11:52 执行记录（P0 首批提交）
- 已修改：slint.config.js 禁止空 catch（产品代码）；tests 允许 llowEmptyCatch: true；忽略 public/js/**。
- 已修复：
  - IndexedDB 清理：cursor.delete/continue 空 catch → warn；continue 失败时 esolve() 防挂起。
  - WebSocketAdapter：mit 失败空 catch → warn；toast 记录失败改 oid e。
  - AnnotationSidebarUI：跳转链路空 catch → oid e。
- 新增测试：
  - src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.anchor-emit-catch.test.js（emit 抛错→console.warn）
  - src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.jump-error-logs.test.js（缺 id 跳转→console.error）
- 待办：补 IndexedDB 游标异常的单测（引入 fake-indexeddb 或本地 stub）。

### 2025-11-10 13:21 执行记录（P1 第一批：pdf-anchor）
- AnchorSidebarUI：初始化渲染空 catch → debug 日志。
- PDFAnchorFeature：将多处 no-op/空 catch 改为最小日志（toast 相关使用 void e，诊断/激活使用 debug/warn）。
- 轮询/清理相关的 clearInterval/clearTimeout/DOM 操作 catch 增加保护，防止 Promise/定时器悬挂。

### 2025-11-10 14:43 执行记录（P1 第二批：screenshot + pdf-outline）
- Screenshot：移除空 catch（改 debug/void e），完善 pdf.js 事件注册/解绑与队列 flush 的失败日志。
- pdf-outline：index.js 与 outline-sidebar-ui.js 的空 catch 改为 oid e 或最小日志；jsTree 初始化/销毁、选择/拖拽路径具备可追踪性。
- 计数校验：screenshot 空 catch=0；pdf-outline 空 catch=10（全部测试文件，tests 允许 llowEmptyCatch: true）。

### 2025-11-10 15:04 规则化治理（no-silent-catch）
- 新增 ESLint 规则 custom/no-silent-catch：禁止 catch(e){ void e; }，允许 /* logger-guard */ 或 try 块仅含日志/通知调用。
- 已替换/标注：infra-nav-url、url-jump-dispatcher、pdf-home SearchBar 等所有产品代码中的静默捕获。
- 扫描验证：产品代码中已无 catch(e){ void e; }；tests 目录关闭该规则。
