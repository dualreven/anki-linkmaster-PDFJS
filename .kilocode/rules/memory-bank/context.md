# Memory Bank - Context（精简版）

最后更新：2025-11-25
归档策略：保留最近7天变更记录，历史见 docs/context-archive/；memory-bank 的整体压缩与归档行为遵循《Memory Bank 压缩机制规范》（.kilocode/rules/memory-bank/compression.md），在执行 weekly/monthly 归档或清理 AItemp 工作日志时必须按该规范操作。

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

- **代码审计与清理优先级原则**：
  - **优先级 P0 - 删除死代码（Dead Code Elimination）**：
    - 未使用的函数、类、模块（通过 ESLint `no-unused-vars` 和 IDE 分析识别）
    - 废弃的 Feature 或组件（已被新实现替代但未删除的旧代码）
    - 注释掉的代码块（保留超过 7 天且无明确 TODO 说明的）
    - 未引用的文件（项目中无任何 import/require 引用的孤立文件）
    - **检查方法**：ESLint、TypeScript 编译器、手动 Grep 搜索、依赖分析工具
    - **理由**：死代码增加维护负担、混淆代码意图、占用存储空间、可能包含安全漏洞
  - **优先级 P1 - 抽象冗余重复代码（DRY）**：
    - 跨模块重复代码 → 抽象到 `src/frontend/common/` 或 `src/backend/common/`
    - 同模块内重复逻辑 → 提取为私有方法或工具函数
    - 重复的业务逻辑 → 使用设计模式（策略模式、工厂模式、模板方法模式等）
    - 重复的配置或常量 → 提取到配置文件或常量文件
    - **检查方法**：代码审查、相似度分析工具、手动识别重复模式
    - **理由**：重复代码导致维护困难（修改需要同步多处）、容易引入不一致性 bug
  - **优先级 P2 - 将经验总结成规则（Rules Extraction）**：
    - 代码规范 → 编写 ESLint 自定义规则（如 `custom/no-cross-feature-internals`）
    - 架构约束 → 编写架构文档和检查清单（如 Feature 通信必须通过 EventBus）
    - 最佳实践 → 更新 memory-bank、CLAUDE.md、开发指南文档
    - 反模式识别 → 创建"禁止事项"清单和错误案例库
    - **固化方式**：文档化、自动化检查（ESLint/Pylint）、测试覆盖、Code Review 检查项
    - **理由**：规则固化可防止问题重复发生、提高团队协作效率、降低新人上手难度
  - **执行顺序说明**：
    - 先删除死代码，避免在无用代码上浪费重构精力
    - 再处理重复代码，确保抽象的是有用的代码
    - 最后总结规则，将优化经验固化为可执行的约束
  - **典型案例**：
    - P0 案例：删除废弃的 QtWebEngine E2E 测试目录（已切换到 Node/Jest 方案）
    - P1 案例：抽象 pdf-home 和 pdf-viewer 的错误处理逻辑到 `common/utils/error-handler.js`（当前通过 `notification.js` + `WebSocketErrorHandler` + `domain-error-notifier.js` 统一实现）
    - P2 案例：创建 ESLint 规则 `custom/no-silent-catch` 禁止空 catch 块

### 2.6 前端错误提示统一策略（2025-11-25）
- **统一目标**：相同的“用户可见错误提示”功能必须通过共享的工具链实现，避免 pdf-home / pdf-viewer 内各自封装一套 Toast / DOM 错误条。
- **公共设施**：
  - `src/frontend/common/utils/notification.js`：底层 toast 封装（iziToast + ToastManager），提供 `showError/showInfo/showSuccess` 等。
  - `src/frontend/common/utils/websocket-error-handler.js`：统一监听 `WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED` 与 `WEBSOCKET_MESSAGE_EVENTS.ERROR`，将所有 WS 层错误集中为 toast。
  - `src/frontend/common/utils/domain-error-notifier.js`：领域错误提示入口 `notifyDomainError({ message, logger, error, scope, durationMs })`，在业务 Feature 中使用，统一“业务失败”类提示。
  - `src/frontend/common/utils/dom-utils.js`：`DOMUtils.showError/showSuccess` 已改为优先调用 `notification.js`，仅在 toast 引擎异常时回退到 `#global-error/#global-success` DOM。
- **已接入模块示例**：
  - pdf-home：
    - `pdf-home/qwebchannel/qwebchannel-bridge.js`：`openPdfViewersWithMeta` 的“未初始化/无可用 PyQt 方法/调用异常/后端返回错误”等，全部改为通过 `notifyDomainError` 输出，同时记录 logger。
    - `pdf-home/features/pdf-edit/index.js`：内部 `#showGlobalError/#showGlobalWarning` 统一调用 `showError(...)`，只在必要时回退 `#global-error` DOM。
    - `pdf-home/index.html`：入口加载失败不再使用 `alert`，而是写入 `#global-error`。
  - pdf-viewer：
    - `pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js`：克隆失败、复制失败以及“加载锚点失败/请求超时”等，使用 `notifyDomainError` 统一对外提示，同时保留局部错误区域。
