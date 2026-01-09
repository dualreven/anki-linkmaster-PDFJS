# 系统架构（极简索引）

## 2025-11-10 GUI Launcher 模块化（阶段一）
- 新增层次：`src/gui_launcher/workers.py` 承载线程类（`LauncherThread`、`_AiThread`），负责 CLI/Hosted 的启动编排；不包含 UI 与业务控制，简化入口文件体积。
- 入口关系：`gui_launcher.py` 仅作为 UI 主入口与装配层，通过“名称重绑定”将线程实现委托给 `workers` 模块，后续可逐步迁移 UI 到 `ui.py`，控制器到 `controller.py`。
- 兼容性：对外 API（类名/函数名）保持不变；测试路径与调用契约不变。

目的：将“架构本体”沉淀到 docs/architecture 专题文档；此文件仅保留最小要点与索引。

- 架构要点（立即理解）
  - **开发环境**：强制使用 Python 虚拟环境（venv/virtualenv/conda），避免依赖冲突和环境污染。详见 docs/architecture/environment.md。
  - 分层与边界：前端（pdf-home、pdf-viewer）纯 UI；后端由 WS 转发器、HTTP 文件服务器、PDF 业务服务器（预留）构成。
  - **Feature隔离**：跨Feature调用必须通过EventBus或Container，禁止直接import其他Feature的内部实现（ESLint: `custom/no-cross-feature-internals`）。详见 `src/frontend/HOW-TO-ADD-FEATURE.md`。
  - 运行形态：源码（Vite/Hosted is_prod=false）与分发（静态路由 /static、/pdf-home、/pdf-viewer）。
  - 事件与作用域：统一 EventBus；跨模块 onGlobal/emitGlobal；ScopedEventBus 以 SCOPE_ID 稳定命名。
  - 导航互斥：URL 导航与 WS 导航不可并发；跨文档导航在 FILE.LOAD.SUCCESS 恢复。
  - 原则：Fail‑Fast，无兜底；UTF-8 + `\n`；目录 kebab-case。
  - Outline-only：后端只接受 `outline_id`；API 直连 `PDFOutlineTablePlugin`；严禁 `bookmark_*` 字段与回退路径。
  - 窗口生命周期：后端通过 `WindowLifecycleManager` 以统一的 `client_id`（如 `pdf-home`、`pdf-viewer-<pdf_id>`）管理窗口对象与 QWebSocket 客户端，所有 Hosted 窗口的打开/关闭均经由 MsgCenter 消息与 closeEvent 信号双向驱动。
  - Outline 加载策略（2025‑11‑09）：去掉前端本地缓存；查看器加载时统一走"后端优先"单次渲染：`outline-list → (empty? import from PDF → bulk-save) → outline-list → OUTLINE.LOAD.SUCCESS`。
  - Memory Bank 压缩：memory-bank 采用三层结构（L0 永久规范层 / L1 最近7天上下文 / L2 工作过程层），通过 `context.md` + `docs/context-archive/` + `AItemp` 归档目录实现高信噪比的历史保留与压缩，具体规则见 `.kilocode/rules/memory-bank/compression.md`。

- 主题索引（详细说明见 docs/architecture）
  0) **开发环境配置（Python 虚拟环境）** → docs/architecture/environment.md
  1) 总览与组件 → docs/architecture/overview.md
  2) 分层模型与 Feature/Bus → docs/architecture/layers.md
  3) 导航与互斥策略 → docs/architecture/navigation.md
  4) 设计原则（Fail‑Fast 等） → docs/architecture/principles.md
  5) 关键组件（WS/HTTP/PDF 服务） → docs/architecture/components.md
  6) 构建与运行（源/分发） → docs/engineering/build-run.md

