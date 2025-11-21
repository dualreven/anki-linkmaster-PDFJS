# Memory Bank - Context（精简版）

最后更新：2025-11-20
归档策略：保留最近7天变更记录，历史见 docs/context-archive/

---

## 1) 项目硬约束（永久保留）
- **Python 虚拟环境强制使用**：所有开发必须在 Python 虚拟环境中进行（venv/virtualenv/conda），避免依赖冲突和环境污染。详见 `docs/architecture/environment.md`。
- **文件编码**：显式 UTF-8 + 统一换行 `\n`
- **事件命名**：强制三段式 `{module}:{action}:{status}`；全局事件需通过白名单（global-event-registry）放行
- **Fail-Fast 原则**：禁止兜底，契约不匹配必须失败
- **DRY 原则（Don't Repeat Yourself）**：
  - **开发前搜索**：添加任何功能前必须先搜索项目中是否已有实现（使用 Glob/Grep 工具搜索相关文件和关键词）
  - **禁止重复实现**：禁止跨模块重复（如 pdf-home 和 pdf-viewer 各自实现报错逻辑）、禁止同模块内重复（如同一模块中存在两套相同逻辑）
  - **发现重复时的处理**：如发现高度雷同功能，**必须询问用户**是否抽象为共享模块（如 `src/frontend/common/`），禁止自行决定复制代码
  - **典型错误案例**：PDF-Home 和 PDF-Viewer 各自实现独立的错误处理逻辑（应抽象到 `common/utils/` 或 `common/services/`）

## 2) 关键协议（最新版）

### 2.1 WebSocket 消息常量
- 前端：`WEBSOCKET_MESSAGE_TYPES.*`（pdf-library/outline/annotation/anchor等）
- 后端：`MessageType(Enum)` + `msg_router.py` 显式路由
- 两端值必须一致

### 2.2 Outline 域协议
- 类型：`outline:{list|create|update|delete|reorder}:{requested|completed|failed}`
- list 返回：`data.outline_items: Array<{id,name,pageAt,position,children[]}>`
- 后端 API：严格使用 `PDFOutlineTablePlugin`，不接受 `bookmark_id` 回退
- 加载策略（2025-11-09）：后端优先、一次渲染，去掉前端本地缓存

### 2.3 MsgCenter 转发规则（2025-11-14）
- **严格"目标对象存在性"原则**：MsgCenter 不做业务处理，仅负责转发；任何入站 `*:requested` 消息，必须能被明确投递到目标对象；否则一律失败，禁止静默或"伪完成"
- **Viewer 目标**：必须命中 `viewer_id/pdf_uuid`，未命中返回 `NO_TARGET_OBJECT`(404)
- **后端服务**：按域前缀检查必要的上下文对象：
  - `pdf-library:*` → 需要 `ctx.pdf_library_api` 或 `ctx.pdf_manager`
  - `pdf-viewer:outline-*|annotation:*|anchor:*|bookmark:*` → 需要 `ctx.pdf_library_api`
  - `pdf-viewer:pdf_pages*` → 需要 `ctx.pdf_manager`
- **客户端身份**：除 `client:register` 和 `pdf-viewer:register` 外，任何入站消息若 socket 未在 `_client_identity` 中，返回 `CLIENT_NOT_REGISTERED`(401)

### 2.4 事件常量使用规范
- **前端**：禁止字符串字面量，必须使用命名空间常量（`*_EVENTS`、`*_MESSAGE_TYPES`、`PDF_VIEWER_EVENTS`、`WEBSOCKET_EVENTS`）
- **后端**：数据库插件事件必须使用 `TableEventConstants.*`（E9001 Pylint 检查）
- **ESLint规则**：`custom/event-name-format` 强制使用常量，`custom/no-event-literal` 禁止字符串事件
- **WebSocket响应常量**：使用 `WEBSOCKET_MESSAGE_EVENTS.RESPONSE`，切勿写成 `WEBSOCKET_EVENTS.MESSAGE.RESPONSE`

## 3) AI 协作与 Plan 模式