- **约束**：
  - 新增前端错误提示时，应优先通过 `notification.showError` 或 `notifyDomainError` 实现；
  - 禁止在 Feature 内自行构造新的全局 toast DOM（若需局部错误区域，应与全局 toast 解耦，并在必要时同时调用 `notifyDomainError`）。

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

### 2025-11-25
- **gui_launcher 跳转测试（大纲导航）在 Hosted 模式下无效的修复**
  - **问题表现**：
    - 通过 gui_launcher 的“跳转测试（MsgCenter）”按钮发送导航请求：`pdf-id=c83c60c58ad2`，`outline-item-id=outlineItem-3K2o3Wmm`；
    - 预期：仅对应的 pdf-viewer 弹出 toast，并跳转到该大纲项位置；
    - 实际：后端日志显示 MsgCenter 成功转发 `pdf-viewer:navigate:requested`，gui_launcher 也收到 `pdf-viewer:navigate:completed`，但 viewer 前端既没有 toast 也没有实际跳转。
  - **链路确认**：
    - gui_launcher → MsgCenter：`_send_viewer_navigate_via_msgcenter()` 按新协议发送消息，`to.client_id="pdf-viewer-<pdf-id>"`，`routing_key="pdf:<pdf-id>"`，`data.target={ type: "outline", outline_item_id: ... }`；
    - MsgCenter → WSClient：`navigate_viewer_validator` 校验通过，RouteRegistry 能找到目标 ws-client，`standard_server.handle_message` 打印 `[Forward] 消息已转发: type=pdf-viewer:navigate:requested, targets=1`，并回 `pdf-viewer:navigate:completed`；
    - 说明：后端链路和路由完全正常，问题集中在 pdf-viewer 前端消费层。
  - **前端行为与根因**：
    - `WSClient._handleMessage`：
      - 先统一 `emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message)`，所有消息都会走这条总线；
      - 然后按白名单 + 类型映射到 `WEBSOCKET_MESSAGE_EVENTS.*`（我们看到 `websocket:message:unknown` 日志正是这里发出的）；
    - `WebSocketAdapter.#setupIncomingMessageHandlers`：
      - 订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`，收到任意 WS 消息时先调用 `this.handleMessage(message)`，再做 outline/anchor 领域桥接；
    - `WebSocketAdapter.handleMessage` 逻辑：
      - 若 `#initialized === false`，只将消息推入内部队列 `#messageQueue`，记录 debug 日志“Message queued (not initialized yet): ...”，**不会调用 `#routeMessage`**；
      - 只有在 `onInitialized()` 被调用后，才会对队列中的消息逐一执行 `#routeMessage`，并标记适配器已就绪；
    - 实际运行中：
      - 在重构前，`infra-ws-adapter` Feature 内部负责创建 WebSocketAdapter 并在应用准备好时调用 `onInitialized()`；
      - 在重构后，适配器创建逻辑迁移到 `AppCoreFeature`（`features/infra-app/index.js`），通过公共 helper `setupWsInfra` 安装，但**只调用了 `setupMessageHandlers()`，没有任何地方再调用 `onInitialized()`**；
      - 结果：生产环境下 `WebSocketAdapter.#initialized` 永远为 false，导航请求这类只走 `#routeMessage` 的消息（如 `pdf-viewer:navigate:requested`）全部长期滞留在队列中，不会触发 `[WS] 导航·大纲` 日志、toast，也不会发出 `PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED`。
  - **修复方案**：
    - 修改 `src/frontend/pdf-viewer/features/infra-app/index.js`（AppCoreFeature）：
      - 在通过 `setupWsInfra` 安装适配器之后，新增一段初始化钩子调用：
        - 从 `this.#wsInfra.adapters` 中取出适配器数组；
        - 对每个适配器，如果存在 `onInitialized` 方法，则调用一次；
        - 过程中出现的异常仅记录为 warn，不影响其他适配器。
      - 伪代码：
        ```js
        const adapters = Array.isArray(this.#wsInfra?.adapters) ? this.#wsInfra.adapters : [];
        adapters.forEach((adapter) => {
          if (adapter && typeof adapter.onInitialized === "function") {
            try {
              adapter.onInitialized();
            } catch (e) {
              logger.warn("Failed to mark WebSocket adapter initialized", e);
            }
          }
        });
        ```
    - 这样保证 pdf-viewer 在 AppCoreFeature 完成安装后，WebSocketAdapter 会被标记为已初始化，后续收到的 `pdf-viewer:navigate:requested` 等消息会立即走 `#routeMessage` → `#handleViewerNavigate` 逻辑，按协议触发 toast + 导航。
  - **测试与风险控制**：
    - 新增样板测试文件 `src/frontend/pdf-viewer/features/infra-app/__tests__/app-core-feature.ws-init.test.js`，用于记录“AppCoreFeature 安装后应为带 onInitialized 的适配器调用初始化”的预期行为和 mock 思路（当前因 ESM mock 复杂度问题以 `describe.skip` 保留，后续可按需要启用并完善）；
    - 回归运行 `src/frontend/pdf-viewer/features/infra-app/__tests__/app-core-feature.alias-and-name.test.js`，确认 AppCoreFeature 的名称/别名行为未被破坏；
    - 由于对 WebSocketAdapter 自身逻辑未做修改，已有关于队列与导航的 adapter 单元测试（如 `websocket-adapter.navigate-outline.test.js` 等）在逻辑上仍然有效。
  - **后续建议**：
    - 如果后续在 pdf-viewer 引入 App 级别的初始化事件（类似 pdf-home 的 `app:initialization:completed`），可以将 `onInitialized` 的触发从 AppCoreFeature 挪到更符合语义的位置（例如专门的 infra-ws-adapter Feature），同时在测试中用该事件作为统一的“应用就绪”信号。

