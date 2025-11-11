# 系统架构（极简索引）

## 2025-11-10 GUI Launcher 模块化（阶段一）
- 新增层次：`src/gui_launcher/workers.py` 承载线程类（`LauncherThread`、`_AiThread`），负责 CLI/Hosted 的启动编排；不包含 UI 与业务控制，简化入口文件体积。
- 入口关系：`gui_launcher.py` 仅作为 UI 主入口与装配层，通过“名称重绑定”将线程实现委托给 `workers` 模块，后续可逐步迁移 UI 到 `ui.py`，控制器到 `controller.py`。
- 兼容性：对外 API（类名/函数名）保持不变；测试路径与调用契约不变。

目的：将“架构本体”沉淀到 docs/architecture 专题文档；此文件仅保留最小要点与索引。

- 架构要点（立即理解）
  - **开发环境**：强制使用 Python 虚拟环境（venv/virtualenv/conda），避免依赖冲突和环境污染。详见 docs/architecture/environment.md。
  - 分层与边界：前端（pdf-home、pdf-viewer）纯 UI；后端由 WS 转发器、HTTP 文件服务器、PDF 业务服务器（预留）构成。
  - 运行形态：源码（Vite/Hosted is_prod=false）与分发（静态路由 /static、/pdf-home、/pdf-viewer）。
  - 事件与作用域：统一 EventBus；跨模块 onGlobal/emitGlobal；ScopedEventBus 以 SCOPE_ID 稳定命名。
  - 导航互斥：URL 导航与 WS 导航不可并发；跨文档导航在 FILE.LOAD.SUCCESS 恢复。
  - 原则：Fail‑Fast，无兜底；UTF-8 + `\n`；目录 kebab-case。
  - Outline-only：后端只接受 `outline_id`；API 直连 `PDFOutlineTablePlugin`；严禁 `bookmark_*` 字段与回退路径。
  - Outline 加载策略（2025‑11‑09）：去掉前端本地缓存；查看器加载时统一走"后端优先"单次渲染：`outline-list → (empty? import from PDF → bulk-save) → outline-list → OUTLINE.LOAD.SUCCESS`。

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