- **触发范围**：所有会产生副作用的操作(修改代码/文档、创建/删除文件、运行会写入磁盘或数据库的脚本/测试等)，都必须采用“先 Plan 后执行”的协作模式。
- **Plan 内容要求**：在执行前，AI 必须在对话中给出可审核的 Plan，至少包含：本次任务目标、问题背景、涉及模块和关键文件、计划修改点与步骤、测试/验证方式、可能风险与回滚思路。
- **执行顺序**：
  1. 读取最近 8 个 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`，总结上次目标和结果；
  2. 创建新的 `AItemp/[YYYYMMDDhhmmss]-AI-Working-log.md`，记录本次目标和计划实现方法；
  3. 在对话中输出详细 Plan，并等待用户明确确认(如“确认按此 plan 执行”)；
  4. 仅在获得确认后，才允许调用 `apply_patch` 或其他具有写入/副作用的命令，按 Plan 执行修改和测试；
  5. 执行完成后，更新 `context.md` / `architecture.md` / `tech.md` 中与本次任务相关的长期信息，并补充 AI-Working-log 的“结果”和“后续处理”。
- **思考流程**：在整个 Plan 与执行过程中，始终遵循 sequentialthinking 原则——“基于事实 → 存在困境 → 提出猜想 → 进行验证 → 合理执行”，禁止在缺乏事实依据时盲目修改。
- **Fail-Fast 适用**：Plan 模式本身也遵循 Fail-Fast，若用户未明确确认 Plan 或发现 Plan 与约束冲突，AI 必须停止执行并回到 Plan 阶段修正，而不是“先做再说”。

## 4) 最近7天变更记录

### 2025-11-21
- **WindowControlsComponent DOM 操作修复**：修复窗口控制按钮挂载时删除原有内容的问题
  - **问题**：`mount()` 使用 `innerHTML` 覆盖容器导致搜索按钮和侧边栏容器被删除，`destroy()` 清空整个容器影响其他元素
  - **症状**：pdf-viewer 顶部工具栏布局崩溃，搜索按钮消失，日志报错 "Header search button NOT FOUND"
  - **根本原因**：`window-controls.js` line 106 使用 `innerHTML = html` 覆盖整个容器，line 294 使用 `innerHTML = ''` 清空容器
  - **修复**：
    - Line 106: 改用 `insertAdjacentHTML('beforeend', html)` 追加而非覆盖
    - Line 294: 改用 `querySelector('.window-controls').remove()` 选择性删除
  - **影响范围**：所有使用 `WindowControlsComponent` 的模块（pdf-viewer, pdf-home）
  - **技术要点**：组件挂载时应追加内容而非覆盖，销毁时应选择性删除自己添加的元素
  - **工作日志**：AItemp/20251121005836-AI-Working-log.md
  - **详细报告**：AItemp/reports/pdf-viewer-layout-fix-20251120.md

### 2025-11-20
- **DRY 原则固化到 Memory Bank**：在"项目硬约束"中新增 DRY（Don't Repeat Yourself）原则
  - **背景**：发现项目中存在代码重复实现问题（pdf-home 和 pdf-viewer 各自实现报错逻辑，pdf-home 内部甚至存在两套相同逻辑）
  - **核心要求**：
    - 开发前搜索：添加功能前必须使用 Glob/Grep 搜索是否已有实现
    - 禁止重复：禁止跨模块重复、禁止同模块内重复
    - 发现重复：必须询问用户是否抽象为共享模块，禁止自行复制代码
  - **典型案例**：错误处理逻辑应抽象到 `common/utils/` 或 `common/services/`，而非各模块独立实现
  - **预期效果**：减少代码维护成本、保持功能一致性、避免代码库膨胀
  - **工作日志**：AItemp/20251120181032-AI-Working-log.md

- **Feature间通信规范文档固化**：将"所有跨Feature调用必须通过EventBus"原则固化到8个相关文档中
  - **P0级核心固化**（3个文件）：
    - `HOW-TO-ADD-FEATURE.md` - 第2行插入"核心规则"章节，详细说明正确方式vs严格禁止的对比
    - `EVENTBUS-USAGE-GUIDE.md` - 第18行插入"为什么必须使用EventBus"章节，强调强制规则
    - `CLAUDE.md` - Line 905添加核心规则说明，标注🔴醒目提示
  - **P1级入口补充**（2个文件）：
    - `pdf-home/features/README.md` - 扩展"禁止事项"章节，添加详细错误示例和正确做法
    - `pdf-viewer/features/README.md` - 扩展"禁止事项"章节，添加详细错误示例和正确做法
  - **P2级索引链接**（3个文件）：
    - `ARCHITECTURE-EXPLAINED.md` - 总结章节添加"通信规则速查表"（表格形式）
    - `PLUGIN-ARCHITECTURE.md` - 依赖注入章节添加警告提示和索引链接
    - `memory-bank/architecture.md` - 架构要点添加"Feature隔离"条目
  - **核心要点**：
    - 明确"必须"而非"建议"的强制性
    - 提供错误vs正确的对比示例
    - 与ESLint规则 `custom/no-cross-feature-internals` 形成闭环
    - 所有文档相互索引，确保无遗漏
  - **预期效果**：AI和开发者无论从哪个文档进入都能看到规范，信息一致性好
  - **工作日志**：AItemp/20251120100000-AI-Working-log.md

- **AI Plan 模式协作规范固化**：将“先 Plan 后执行，需人工确认”的 AI 协作模式写入 memory-bank
  - 更新 `.kilocode/rules/memory-bank/brief.md`：在“流程规范”中新增第 8 条，要求所有会产生副作用的操作必须先输出可审核的 Plan，并在用户确认后再执行。
  - 更新 `.kilocode/rules/memory-bank/context.md`：新增“3) AI 协作与 Plan 模式”小节，结构化描述 Plan 内容、执行顺序及与 sequentialthinking 的关系。
  - 更新 `.kilocode/rules/memory-bank/tech.md`：在“现行检查清单”中补充 Plan 模式检查项，将其视为 AI 开发流程约束的一部分。
  - 工作日志：AItemp/20251120120000-AI-Working-log.md

- **窗口生命周期管理类引入与统一 client_id 约定**：
  - 新增模块：`src/backend/launcher_core/window_lifecycle.py`，实现 `WindowLifecycleManager`，在后端进程中以 `client_id` 为键统一管理窗口对象(`app/window`)与对应的 QWebSocket 客户端：
    - `client_id="pdf-home"`：PDF-Home 单例窗口；
    - `client_id="pdf-viewer-<pdf_id>"`：按 pdf_id 单例的 PDF-Viewer 窗口。
  - BackendLauncher 集成：
    - 在 `src/backend/launcher_core/pyqt_launcher.py:BackendLauncher` 中持有 `self.window_lifecycle`，并在 `_on_msgcenter_message` 中处理通用窗口消息：
      - 打开窗口：`app-window:open:requested`（data 中包含 `client_id` 与 `window_type`），内部委托 `ensure_pdf_home_hosted` / `ensure_pdf_viewer_hosted` 创建窗口，并通过 `window_lifecycle.register_window(...)+bind_ws_client(...)` 登记；
      - 关闭窗口：`app-window:close:requested`（data 中包含 `client_id`），调用 `window_lifecycle.close_window_by_id(client_id, reason)`，统一关闭窗口与 ws-client。
  - Runner 与窗口 closeEvent 集成：
    - 扩展 `src/launcher/runner.py` 中的 `ensure_pdf_home_hosted` / `ensure_pdf_viewer_hosted` 签名，新增可选参数 `window_lifecycle`，在新实例创建后将 `app/window/ws_client` 注册到 WindowLifecycleManager；
    - 在 pdf-home / pdf-viewer 的 `MainWindow` 上通过 `window_closing` 信号连接一个关闭回调：
      - pdf-home：在 `src/frontend/pdf-home/main_window.py` 新增 `window_closing` 信号，并在 `closeEvent` 结束前 emit，该信号被 `ensure_pdf_home_hosted` 注册的回调捕获，调用 `window_lifecycle.on_window_closed(window)` 清理字典；
      - pdf-viewer：复用已有 `window_closing` 信号，在 `ensure_pdf_viewer_hosted` 中的 `_on_win_close` 中同时清理 `AppSessionRegistry` 与 `window_lifecycle`。
  - GUI 启动路径调整：
    - `gui_launcher.py` 的 Hosted 启动按钮改为通过通用消息触发：
      - 启动 pdf-home：发送 `app-window:open:requested`，`data.client_id="pdf-home"`、`window_type="pdf-home"`；
      - 启动 pdf-viewer：发送 `app-window:open:requested`，`data.client_id="pdf-viewer-<pdf_id>"`、`window_type="pdf-viewer"`、`params.pdf_id=<pdf_id>`。
  - 预期效果：
    - 后端对 pdf-home 与 pdf-viewer 的窗口/WS 生命周期有统一可追踪的单一真源（WindowLifecycleManager），无论是通过 MsgCenter 消息还是窗口自身 closeEvent 触发关闭，都能可靠清理 `client_id` 映射，避免僵尸窗口与悬挂 ws-client；
    - GUI、前端、后端之间围绕 `client_id="pdf-home"` / `"pdf-viewer-<pdf_id>"` 形成约定一致的识别规则，为后续扩展其他窗口类型提供模板。
  - 工作日志：AItemp/20251120123000-AI-Working-log.md

### 2025-11-17
- **客户端注册 E2E 测试完成**：为 PDF-Home 和 GUI-Launcher 实现完整的客户端注册连贯集成测试
  - **创建文件**（8个新测试文件）：
    - PDF-Home（4个）：F1/B2/F3/CT 测试链
      - `tests/e2e/node/pdf-home/client-register.F1.test.js` - 前端注册请求
      - `tests/e2e/python/msgcenter/test_pdf_home_client_register_relay.py` - 后端协议中继
      - `tests/e2e/node/pdf-home/client-register.F3.test.js` - 前端接收响应
      - `tests/e2e/node/pdf-home/client-register.contract.test.js` - 契约验证
    - GUI-Launcher（4个）：F1/B2/F3/CT 测试链
      - `tests/e2e/python/gui_launcher/test_client_register_F1.py` - Python 注册请求
      - `tests/e2e/python/msgcenter/test_gui_launcher_client_register_relay.py` - 后端协议中继
      - `tests/e2e/python/gui_launcher/test_client_register_F3.py` - Python 接收响应
      - `tests/e2e/python/gui_launcher/test_client_register_contract.py` - 契约验证
  - **配置更新**：package.json 新增 11 个测试脚本（5+5+1便捷脚本）
  - **客户端注册协议统一**：
    - **pdf-viewer**：动态 `client_id = "pdf-viewer-{pdf-id}"`，routing_keys 从 `window:pdf-viewer:{pdf-id}` 提取为 `["pdf:{pdf-id}"]`
    - **pdf-home**：固定 `client_id = "pdf-home"`，单例模式，routing_keys 为空 `[]`
    - **gui-launcher**：固定 `client_id = "gui-launcher:ui"`，routing_keys 为空 `[]`
  - **测试执行结果**：✅ 100% 通过率（8个测试文件，所有 F1/B2/F3/CT 步骤）
    - PDF-Home 流程：4/4 步骤通过
    - GUI-Launcher 流程：4/4 步骤通过
  - **工件生成验证**：
    - PDF-Home：生成 4 个工件文件（run_id: 20251113111254339）
    - GUI-Launcher：生成 4 个工件文件（run_id: 20251117135029892）
    - 契约验证通过所有关键检查点（事件映射、request_id 一致性、routing_keys 正确性）
  - **测试命令**：
    - 运行 PDF-Home 测试：`pnpm run e2e:flow:pdf-home:client-register`
    - 运行 GUI-Launcher 测试：`pnpm run e2e:flow:gui-launcher:client-register`
    - 运行所有客户端注册测试：`pnpm run e2e:flow:all:client-register`
  - **关键教训**：
    - 理解项目特定术语的重要性："连贯集成测试"不是传统浏览器 E2E
    - 先制定计划再执行，避免盲目开始导致方向错误
    - 测试覆盖完整性：确保所有客户端（pdf-viewer、pdf-home、gui-launcher）都有完整测试链
  - **工作日志**：AItemp/20251117135131-AI-Working-log.md

### 2025-11-16
- **MsgCenter 导航 Bug 修复与集成测试完善**：修复 `handle_message()` 中的双层 Bug，创建集成测试覆盖完整代码路径
  - **Bug 1 修复**（Line 438）：参数提取错误 `data.get("to")` → `message.get("to")`
    - 问题：新协议将路由信息 `to` 放在消息顶层，但代码错误地从 `data` 中提取
    - 影响：严格验证无法获取 `pdf_uuid`，导致所有导航请求失败（"无可用目标对象"）
  - **Bug 2 修复**（Line 543）：Handler 调用缺少路由信息
    - 问题：路由器调用 Handler 时只传递 `message["data"]`（业务数据），不包含顶层的 `to`
    - 解决：在调用 Handler 前，将顶层 `to` 字段合并到 `handler_data` 中
    - 代码：浅拷贝 `data`，添加 `handler_data["to"] = message["to"]`
  - **测试盲区分析**：现有测试直接调用 Handler，绕过了 `handle_message()` 的关键逻辑
    - 旧测试：`navigate_viewer(ctx, request_id, payload)` - 将完整 `payload`（含 `to`）直接传给 Handler
    - 实际流程：`WebSocket → handle_message() → 参数提取 → 严格验证 → 路由器 → Handler`
    - 问题：测试跳过了参数提取和严格验证，导致 Bug 未被发现
  - **集成测试创建**（`tests/integ/python/msgcenter/`）：
    - `conftest.py`：提供测试 fixtures（mock_socket, minimal_server, server_with_viewer）
    - `test_handle_message_navigate.py`：5 个测试场景，从 `handle_message()` 入口开始测试
      - 场景 1：新协议（`message.to.pdf_uuid`）- 验证顶层 `to` 提取
      - 场景 2：旧协议（`message.data.pdf_uuid`）- 验证向后兼容
      - 场景 3：目标不存在 - 验证严格验证拒绝无效请求
      - 场景 4：参数缺失 - 验证 Fail-Fast 原则
      - 场景 5：新协议（`client_id + pdf_uuid`）- 验证新路由协议向后兼容
    - 测试结果：✅ 5/5 全部通过
  - **工作日志**：AItemp/20251116221500-AI-Working-log.md

- **测试文档改进（基于导航 Bug 案例）**：
  - **新增文档章节**：
    - `docs/TESTING-INTEG-GUIDE.md#13` - 测试入口选择原则与测试盲区预防（400行）
    - `docs/TESTING-UNIT-GUIDE.md` - 错误6（P0级）跳过真实入口层（80行）
    - `CLAUDE.md` - 测试规范引用（30行）
    - `AItemp/reports/bug-analysis-navigate-20251116.md` - Bug 分析案例报告（300行）
  - **核心教训**：
    - 协议层测试容易被忽视，但包含复杂逻辑（参数提取、新旧协议兼容、严格验证）
    - 直接测试 Handler 会跳过关键代码路径，导致测试盲区
    - 必须从真实入口（`handle_message()` / EventBus）开始测试
    - 集成测试优先原则：先写入口到出口的完整流程测试
  - **测试编写原则（新增）**：
    - 后端：从 `handle_message()` 入口测试，覆盖参数提取和协议兼容
    - 前端：通过 EventBus 测试，覆盖事件名称验证和路由
    - 使用"3个问题"决策树判断是否需要从入口开始测试
    - 测试盲区识别方法：覆盖率分析、入口函数检查清单、集成测试优先
  - **典型案例（Before/After）**：
    - ❌ Before：旧测试直接调用 `navigate_viewer()` Handler，跳过 `handle_message()`
    - ✅ After：新测试调用 `server.handle_message(message)`，覆盖完整流程
    - 结果：5/5 集成测试场景全部通过，测试盲区已消除
  - **预期成果**：
    - 短期：AI 开发者优先考虑测试入口选择
    - 中期：未来 6 个月内类似测试盲区发生率 < 5%
    - 长期：建立测试优先开发文化，形成完整测试知识库