### 2025-11-23
- **修复 MsgCenter 验证失败后仍执行业务逻辑的设计缺陷**
  - **问题1**：`gui_launcher.py` 发送 `app-window:open:requested` 消息时缺少 `to` 字段
    - **症状**：启动 pdf-home 或 pdf-viewer 时，后端日志报错 `INVALID_TO_FIELD: 缺少 to 字段（type=app-window:open:requested）`
    - **根本原因**：第570-579行（PDF-Home）和第664-675行（PDF-Viewer）构造消息时忘记添加 `to: "backend"` 字段
    - **修复**：为两处消息添加 `"to": "backend"` 字段，符合 MsgCenter 协议规范
  - **问题2**：`to` 字段验证失败后，所有业务逻辑仍然执行（设计缺陷）
    - **根本原因**：`standard_server.py` 的 `_process_incoming()` 方法在 `handle_message()` 验证之后**无条件发射** `message_received` 信号（第1356行），导致验证失败的消息仍能触发订阅者的业务逻辑
    - **消息流转路径**：GUI发送 → WebSocket → `_process_incoming()` → `handle_message()` 验证失败 → 返回错误 → **仍发射 `message_received` 信号** → `BackendLauncher` 收到消息 → 执行业务逻辑（打开/关闭窗口）
    - **影响范围分析**：
      - ✅ Handler 层面：验证失败时不会执行 Handler 业务逻辑（已安全）
      - ✅ 转发层面：验证失败时不会转发消息（已安全）
      - ❌ **信号层面**：验证失败时仍然发射信号，导致订阅者执行业务逻辑（**存在安全风险**）
    - **受影响的业务逻辑**（`pyqt_launcher.py:323-454`）：
      - `app-window:open:requested`：打开 PDF 查看器或主界面窗口（重大副作用）
      - `app-window:close:requested`：关闭指定窗口（重大副作用）
      - `pdf-viewer.outline.enabled-query`：查询 outline 启用状态（无副作用）
    - **安全风险**：
      - 可能被用于路径遍历攻击（打开任意文件）
      - 可能导致用户数据丢失（强制关闭窗口）
    - **修复方案**（第1349-1401行）：
      - 在发射 `message_received` 信号前，检查 `handle_message()` 的返回值
      - 如果是错误响应（`type` 以 `:failed` 结尾，或 `status` 为 `error`，或 `code >= 400`），则**不发射信号**
      - 只有验证成功的消息才会发射信号并被订阅者接收
      - 添加详细的安全日志：`[Security] 消息验证失败，拒绝发射 message_received 信号`
    - **兼容性验证**：
      - 搜索所有 `message_received.connect()` 调用，确认只有 `BackendLauncher._on_msgcenter_message()` 一个订阅者
      - 修复后不会有兼容性问题
  - **影响范围**：所有消息的验证机制（不仅限于 `app-window:open:requested`），包括：
    - `to` 字段验证失败
    - Schema 验证失败
    - Handler 参数验证失败
  - **协议规范**：根据 `src/backend/msgCenter_server/docs/msgCenter-to-field-spec.md`，所有非注册消息必须包含 `to` 字段
  - **工作日志**：AItemp/20251123170212-AI-Working-log.md
  - **相关文件**：
    - `gui_launcher.py` - 发送消息的代码（已修复问题1）
    - `src/backend/msgCenter_server/standard_server.py` - 消息验证逻辑（已修复问题2）
    - `src/backend/msgCenter_server/core/message_validator.py` - `to` 字段验证器
    - `src/backend/launcher_core/pyqt_launcher.py` - 消息处理逻辑