维护记录
- 2025-01-09 新增开发环境配置要点（Python 虚拟环境强制使用），在架构要点第一条和主题索引第0条明确说明。
- 2025-11-07 精简为索引版；详细内容迁移到 docs（见 todo-and-doing/1 doing/20251107-architecture-md-minify-migration/plan.md）。
- 2026-01-01 前端治理：`ScreenshotTool` 内部模块化（预览弹窗/marker 渲染/rect utils 抽离），对外接口不变，作为“面条治理 P1”的可复用拆分样例。
- 2026-01-01 前端治理续：进一步把 `ScreenshotTool` 的“框选与鼠标事件”与“capture/save 流程”抽到独立模块，主 `index.js` 逐步收敛为装配层。
- 2026-01-01 前端治理续2：把 `ScreenshotTool` 的“标注事件订阅”和“marker pending 队列”抽离，主 `index.js` 下降到 ≤500 行。
- 2026-01-01 前端治理续3：`TextHighlightTool` 内部模块化（订阅/渲染控制器/交互流程/confirm/clipboard/ui 渲染拆分），主 `index.js` 下降到 ≤500 行；确认弹窗按 Fail‑Closed（异常/无DOM 返回 false）。
- 2026-01-02 前端治理续4：`UIManagerCore` 拆分为事件订阅/控件装配/交互监听/复制按钮/标题更新等模块，主 `ui-manager-core.js` 下降到 ≤500 行，并补齐 destroy 解绑 wheel/resize 的防回归测试。
- 2026-01-02 前端治理续5：`CommentTool` 拆分为页面渲染监听/标注事件订阅/标记恢复/交互流/UI/确认弹窗等模块，主 `comment/index.js` 下降到 ≤500 行，并修复 destroy 崩溃与订阅泄漏风险（Fail‑Closed 删除确认）。
- 2026-01-02 前端治理续6：`WebSocketAdapter` 收敛为装配/路由层，拆出出站订阅与入站 `load_pdf_file` / viewer navigate 处理模块，主 `websocket-adapter.js` 下降到 ≤500 行（详见 `docs/standards/websocket-adapter.md`）。
- 2026-01-02 前端治理续7：`FilterBuilder v2`（pdf-home 高级筛选）拆出模板/渲染/DOM事件/tree→config 等小模块，主 `filter-builder-v2.js` 下降到 ≤500 行（详见 `docs/standards/filter-builder-v2.md`）。
- 2026-01-02 前端治理续8：`PDFEditFeature`（pdf-home 记录编辑）拆出表单模板/组件/全局提示/重置按钮/提交流程等模块，主 `pdf-edit/index.js` 下降到 ≤500 行（详见 `docs/standards/pdf-edit-feature.md`）。
- 2026-01-02 前端治理续9：`AnnotationFeature`（pdf-viewer 标注容器）拆出自动加载/跳转/按钮/pdfId 解析等模块，主 `pdf-annotation/index.js` 下降到 ≤500 行（详见 `docs/standards/pdf-annotation-feature.md`）。
- 2026-01-02 前端治理续10：`SavedFiltersFeature`（pdf-home 侧边栏已存搜索条件）拆出对话框/纯逻辑/工具函数等模块，主 `saved-filters/index.js` 下降到 ≤500 行（详见 `docs/standards/pdf-home-saved-filters.md`）。
- 2026-01-02 前端治理续11：`OutlineManager`（pdf-viewer 大纲）拆出 bulk-save 扁平化/初始加载/按ID导航/CRUD 等模块，主 `pdf-outline/index.js` 下降到 ≤500 行（详见 `docs/standards/pdf-outline-feature.md`）。
- 2026-01-03 前端治理续12：`Logger` 抽离运行时配置到 `src/frontend/common/utils/logger-runtime-config.js`，主 `logger.js` 下降到 ≤500 行（详见 `docs/standards/logger.md`）。
- 2026-01-03 前端治理续13：`PDFSorterFeature`（pdf-home 排序）拆出 UI 装配/事件 wiring/handler/public API，主 `pdf-sorter/index.js` 下降到 ≤500 行（详见 `docs/standards/pdf-sorter-feature.md`）。
- 2026-01-03 前端治理续14：`FeatureRegistry`（micro-service）拆出 record/validators/deps/context，主 `feature-registry.js` 下降到 ≤500 行（详见 `docs/standards/feature-registry.md`）。
- 2026-01-03 前端治理续15：`TranslatorSidebarUI`（pdf-translator）拆出 renderer/actions/dom-bindings/history，主 `TranslatorSidebarUI.js` 下降到 ≤500 行（详见 `docs/standards/pdf-translator-sidebar.md`）。
- 2026-01-03 前端治理续16：`AnchorSidebarUI`（pdf-anchor）拆出 toolbar/dialog/table，主 `anchor-sidebar-ui.js` 下降到 ≤500 行，并修复 toolbar document click 监听泄漏（详见 `docs/standards/pdf-anchor-sidebar-ui.md`）。
- 2026-01-03 前端治理续17：`WeightedSortEditor`（pdf-sorter component）拆出 constants/template/formula/view，主 `weighted-sort-editor.js` 下降到 ≤500 行（详见 `docs/standards/pdf-sorter-weighted-sort-editor.md`）。
- 2026-01-09 前端治理：`infra-sidebar` 抽离 `DraggableResizer` 组件，确保“拖拽中途销毁/卸载”也能对称解绑 document 监听器，并补回归测试。

## 2025-11-10 阅读历史模块纳入
- 组件：`ReadingHistoryService`（viewer Feature，常驻；注册顺序紧随 navigation/URL 层之后，早于 Anchor/Sidebar）
- 依赖：`eventBus`、`navigationService`（可选；若缺失回退为 DOM 导航）、`websocketAdapter`（发送/接收库消息）
- 职责：
  - 启动后拉取 `pdf-library:info:requested` 并按优先级链应用 `json_data.resume`
  - 监听页变更/滚动空闲（节流）→ 发送 `pdf-library:record-update:requested` 写入 `json_data.resume` 与 `visited_at`
  - 统一错误提示与日志（Fail‑Fast），不做本地兜底
- 数据：服务端持久化 `pdf_info.json_data.resume`；字段：`page,y_percent,zoom,rotation,updated_at`
- 与 Anchor：职责解耦，不进入 Anchor 列表，不提供激活/删除等 UI 行为

## 2025-11-10 后端Linters模块（代码质量检查）
- 模块位置：`src/backend/linters/`
- 目的：为Python后端代码提供自定义Pylint检查器，强制执行项目特定的代码规范
- 组件：
  1. **table_event_lint_checker.py** - 数据库插件事件常量检查器（错误代码：E9001）
     - 检测 `event_bus.on/emit/once()` 中的字符串字面量
     - 强制使用 `TableEventConstants.*` 常量
     - 提供智能修复建议（自动推荐对应常量名）
     - 白名单机制：排除框架文件（`event_bus.py`、`table_event_constants.py`）
  2. **__init__.py** - Linter包初始化，支持条件导入（Pylint未安装时降级）
- 使用方式：
  ```bash
  python -m pylint \
    --load-plugins=linters.table_event_lint_checker \
    --enable=E9001 \
    database/plugins/your_file.py
  ```
- 集成建议：
  - 配置文件：`pyproject.toml` 或 `.pylintrc` 中启用自定义检查器
  - CI/CD：在持续集成流程中作为质量门禁
  - Pre-commit：通过pre-commit hooks在提交前自动检查
- 扩展性：可按需添加更多自定义检查器（如数据库Schema验证、API契约检查等）