### 2025-11-15

- **MsgCenter 路由系统重构（Batch 1 完成）**：实现通用客户端路由机制，替代 viewer 特定路由
  - **新增**：`RouteRegistry` 类 (src/backend/msgCenter_server/core/route_registry.py)
    - 三层索引：`_by_client_id`（精确路由）、`_by_type`（类型过滤）、`_by_resource`（资源组播）
    - 反向映射：`_socket_info` (O(k) 快速注销)
    - 严格验证：禁止重复注册、空 client_id、空路由字段
  - **路由协议升级**：
    - **旧字段（废弃）**：`viewer_id`, `pdf_uuid`
    - **新字段（推荐）**：`client_id`, `target_type`, `routing_key`
    - **示例**：`{"client_id": "pdf-viewer-sample", "target_type": "pdf-viewer", "routing_key": "pdf:sample"}`
  - **standard_server.py 集成**：
    - `_register_viewer_client()`: 使用 RouteRegistry 注册，构造 `client_id = f"pdf-viewer-{pdf_uuid}"`
    - `_forward_message_by_route()`: 通用路由转发方法
    - `_forward_viewer_navigate()`: 保留作为兼容层，自动转换旧协议
    - `_on_client_disconnected()`: 调用 `_route_registry.unregister()`
    - `_describe_client()`: 优先使用 RouteRegistry 信息
  - **向后兼容策略**：双轨制运行，旧映射表（`_viewer_by_id`, `_viewers_by_pdf`）并行更新（临时）
  - **测试覆盖**：15 个单元测试全通过 (tests/backend/msgCenter_server/core/test_route_registry.py)
  - **工作日志**：AItemp/20251115031254-AI-Working-log.md