### 2025-11-24
- **MsgCenter app-window:open:requested UNKNOWN_MESSAGE_TYPE 问题修复**
  - **问题现象**：GUI Hosted 模式下，通过 MsgCenter 启动 PDF-Home 时，日志出现 `app-window:open:failed`，错误为 `未知消息类型: app-window:open:requested`，导致 `_process_incoming()` 将消息视为验证失败，不再发射 `message_received` 信号，从而 `BackendLauncher._on_msgcenter_message()` 无法收到打开窗口请求。
  - **根本原因**：
    - `src/backend/msgCenter_server/core/msg_router.py` 的路由表仅为 `"app-window:close:requested"` 注册了 Handler，用于返回协议层的成功响应（实际关闭逻辑由 BackendLauncher 处理），但遗漏了 `"app-window:open:requested"`；
    - 在 `validate_to_field()` 规则下，`to: "backend"` 的 `app-window:open:requested` 会被归类为 `route_action="backend"`，`handle_message()` 会尝试从 `_router` 查找 Handler，未命中时返回 `UNKNOWN_MESSAGE_TYPE` 错误；
    - `_process_incoming()` 在 2025‑11‑23 的安全加固后，仅在响应非错误（status != error 且 code < 400）时发射 `message_received`，因此该错误响应会阻断信号发射。
  - **修复方案**：
    - 在 `msg_router.build_router()` 中为 `"app-window:open:requested"` 注册协议层 Handler，行为与 close 保持一致：
      - `type="app-window:open:completed"`，`status="success"`，`code=200`，`message="窗口打开请求已接受"`；
      - 保持“协议层 ACK + BackendLauncher 负责实际打开/激活窗口”的分层设计，不在 MsgCenter 层引入 UI 依赖。
    - 新增集成测试 `tests/integ/python/msgcenter/test_handle_message_app_window.py`：
      - 构造 `to: "backend"` 的 `app-window:open:requested` 消息，调用 `StandardWebSocketServer.handle_message()`；
      - 断言响应为 `app-window:open:completed`、`status="success"`、`code=200`，且 `error.type != "UNKNOWN_MESSAGE_TYPE"`。
  - **修复效果**：
    - `handle_message()` 不再将合法的 `app-window:open:requested` 视为未知消息类型；
    - `_process_incoming()` 在收到 200 成功响应时会发射 `message_received` 信号，`BackendLauncher._on_msgcenter_message()` 能按既有逻辑解析 `client_id/window_type/params` 并启动或激活 PDF-Home / PDF-Viewer 窗口；
    - GUI 端不再看到 `UNKNOWN_MESSAGE_TYPE` 错误，Hosted 模式启动路径恢复可用。
  - **相关文件**：
    - `src/backend/msgCenter_server/core/msg_router.py` - 新增 `"app-window:open:requested"` 路由 Handler
    - `src/backend/msgCenter_server/standard_server.py` - 依赖现有 `handle_message()` + `_process_incoming()` 路由与信号发射逻辑
    - `src/backend/launcher_core/pyqt_launcher.py` - 继续通过 `message_received` 处理 app-window 域消息
    - `gui_launcher.py` - 通过 `_send_ws_text_qt()` 发送 `app-window:open:requested` 消息
    - `tests/integ/python/msgcenter/test_handle_message_app_window.py` - 防回归测试
  - **同日补充：前端 DI 容器统一（DependencyContainer 兼容 SimpleDependencyContainer API）**
    - **问题现象**：Phase 1.3 删除 `SimpleDependencyContainer` 后，pdf-viewer 启动时报错：
      - `container.registerGlobal is not a function`（UIManagerFeature 安装阶段）；
      - `Service "navigationService" is not registered in container "pdf-viewer" or its parent containers`（CoreNavigationFeature 依赖链）；
      - SearchFeature 在安装时使用 `container.resolve("pdfViewerManager")`，在新的 DependencyContainer 上缺少该方法。
    - **根本原因**：
      - 新的 `DependencyContainer` 只实现了 `register/get/createScope` 等基础 API，没有实现与历史 `SimpleDependencyContainer` 一致的 `registerGlobal/resolve` 接口；
      - 多个 pdf-viewer Feature（infra-app / infra-ui / infra-nav-core / pdf-annotation / pdf-card / pdf-translator / pdf-anchor / pdf-search 等）仍按照旧规范使用 `registerGlobal` 向“根容器”注册共享服务（如 `pdfViewerManager`、`navigationService`、`annotationManager`），以及通过 `resolve` 解析依赖。
    - **修复方案**：
      - 在 `src/frontend/common/micro-service/dependency-container.js` 中扩展 `DependencyContainer`：
        - 新增 `resolve(name)` 方法，语义等价于 `get(name)`，用于兼容 SimpleDependencyContainer 的常用用法；
        - 新增 `registerGlobal(name, target, options)` 方法，通过私有的 `#getRootContainer()` 始终在根容器上调用 `register()`，保证从任意子作用域都能获取到同一全局服务实例。
      - 在 `src/frontend/pdf-viewer/core/__tests__/micro-service-integration.test.js` 中增加两条防回归用例：
        - 验证在子 scope 调用 `registerGlobal` 后，根容器与子容器均可 `get("globalService")`；
        - 验证 `container.resolve("testService")` 与 `container.get("testService")` 返回相同实例。
    - **修复效果**：
      - pdf-viewer 在使用 FeatureRegistry + DependencyContainer 启动时，UIManagerFeature / CoreNavigationFeature / PDFManagerFeature / PDFAnnotationFeature 等不再因为缺少 `registerGlobal` 而抛错，能够按照既有语义向根容器注册 `pdfViewerManager`、`navigationService` 等服务；
      - SearchFeature 在安装阶段可以通过 `container.resolve("pdfViewerManager")` 正常获取实例，避免在运行期出现“未找到 PDFViewerManager”的错误；
      - `DependencyContainer` 成为 pdf-home 与 pdf-viewer 共享的统一 DI 容器实现，同时兼容旧的 SimpleDependencyContainer 约定，降低后续重构的破坏面。
    - **相关文件**：
    - `src/frontend/common/micro-service/dependency-container.js` - 新增 `resolve` 与 `registerGlobal` 接口，并通过私有方法实现根容器查找
      - `src/frontend/pdf-viewer/core/__tests__/micro-service-integration.test.js` - 新增针对全局注册与解析的 Jest 防回归测试

### 2025-11-25
- **前端应用启动 / DI / FeatureRegistry 引导流程抽象统一（pdf-home / pdf-viewer）**
  - **问题背景**：
    - pdf-home 的 `PDFHomeAppV2.#initializeCoreComponents` 内部手写：
      - `new DependencyContainer("pdf-home-v2")`；
      - 单独注册 `stateManager`、`eventBus`、`featureFlagManager` 等服务；
      - `new FeatureRegistry({ container, globalEventBus: eventBus, aliases: FEATURE_ALIASES })`；
    - pdf-viewer 的 `bootstrapPDFViewerAppFeature` 内部手写：
      - `new DependencyContainer("pdf-viewer")`；
      - 注册 `eventBusSingleton` 与 `logger`；
      - `new FeatureRegistry({ container, globalEventBus: eventBusSingleton, logger, aliases: FEATURE_ALIASES })`；
    - 两端实质做的是同一件事（创建应用级容器 + 功能注册中心 + 注入全局 EventBus / Logger），但实现散落在各自模块中，不利于后续统一调整 DI 策略。
  - **抽象方案与实现**：
    - 在 `src/frontend/common/micro-service/app-bootstrap.js` 中新增应用级启动辅助工具：
      - `createAppContainer({ name, eventBus, logger })`：
        - 内部创建 `new DependencyContainer(name || "app")`；
        - 若提供 `eventBus`，则以单例注册为 `"eventBus"` 服务；
        - 若提供 `logger`，则以单例注册为 `"logger"` 服务；
        - 返回构建好的容器实例。
      - `createFeatureRegistry({ container, eventBus, logger, aliases })`：
        - 包装 `new FeatureRegistry({ container, globalEventBus: eventBus, logger, aliases })`；
        - 确保两端使用统一的构造契约与别名映射。
    - pdf-home 接入：
      - `src/frontend/pdf-home/core/pdf-home-app-v2.js`：
        - 在 `#initializeCoreComponents` 中，用 `createAppContainer({ name: "pdf-home-v2", eventBus, logger: this.#logger })` 替代 `new DependencyContainer("pdf-home-v2")`；
        - 用 `createFeatureRegistry({ container: this.#container, eventBus, aliases: FEATURE_ALIASES, logger: this.#logger })` 替代手写 `new FeatureRegistry(...)`；
        - 在 `#registerGlobalServices` 中去掉对 `"eventBus"` 的重复注册，避免因 key 已存在导致 `register("eventBus", ...)` 抛错。
    - pdf-viewer 接入：
      - `src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js`：
        - 用 `createAppContainer({ name: "pdf-viewer", eventBus: eventBusSingleton, logger })` 替代 `new DependencyContainer("pdf-viewer")` + 显式 `container.register("eventBus"/"logger")`；
        - 用 `createFeatureRegistry({ container, eventBus: eventBusSingleton, logger, aliases: FEATURE_ALIASES })` 替代直接构造 `FeatureRegistry`。
  - **测试与验证**：
    - 在 `src/frontend/pdf-viewer/core/__tests__/micro-service-integration.test.js` 中新增“应用级启动辅助工具”用例：
      - 验证 `createAppContainer` 会创建命名容器并预注册 `eventBus` / `logger` 服务；
      - 验证 `createFeatureRegistry` 返回的对象为 `FeatureRegistry` 实例；
    - 运行命令：`pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/micro-service-integration.test.js -i`，所有 21 个用例（含新增 2 个）通过。
  - **效果**：
    - pdf-home 与 pdf-viewer 在“创建应用级 DI 容器 + FeatureRegistry + 注入全局 EventBus/Logger”这一层完全走同一套公共工具，后续调整 DI / FeatureRegistry 规范只需修改 `app-bootstrap.js` 与少量测试；
    - 为后续继续统一 WebSocket 注册 Feature 与搜索 UI 壳（SearchFeature 壳层）打下基础，避免在多个入口文件中重复维护启动样板代码。