- **MsgCenter 路由系统重构（Batch 2 完成）**：前端 WebSocketAdapter 适配新路由协议
  - **修改文件**：
    - `websocket-adapter.js` (Line 482-485): 修改 `#routeMessage()` 传递完整 `message` 对象（包含 `to` 路由字段）
    - `websocket-adapter.js` (Line 594-676): 重构 `#handleViewerNavigate()` 验证路由字段
  - **路由验证三层架构**：
    - 第1层：旧协议检测（`viewer_id`/`pdf_uuid`），给出警告但仍处理
    - 第2层：新协议验证（`client_id`/`routing_key`），不匹配静默忽略（组播过滤）
    - 第3层：业务逻辑执行（annotation/anchor/outline/page 导航）
  - **新旧协议行为差异**：
    - 旧协议：`viewer_id`/`pdf_uuid` 不匹配返回 `VIEWER_NAVIGATE_FAILED` 错误
    - 新协议：`client_id` 不匹配静默忽略（避免组播场景污染日志）
  - **测试更新**：
    - **单元测试**（`src/frontend/**/adapters/__tests__/`）：更新 3 个测试文件支持新协议
      - `navigate-failure-feedback.test.js`, `navigate-outline.test.js`, `navigate-annotation-anchor.test.js`
      - 测试策略：拆分为新协议测试 + `[DEPRECATED]` 旧协议测试
      - 测试结果：43/45 通过，2 个失败与路由协议无关（旧架构遗留问题）
    - **集成测试/前端段**（`tests/e2e/node/**`，integ:frontend）：更新 1 个测试文件
      - `ws-outline-navigate.F1.inbound-map.test.js` - 改用新协议消息格式（`to` 在顶层）
      - 测试结果：4/4 前端段集成测试全部通过 ✅
    - **测试分层说明**（参考 `docs/TESTING-OVERVIEW.md`）：
      - 单元测试：模块级（Jest/PyTest）
      - 集成测试：分段验证（前端段 F1/F3/F5、后端段 B2/B4、协议段 N1/N2），无浏览器
      - 端到端测试：流程编排器串联所有集成测试步骤
  - **向后兼容确认**：旧协议消息仍能正常工作，渐进式迁移
  - **工作日志**：AItemp/20251115091751-AI-Working-log.md