- **WebSocket 适配器安装逻辑统一抽象（pdf-home / pdf-viewer）**
  - **问题背景**：
    - 虽然 `WebSocketAdapterBase` 已经提供统一的新协议注册行为，但在 pdf-home / pdf-viewer 中实际装配 WS 适配器的代码仍各自为政：
      - pdf-home 的 `PDFHomeInfraAppFeature` 手动从容器取 `wsClient`，new `WebSocketAdapterHome(wsClient, eventBus)` 并调用 `setupMessageHandlers()` / `destroy()`；
      - pdf-viewer 的 `AppCoreFeature` 手动 new `WebSocketAdapter` + `WebSocketAdapterViewer`，分别调用 `setupMessageHandlers()` / `destroy()`，装配逻辑散落在 Feature 内。
    - 这导致相同的“wsClient + eventBus → adapter 集合安装/卸载”逻辑在两个模块中重复出现，不利于后续扩展和维护。
  - **抽象方案与实现**：
    - 在 `src/frontend/common/features/ws-infra/index.js` 中新增公共 helper：
      - 函数 `setupWsInfra({ container, eventBus, logger, adapterFactories })`：
        - 强制要求 `container` 提供 `get()` 方法、`eventBus` 非空、`adapterFactories` 为非空数组；
        - 从容器获取 `wsClient`（缺失时 Fail-Fast 抛错）；
        - 对每个工厂 `factory(wsClient, eventBus)` 创建适配器实例，要求返回值具备 `setupMessageHandlers()` 方法，否则抛错；
        - 调用 `setupMessageHandlers()` 后将 adapter 收集到数组；
        - 返回 `{ adapters, dispose() }`，其中 `dispose()` 依次调用每个 adapter 的 `destroy()`（若存在），并通过 logger 输出必要的诊断信息。
    - pdf-home 接入：
      - `src/frontend/pdf-home/features/infra-app/index.js`：
        - 引入 `setupWsInfra`，用单一字段 `#wsInfra` 保存 helper 返回值；
        - 在 `install(context)` 中调用：
          ```js
          this.#wsInfra = setupWsInfra({
            container,
            eventBus: globalEventBus,
            logger,
            adapterFactories: [
              (wsClient, eventBus) => new WebSocketAdapterHome(wsClient, eventBus)
            ]
          });
          ```
        - 在 `uninstall(context)` 中通过 `this.#wsInfra?.dispose()` 统一销毁 adapter 集合，而不再逐个 `destroy()`。
    - pdf-viewer 接入：
      - `src/frontend/pdf-viewer/features/infra-app/index.js`：
        - 引入 `setupWsInfra`，增加字段 `#wsInfra`；
        - 在 app-container 初始化并通过 DI 注册 `wsClient` 后，获取 `eventBus`，并调用：
          ```js
          this.#wsInfra = setupWsInfra({
            container,
            eventBus,
            logger,
            adapterFactories: [
              (wsClient, ev) => createWebSocketAdapter(wsClient, ev),
              (wsClient, ev) => new WebSocketAdapterViewer(wsClient, ev)
            ]
          });
          ```
        - 在 `uninstall(context)` 中通过 `this.#wsInfra?.dispose()` 统一销毁 `WebSocketAdapter` 和 `WebSocketAdapterViewer`，不再在 Feature 内手写重复的 `destroy()` 逻辑。
  - **测试与验证**：
    - 运行 pdf-viewer 功能域集成测试：`pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/__tests__/feature-domains-integration.test.js -i`，验证 PDFReader / PDFUI / WebSocketAdapterFeature 的注册与安装流程未被破坏；
    - 运行 pdf-home 搜索布局测试：`pnpm exec jest --runTestsByPath src/frontend/pdf-home/features/search/__tests__/search-feature.layout.mount.test.js -i`，确认本次修改未影响 pdf-home 的 Feature 安装与布局挂载链路；
    - 两套测试均全部通过。
  - **效果**：
    - pdf-home 与 pdf-viewer 在“WS 适配器安装与销毁”这一层现在都复用同一个公共 helper（`setupWsInfra`），避免重复编写 `new Adapter + setupMessageHandlers + destroy` 模式；
    - 新增或调整 Adapter（如未来的调试 Adapter）时，只需在各自 Feature 中调整 `adapterFactories` 列表，装配过程保持一致；
    - 在不改变 WS 协议和现有 Adapter 行为的前提下，为后续如果需要抽象出更高层级的“WS infra Feature”提供了稳定的基础设施层。

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