- **遗留任务**：
  - Batch 3: 窗口激活机制（重复注册时激活已有窗口）
  - Batch 4: 后端消息统一（MsgCenter 智能路由到 WebSocket vs EventBus）
- **EventBus 重复订阅问题修复**：修复 URLNavigationFeature 和 PDFResumeFeature 的重复订阅错误
  - URLNavigationFeature：删除 `#handlePDFLoadSuccess()` 内的重复订阅代码（违反"订阅集中管理"原则）
  - PDFResumeFeature：区分诊断订阅和动态订阅的 `subscriberId`（`PDFResumeFeature-diagnostic` 和 `PDFResumeFeature-load-${rid}`）
- **订阅架构最佳实践确立**：
  - 禁止在事件回调中订阅事件
  - subscriberId 命名规范：静态订阅使用 `{FeatureName}-{HandlerPurpose}`，动态订阅使用 `{FeatureName}-{HandlerPurpose}-{UniqueId}`
  - 所有订阅应在 `install()` 或 `#setupEventListeners()` 中集中管理
- **gui_launcher WebSocket 客户端注册修复**：修复 PyQt WebSocket 客户端缺少身份注册导致消息被拒绝（401 CLIENT_NOT_REGISTERED）
  - 文件：`gui_launcher.py` 的 `_send_ws_text_qt()` 方法
  - 实现两阶段消息发送：先发送 `client:register:requested` 等待注册完成，再发送业务消息
  - 客户端身份：`gui-launcher:ui` (module=gui-launcher)
  - 影响范围：导航请求、启动 pdf-home/pdf-viewer 等所有 WebSocket 操作
- **MsgCenter 导航转发日志强化与验证增强**：修复 viewer_id 为 null 时返回 success 的问题，强化端到端追踪
  - 文件：`standard_server.py` (入站验证、转发方法、socket 清理)
  - 文件：`handlers/pdf_viewer/viewer.py` (Handler 验证)
  - 新增三层验证日志：入站验证 `[StrictTarget]`、转发过程 `[Forward]`、Handler 回执 `[Handler]`
  - 新增 socket 清理日志：`[Cleanup]` 追踪映射表清理过程
  - 新增映射表一致性验证：检测僵尸连接和过期映射
  - 影响：所有 `pdf-viewer:*:requested` 消息的转发和验证

- **GUI Launcher 开发/生产模式修复**：修复 pdf-home 错误地以生产模式启动的问题
  - **问题**：用户未勾选"生产模式"，期望开发模式，但系统以生产模式启动（`is_prod=True`, `vite_port=null`）
  - **根源**：`gui_launcher.py` 启动后端时未检查 `frontend_prod_checkbox` 状态，未启动 Vite 服务器
  - **修复 1**：`gui_launcher.py` 的 `_start_backend_hosted()` 方法（第456-476行）
    - 添加复选框状态检查逻辑
    - 开发模式：启动 Vite 服务器 → `vite_port` 写入 `runtime-ports.json` → `is_dev_env=True`
    - 生产模式：跳过 Vite → `vite_port=null` → `is_dev_env=False`
  - **修复 2**：`ws-client.js` 的 `VALID_MESSAGE_TYPES` 白名单（第77-80行）
    - 添加 `CLIENT_REGISTER_COMPLETED` 和 `CLIENT_REGISTER_FAILED`
    - 解决前端拦截客户端注册响应消息的问题
  - **影响范围**：pdf-home 和 pdf-viewer 的启动模式判断，WebSocket 客户端注册流程
  - **工作日志**：AItemp/20251115215407-AI-Working-log.md

### 2025-11-14
- **Vite 代理 ECONNREFUSED 修复**：修改 `vite.config.js`，将代理目标从 `localhost` 改为 `127.0.0.1`，避免 Windows DNS 优先解析为 IPv6 导致连接失败
- **pdf-resume metadata 缺失修复**：`pdf-library:info:requested` 添加 `metadata: { version: "1.0.0" }`，恢复断点续读功能
- **pdf-home 客户端身份注册修复**：为 pdf-home 的 WSClient 显式传递 `identityOptions`，避免 `CLIENT_NOT_REGISTERED` 错误
- **MsgCenter 严格"目标对象存在"策略（全域）**：viewer 目标、后端服务探测，失败立即返回 `NO_TARGET_OBJECT`/`NO_BACKEND_SERVICE`
- **WebSocket 客户端身份与日志可观测性**：为每个 WS 客户端建立稳定的"真实名称"（`pdf-viewer-<pdf_uuid>:<viewer_id>`），便于日志追踪
- **导航链路"全反馈"保障**：Viewer 在 ID/UUID 不匹配时主动发送 `VIEWER_NAVIGATE_FAILED` 回执，避免静默

### 2025-11-13
- **测试策略更新**：放弃 Playwright，统一采用"Node/Jest 前端段 + PyTest 后端段 + Flow Runner 编排"的无浏览器方案
- **WS 触发 Outline 跳转用例补齐**：覆盖协议转发（N1）、前端入站映射（F1）、前端兑现（F2）、契约（CT）
- **GUI 启动 viewer 经由 MsgCenter**：不再直接调用 runner，而是向 MsgCenter 发送 `pdf-library:viewer:requested` 消息
- **WebSocket 使用约束（强制）**：禁止使用非 PyQt 提供的 WebSocket 实现，必须使用 QtWebSockets（`QWebSocket`/`QWebSocketServer`）

### 2025-11-12
- **测试目录梳理**：废弃 QtWebEngine、Playwright、注入式 GUI Launcher E2E，统一采用"分段集成拼接"方案
- **测试文档整合**：新文档 `TESTING-OVERVIEW.md`、`TESTING-INTEG-GUIDE.md`、`TESTING-E2E-GUIDE.md`，统一中文
- **PDF-viewer 大纲"添加对话框自动填充当前页"E2E 计划**：验证页码默认等于当前浏览页，提交后经 WS create → list 刷新