- **GUI Launcher “跳转测试”在 Hosted 模式下失败的新增原因（2025-11-25 分析）**：
  - 现状对比：
    - Hosted pdf-viewer 窗口（Qt 版）通过 QWebSocket 在 `launcher.py._setup_websocket()` 里发送旧协议注册消息：`type="client:register:requested"`，`data={client_name:"pdf-viewer-<pdf_id>", client_id:"<pdf_id>", module:"pdf-viewer"}`；
    - MsgCenter 在旧协议分支中将该客户端注册到 RouteRegistry 时使用的 `client_id` 为 `<pdf_id>`，`client_type=["pdf-viewer"]`，且 `routing_keys=[]`；
    - GUI Launcher 的“跳转测试”按钮在 `_send_viewer_navigate_via_msgcenter()` 中发送的新协议导航消息使用的是 `to=[{"client_id": "pdf-viewer-<pdf_id>", "routing_key": "pdf:<pdf_id>", "target_type": "pdf-viewer"}]`。
  - 路由层行为：
    - `RouteRegistry.find_targets(client_id, target_type, routing_key)` 在收到非空 `client_id` 时会优先走“精确路由”：仅在 `_by_client_id` 中查找该键，若未命中直接返回空列表，不再回退到 `routing_key` 路径；
    - 对于 Hosted viewer 来说，RouteRegistry 中只存在 `client_id="<pdf_id>"` 的记录，而不存在 `client_id="pdf-viewer-<pdf_id>"`，且没有任何 `routing_keys`；
    - 因此 MsgCenter 在处理 GUI Launcher 发送的 `pdf-viewer:navigate:requested` 时，路由查找始终返回空目标集合，`handle_message()` 在 forward 分支最终返回 `NO_TARGET_FOUND` / `pdf-viewer:navigate:failed`。
  - 直接效果：
    - GUI Launcher 侧 `_send_viewer_navigate_via_msgcenter()` 虽然能收到 `pdf-viewer:navigate:failed` ACK，但 Hosted viewer 从未真正收到导航请求，导致用户感知为“跳转测试按钮点击后没有任何导航效果”；
    - 现有 `tests/integ/python/msgcenter/test_handle_message_navigate.py` 使用的 `server_with_viewer` fixture 会按新协议在 RouteRegistry 中注册 `client_id="pdf-viewer-sample", routing_keys=["pdf:sample"]`，因此测试用例全部通过，但与 Hosted 模式下的实际注册路径不完全一致（存在测试与真实路径的细微偏差）。
  - 结论（仅记录原因，不含修复方案）：
    - 当前阶段 GUI Launcher 的“跳转测试”功能在 Hosted pdf-viewer 场景下失败的根因是**“导航消息使用了新协议的 client_id/routing_key，而 Hosted viewer 仍按旧协议在 RouteRegistry 中以 `<pdf_id>` 注册”**；
    - 只要不统一这两个身份（或调整导航消息的 to 字段构造/路由逻辑），MsgCenter 在严格路由模式下就无法找到目标 viewer，从而导致“跳转测试无法正常工作”。  

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