### 2025-11-11
- **GUI 启动后端不再自动启 Vite（开发模式）**：避免端口抢占/清理带来的等待，需手动启动 Vite
- **PDF-Home "初始化界面中..."不消失问题修复**：前端 WS URL 改为 `ws://127.0.0.1:<port>`，避免 `localhost` 解析为 `::1`
- **Vite 端口写入覆盖问题修复**：改为 `merge_runtime_ports` 合并写入，避免覆盖后端已写入的 `msgCenter_port/pdfFile_port`
- **WebSocket 连接超时策略**：`ws-client.js` 的 `connect()` 增加超时 watchdog（默认 4000ms）

### 2025-11-10
- **GUI Launcher 模块化（阶段一）**：新增 `src/gui_launcher/workers.py` 承载线程类，简化入口文件体积
- **阅读历史模块纳入**：`ReadingHistoryService` 监听页变更/滚动空闲，写入 `pdf_info.json_data.resume`，冷启动自动恢复
- **后端 Linters 模块**：`table_event_lint_checker.py` 检查事件常量使用（E9001），强制使用 `TableEventConstants.*`
- **空 catch 块治理（P0-P2）**：修复 IndexedDB、WebSocketAdapter、Annotation 的严重问题，ESLint 规则 `custom/no-silent-catch` 禁止静默捕获

### 2025-11-09
- **Outline 首次导入不落库问题修复**：后端 API 切换到 `PDFOutlineTablePlugin`，所有 CRUD 严格采用 `outline_id`
- **首次打开不自动弹出侧边栏**：移除默认 `openSidebar("outline")`，改为首次不自动打开任何侧栏
- **大纲加载策略变更**：去掉本地缓存，改为"后端优先、一次渲染"：`outline-list` → (empty? import → bulk-save) → `outline-list` → `OUTLINE.LOAD.SUCCESS`

### 2025-11-08
- **PDF-Viewer 日志级别降噪**：将"实为 info 的 warning"统一降级为 info，Outline/URL导航模块设为 ERROR 级别
- **URLJumpDispatcher toast 抑制**：当 `outlineItemId` 为 `undefined` 或 `null` 时不弹 toast，仅记日志
- **Toast 引擎调试开关**：`window.__DISABLE_TOAST_FALLBACK` 控制 fallback，Outline 调试开关 `?outlineLog=debug|info|warn|error`
- **ESLint 仅 src 严格扫描**：文件 329；错误 342；禁止 `console.log`（131）、未用变量（116）、事件名格式（52）

## 4) 当前待办
- [ ] 引入单一真源（Schema/TS 枚举）生成前后端事件常量
- [ ] 在 CI 做差异校验，确保事件/消息名同步
- [ ] 补充阅读历史 QtWebEngine E2E 测试
- [ ] 建立 ESLint 规则禁止空 catch 块（已完成 custom/no-silent-catch）

## 5) 快速索引

### 详细文档
- **架构设计**：`architecture.md` + `docs/architecture/`
  - 总览与组件 → `docs/architecture/overview.md`
  - 分层模型与 Feature/Bus → `docs/architecture/layers.md`
  - 导航与互斥策略 → `docs/architecture/navigation.md`
  - 设计原则（Fail-Fast 等） → `docs/architecture/principles.md`

- **技术规范**：`tech.md` + `docs/standards/`
  - 事件与常量命名规范 → `docs/standards/events.md`
  - WebSocket 契约（Outline 域示例） → `docs/contracts/ws-outline.md`
  - 质量门禁（Lint/测试/E2E/契约差异检查） → `docs/quality/quality-gates.md`

- **测试指南**：
  - 测试模块使用指南总览 → `docs/TESTING-OVERVIEW.md`（⚠️ 重要：本项目的 E2E 测试是"连贯的集成测试流"，不同于传统浏览器 E2E）
  - 集成测试 + 契约测试 → `docs/TESTING-INTEG-GUIDE.md`
  - 端到端流程（runner、步骤编排） → `docs/TESTING-E2E-GUIDE.md`

### 历史归档
- **2025年11月**：`docs/context-archive/2025-11/`
  - 第1周（11-01 ~ 11-07）：大纲首次导入修复、ESLint治理、Toast问题排查
  - 第2周（11-08 ~ 11-14）：MsgCenter严格转发、测试策略调整、GUI模块化
- **2025年10月及更早**：`docs/context-archive/2025-10/`
  - GUI启动器拆分、端口管理、WebSocket连接问题诊断

### 核心检查清单（提交前/上线前）
- [ ] 事件名：只用命名空间常量；禁止字面量/变量/模板字符串
- [ ] 全局事件：新增前登记白名单（global-event-registry.js）
- [ ] Outline 首次导入：后端优先、一次渲染，去掉本地缓存
- [ ] UI/数据层事件作用域一致；重复初始化有幂等守卫
- [ ] 禁用 alert/confirm；错误统一 logger.error(...,{toast:true})
- [ ] ESLint 通过：`pnpm exec eslint src --max-warnings=0`
- [ ] Jest 通过：`pnpm test`
- [ ] 显式 UTF-8、统一 `\n`、Fail-Fast 无兜底

---

**维护规则**：
1. 每周归档一次历史记录（保留最近7天）
2. context.md 始终保持在 200 行以内
3. 重要变更记录 7 天后移入归档
4. 每月整理一次归档文件，更新索引

**查找历史记录**：
- 打开 `docs/context-archive/` 对应年月目录
- 使用 Ctrl+F 搜索关键词
- Git 历史：`git log -p -- .kilocode/rules/memory-bank/context.md`

### 2025-11-19
- **PDF-Home HTML 标题栏与搜索搜索面板布局修复**：

- **补充：移除 PDF-Home 启动横幅 app-boot-banner**：
  - 删除 `src/frontend/pdf-home/index.html` 中固定在左上角的 `#app-boot-banner` 提示条，避免启动完成后长期占据视野。
  - 清理 `pdf-home/index.js` 与 `bootstrap/app-bootstrap-v2.js` 中所有对该元素的文本更新与样式控制逻辑，错误提示统一依赖 `showError`。
  - 启动/错误状态改为仅通过日志与通知系统观测，界面顶部保持简洁。

- **补充：为 E2E 测试引入独立数据库文件**：
  - 将 `tests/e2e/config/local.json` 及 `local.example.json` 中的 `db_path` 从 `data/anki_linkmaster.db` 改为 `data/anki_linkmaster_e2e.db`。
  - 目的：隔离端到端/集成测试产生的 PDF 记录，避免再次污染日常使用的主库（如最近添加中出现大量基于 `public/test.pdf` 的记录）。
  - 行为：仅通过 E2E 配置读取 `db_path` 的 Python 流程使用新库；正常运行的应用仍通过 `database.config.get_db_path()` 使用默认 `data/anki_linkmaster.db`。
  - 问题：PyQt 原生标题栏移除后，HTML 自定义标题栏 `.pdf-home-header` 与 SearchFeature 注入的 `.search-panel` 同时位于窗口顶部，后者使用 `position: fixed; top:0; z-index:1000`，导致标题栏在视觉上被完全遮挡。
  - 方案：
    - SearchFeature 不再把 `.search-panel` 挂在 `<body>` 顶部，而是优先插入到 `.main-content` 内部作为第一个子节点，确保处于标题栏下方、主内容上方。
    - 将搜索面板样式从 `position: fixed` 调整为 `position: sticky; top:0`，让搜索栏跟随 `.main-content` 滚动，而不是覆盖整个窗口。
    - 将 FilterFeature 的 `.filter-container` 样式由 `position: absolute` 改为普通块级布局，与搜索栏一起位于主内容内部，避免绝对定位带来的重叠与难以维护的 magic number。
    - 新增 Jest 测试 `src/frontend/pdf-home/features/search/__tests__/search-feature.layout.mount.test.js`，验证搜索面板确实挂载在 `.main-content` 且位于搜索结果头部之前，以防止回归。
  - 影响范围：仅影响 PDF-Home 前端布局，不改变后端协议与事件契约。
  - 手动验收建议：通过 `ai_launcher.py start` 启动 PDF-Home，观察：
    - 窗口顶部 HTML 标题栏是否始终可见（包含最小化/最大化/关闭按钮）。
    - 搜索栏是否在标题栏下方、搜索结果列表上方，且在滚动结果列表时保持在主内容顶部。
- Git 历史：`git log -p -- .kilocode/rules/memory-bank/context.md`

- **补充：侧边栏折叠后的主内容宽度修复**：
  - 发现：`.main-content` 在全局样式中硬编码 `margin-left: 300px`，导致即使 SidebarContainer 在折叠态清空 inline 样式，主内容仍然在视觉上右移，左侧留下大片灰色空白。
  - 调整：移除该默认 `margin-left`，明确由 `SidebarContainer.#updateMainContentLayout` 负责在“侧边栏展开且发生重叠”时设置 `margin-left`/`width`；折叠态下不再保留任何左侧额外空间。
  - 验证：通过 `sidebar-layout-push.test.js` 再次确认展开/折叠时 inline 样式切换逻辑未被破坏。
- Git 历史：`git log -p -- .kilocode/rules/memory-bank/context.md`

- **补充：PDF-Home 窗口控制与 client 注册修复**：
  - 在 `src/frontend/pdf-home/features/window-controls/index.js` 中，从 DI 容器获取 `wsClient` 并传入 `WindowControlsComponent`，确保关闭按钮在关闭窗口前显式调用 `wsClient.disconnect('user_close')` 发送 `client:unregister:requested`，避免 MsgCenter 中残留 `client_id="pdf-home"` 导致后续启动收到 `CLIENT_ID_EXISTS`。
  - 在 `src/frontend/common/components/window-controls/window-controls.js` 中加强 QWebChannel 不可用或桥接方法缺失时的错误提示，通过日志与 toast 明确提示“窗口控制失败”，禁止静默无效，从而符合 Fail-Fast 原则。
  - 新增 Jest 用例 `src/frontend/pdf-home/features/window-controls/__tests__/window-controls.feature.install.test.js`，验证安装阶段确实将容器中的 `wsClient` 传递给 `WindowControlsComponent`，防止后续改动退回到 `wsClient: null`。