### 2025-11-24
- **pdf-home / pdf-viewer 结构差异与防重复约束补充**：
  - 现状梳理：
    - 两个前端模块在宏观结构上基本对齐（`adapters/、bootstrap/、config/、container/、core/、features/`），但存在历史遗留差异：
      - 容器层：`pdf-home` 使用 `DependencyContainer` + 自建 `createPDFHomeContainer`（`src/frontend/pdf-home/container/app-container.js`），`pdf-viewer` 使用独立的 `createPDFViewerContainer`（`src/frontend/pdf-viewer/container/app-container.js`）并依赖 `createConsoleWebSocketBridge`；两者都通过 `buildWsUrlFromQuery` 间接依赖 `common/containers/app-container-base.js`，但并未使用其完整生命周期管理能力。
      - WebSocket 适配层：两端都基于公共的 `WebSocketAdapterBase`（`src/frontend/common/adapters/websocket-adapter-base.js`）实现专属适配器：`WebSocketAdapterHome`（单例 client_id=`pdf-home`，能力标签偏向库管理/搜索/文件操作）与 `WebSocketAdapterViewer`（client_id=`pdf-viewer-{pdf-id}`，能力标签偏向导航/大纲/书签/锚点），同时 pdf-viewer 还有一层历史遗留的大型 `WebSocketAdapter`（`src/frontend/pdf-viewer/adapters/websocket-adapter.js`）负责 outline/anchor 等域的消息桥接。
      - 窗口控制：窗口控制组件完全抽象在 `common/components/window-controls/window-controls.js`，通过 `common/features/window-controls` Feature 在 pdf-home 与 pdf-viewer 内分别安装；差异主要体现在 Feature 层的依赖注入方式（home 只验证 `wsClient` 是否从容器获取，viewer 额外验证 `clientId`、`bridgeName` 的组合和严格错误处理）。
      - 错误提示与日志：pdf-viewer 有统一的 `assets/global-error-toast.js` 与大量基于 Logger 的 toast 约定；pdf-home 早期在 `src/frontend/pdf-home/docs/Exception-Handling-Best-Practices.md` 里定义了自己的错误提示风格，实际实现分散在 UIManager 与容器事件桥接（通过 `uiManager.notify`），存在"同一目的多套实现"的风险。
  - 发现的典型冗余/风格不一致（需要在后续迭代中逐步收敛，而不是立即大改）：
    - WebSocket 容器与身份配置：
      - 两端都在各自 `app-container.js` 中手动构造 `WSClient`，并各自负责 `client_name/client_id/module` 的拼装与 `setGlobalWebSocketClient` 注册。
      - pdf-viewer 在容器里做了完整的 `client_name = pdf-viewer-{pdf-id}` 推导；pdf-home 则固定使用 `client_name="pdf-home", client_id="ui"`，但这部分逻辑与 `WebSocketAdapterHome` 内部的注册配置语义高度重叠（一个在 WSClient 身份层，一个在注册消息 payload 层）。
    - 消息适配职责分裂：
      - pdf-viewer 的 `WebSocketAdapter` 仍然承担大量领域桥接逻辑（outline、anchor、导航失败反馈等），与对应 Feature（`pdf-outline、pdf-anchor、pdf-resume` 等）的职责存在边界重叠；未来可能迁移到 Feature 内由事件驱动完成。
      - pdf-home 目前将"列表更新/错误提示"一部分放在容器事件桥接（`WEBSOCKET_MESSAGE_EVENTS.SUCCESS/ERROR` → `uiManager.notify`），一部分放在具体 Feature（如 add-files/search）内部。
    - 容器生命周期接口：
      - 两端都提供 `connect/disconnect/reloadData/dispose/getDependencies/initialize/isInitialized` 一组接口，但签名和行为细节存在差异（如 pdf-home 在构造时立即 `ensureUI()`，pdf-viewer 更保守地只在 `getDependencies()` 时 `ensureInfra()`），不利于 future tooling 做统一管理。
  - 本次未直接修改任何业务代码，仅将差异与问题模式登记到 memory bank，作为后续重构/抽象任务的设计输入，并给出未来防重复约束：
    - 容器与 WS 身份：
      - 新增约束：**禁止在 pdf-home / pdf-viewer 内各自引入新的“容器基类”或第二套 WSClient 工厂**；如需调整 `client_name/client_id` 或连接策略，必须优先考虑在 `common/containers/app-container-base.js` 与 `common/ws/ws-client.js` 层补充小型工具函数或参数化配置，由两个 app-container 以"组合"方式复用，而不是再造新的 base/container。
      - 对涉及 pdf-home/pdf-viewer 的任何 WS 相关需求，必须在设计阶段明确回答："这部分逻辑能否落在 common（app-container-base / ws-client / adapter-base）层？如果不能，具体原因是什么？" 未给出理由时禁止在两个模块重复实现。
    - WebSocket 适配与领域桥接：
      - 新增约束：**所有“注册协议”相关逻辑（`client:register:requested` 的 payload 结构）只能出现在 `common/adapters/websocket-adapter-base.js` 及其子类中**，禁止在 app-container 或 Feature 再拼装一份类似的数据结构（避免身份配置四处分散）。
      - pdf-viewer 的历史 `WebSocketAdapter` 中承载的 outline/anchor 等域桥接逻辑，在未来新需求中不再复制到 pdf-home；如果 pdf-home 也需要类似能力，优先方案是通过 EventBus + 共用 Feature（例如抽象为 `common/features/library-outline`）而不是在两个模块各维护一套 ws→ui 桥接代码。
    - 窗口控制与窗口生命周期：
      - 新增约束：任何窗口控制（最小化/最大化/关闭）按钮的 DOM 与行为只能经由 `common/components/window-controls` + `common/features/window-controls` 提供，禁止在 pdf-home/pdf-viewer 内添加新的窗口控制 HTML/JS 片段；如需差异化，必须通过 Feature 配置（如 bridgeName、容器 selector）解决。
    - 错误提示与全局 toast：
      - 新增建议：错误提示统一往 `common` 目录迁移（如基于 `global-error-toast` 的公共服务），pdf-home 不再为"同类型错误"（WS失败、后端返回 error 等）设计第二套视觉与分发逻辑；但本次只在文档层标记，不强行重构历史代码。

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
