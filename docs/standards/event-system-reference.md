# 前端事件体系参考（给后续 AI 的“选事件前先看这里”）

目标：让后续 AI 在改动前端时，能基于真实实现快速判断——我用的事件会触发哪些后续事件？会不会造成竞态？应该用哪一种事件/门控？

适用范围：`src/frontend/**`（至少覆盖 `pdf-home` 与 `pdf-viewer`），以及共享的 `common/event`、`common/ws`、WebSocketAdapter 与 gate 机制。

---

## 0. TL;DR（最重要的 5 条）

1) **本项目“没有随便造事件”**：全局事件（非 `@` 开头）必须在常量里登记，并被 `global-event-registry.js` 白名单放行，否则 EventBus 会阻止发布/订阅。  
2) **EventBus vs ScopedEventBus 必须分清**：`ScopedEventBus` 会把“局部事件”自动变成 `@scope/...`，只有 `@` 前缀事件才绕过全局白名单。  
3) **`PDF_VIEWER_EVENTS.RENDER.READY` 是状态型、只发一次**：拿它当“万能渲染完成”做 gate，极易与 resume/导航互斥产生竞态。  
4) **导航是硬互斥资源**：`NavigationService` 同一时刻只能执行一个 `navigateTo()`，并发请求会失败（“导航正在进行中”）。  
5) **WS 相关有三层概念，别混**：`WEBSOCKET_MESSAGE_TYPES`（协议 type）≠ `WEBSOCKET_EVENTS.MESSAGE.*`（内部 send/received）≠ `WEBSOCKET_MESSAGE_EVENTS.*`（WSClient 路由后的响应事件）。

---

## 1. 分层与边界（必须先理解）

### 1.1 全局事件总线：`EventBus`

实现：`src/frontend/common/event/event-bus.js`

核心约束：
- 事件名必须是字符串，且三段式 `a:b:c`（运行期校验）。
- **全局事件白名单**：事件名只要不是 `@` 开头，就必须在 `AllowedGlobalEvents` 集合中，否则：
  - `on(event)` 会被阻止订阅；
  - `emit(event)` 会被阻止发布。
- **重复订阅检测**：同一 `subscriberId` 重复订阅同一事件会抛错（这是“偶现竞态/重复触发”的常见根源）。

白名单来源：`src/frontend/common/event/global-event-registry.js`  
它会递归收集：
- `src/frontend/common/event/event-constants.js` 导出的所有事件字符串
- `src/frontend/common/event/pdf-viewer-constants.js` 的 `PDF_VIEWER_EVENTS`
- `src/frontend/pdf-viewer/features/pdf-translator/events.js` 的 `PDF_TRANSLATOR_EVENTS`

结论：
- “跨 Feature / 跨模块通信”本质是**全局事件**（非 `@`），必须走常量与白名单。
- “Feature 内部私有事件”应尽量用 `@scope/...`，避免污染全局和白名单成本。

### 1.2 作用域事件：`ScopedEventBus`

实现：`src/frontend/common/event/scoped-event-bus.js`

规则：
- `scopedBus.emit('x:y:z')` → 实际发布 `@<scope>/x:y:z`
- `scopedBus.on('x:y:z')` → 实际订阅 `@<scope>/x:y:z`
- `scopedBus.emitGlobal(...) / onGlobal(...)`：发布/订阅全局事件（不加 `@scope/`）

最常见误用（会导致“发了但收不到”）：
- 用 `scopedBus.emit('pdf-home:xxx:yyy')` 以为是全局：实际变成 `@scope/pdf-home:xxx:yyy`，外部当然收不到。
- 用 `globalEventBus.emit('@scope/x:y:z')`：能发，但这本质是“局部事件”，外部不应依赖它（会造成耦合与竞态）。

### 1.3 PDF.js 原生事件与桥接

常量：`PDF_VIEWER_EVENTS.PDFJS_EVENTS.*`（在 `src/frontend/common/event/pdf-viewer-constants.js`）

桥接点（把 PDF.js eventBus 的原生事件转成应用事件）：
- `src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`

关键事实：
- 原生事件名不是三段式（例如 `pagerendered`），所以在本项目里必须通过常量引用才能通过事件门禁。
- “渲染完成”并不是一个事件：有 `pagerendered`（每页）、`textlayerrendered`（文本层）等多个维度。

### 1.4 WebSocket：协议 type 与内部事件

协议 type 常量：`src/frontend/common/event/event-constants.js` → `WEBSOCKET_MESSAGE_TYPES`

WS 内部事件（EventBus 上的事件名）：
- `WEBSOCKET_EVENTS.MESSAGE.SEND`：应用请求“发送一条 WS 消息”（由 `WSClient` 监听并真正 send）
- `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`：底层收到一条 WS 消息后广播（由 `WSClient` 发出）
- `WEBSOCKET_MESSAGE_EVENTS.RESPONSE/ERROR/...`：`WSClient` 的 **switch-case 路由结果**

强制记忆（别混）：
- 业务 Feature 想“发 WS”：通常是 `emit(WEBSOCKET_EVENTS.MESSAGE.SEND, msg)`
- 业务 Feature 想“看 WS 回包”：通常是 `on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, handler)`（而不是直接监听 RECEIVED）

相关排障文档（推荐配套阅读）：`docs/TECH/WS-MESSAGE-ROUTING-GUIDE.md`

---

## 2. 关键“状态型事件”卡片（最容易引发竞态）

本节只列“高风险/高复用”的事件；不做全量字典。

### 2.1 `PDF_VIEWER_EVENTS.RENDER.READY`（危险：被滥用做 gate）

常量：`src/frontend/common/event/pdf-viewer-constants.js`  
发射点：`src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`

语义（以实现为准）：
- 监听 PDF.js 的 `pagerendered`
- **首次 `pagerendered` 才 emit 一次 `RENDER.READY`**
- payload 形态大致为 `{ firstPage, totalPages }`

常见订阅者（真实存在）：
- `pdf-resume`：`src/frontend/pdf-viewer/features/pdf-resume/index.js`（收到后调度恢复流程）
- `WebSocketAdapter` gate 状态记录：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`

竞态风险（你们已踩过）：
- **Resume 与 MsgCenter gate 导航共享同一门控事件**：两者可能同时在 `RENDER.READY` 后触发导航，最终在 `NavigationService` 互斥点发生冲突。

结论：
- `RENDER.READY` 适合作为“UI可用起点”，不适合作为“业务流程完成”。
- 如果你要 gate 的是“恢复流程完成/某Feature初始化完成”，请用更专用的流程事件（例如 `PDF_VIEWER_EVENTS.RESUME.FLOW.DONE`）或新建专用事件（但必须登记常量与白名单）。

### 2.2 `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`（常被当作兜底触发器）

发射点：pdf-viewer 的 PDF 加载链路（例如 `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js` / `pdf-loader.js` 一类模块）

典型用途：
- 作为“文件已加载成功”的通用信号
- 在部分 Feature 中作为 `RENDER.READY` 缺失时的 fallback（例如 `pdf-resume`）

注意：
- “文件加载成功” ≠ “首屏已渲染完成” ≠ “文本层/标注层 ready”
- 把 `FILE.LOAD.SUCCESS` 当作“可以做 DOM 依赖操作”的时机也可能产生时序问题

### 2.3 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED`（手动导航入口）

实现链路：
- 监听者：`src/frontend/pdf-viewer/features/pdf-url-loader/index.js`
- 执行者：`src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js` 的 `navigateTo(...)`

关键事实：
- `pdf-url-loader` 内部会做“去重 + 跨文档挂起恢复（pendingManualNav）”
- `NavigationService` 是硬互斥：并发 `navigateTo()` 会返回失败（不是排队）

因此：
- 任何“自动导航”Feature（resume/annotation/anchor/outline）都必须考虑：同一时刻是否还有别的导航在跑。

### 2.4 `PDF_VIEWER_EVENTS.RESUME.FLOW.DONE`（推荐：作为 gate 的专用事件之一）

实现：`src/frontend/pdf-viewer/features/pdf-resume/index.js`

语义：
- resume 初始化流程（load + apply）不论成功/失败，都会 emit 一次 `RESUME.FLOW.DONE`
- payload 包含 `{ pdfId, hasResume, status, error? }`

用途建议：
- 若你的业务需要“等待 resume 完成后再做导航/跳转/门控”，优先 gate 在此类“流程 DONE”事件，而不是 `RENDER.READY`。

---

## 3. pdf-viewer：关键链路（按流程拆）

### 3.1 冷启动/首次渲染链路（简化图）

1) PDF 加载完成 → `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`  
2) PDF.js `pagerendered` 首次发生 → `PDF_VIEWER_EVENTS.RENDER.READY`（只发一次）  
3) 各 Feature（如 resume）开始工作

桥接点：`src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`

### 3.2 “WS 导航 + gate”链路（MsgCenter→viewer）

入口消息 type：`WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED`  
处理器：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`

关键点：
- message 可能带 `gate`：`{ once|on: <eventName>, timeout_ms }`
- 实现用 `runWithGate(...)` 等待条件满足，再执行 `#handleViewerNavigate(...)`
- gate 的 `once` 是否能“命中历史”，取决于状态字典里有没有记录到该事件
  - `websocket-adapter.js` 目前仅把 `PDF_VIEWER_EVENTS.RENDER.READY` 写进 store（`#setupGateStatusObservers`）

因此：
- gate 事件不是“想用啥就用啥”，必须确认：
  1) 事件是否真的会发；
  2) 是否会被写入 store（否则 `gate.once` 无法命中历史，只能等下一次，甚至永远等不到）。

### 3.3 Resume 链路（为什么会和 gate 导航竞态）

触发点：
- `pdf-resume` 同时监听：
  - `PDF_VIEWER_EVENTS.RENDER.READY`（0ms 触发恢复）
  - `PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS`（500ms fallback）

执行行为：
- `applyResume(...)` 内部调用 `navigationService.navigateTo(...)`
- 同时会 `PositionTracker.freezeFor(3000)`，避免“刚导航就被位置追踪回写覆盖”

竞态产生条件（典型）：
- MsgCenter 发来 `VIEWER_NAVIGATE_REQUESTED`，并用 `gate.once=RENDER.READY`；
- `RENDER.READY` 到来后：resume 与 gate 导航几乎同时触发；
- 由于 `NavigationService` 互斥，其中一个导航失败/被忽略，表现为“偶现跳转失败/跳到错误位置”。

---

## 4. pdf-home：关键链路（按流程拆）

### 4.1 WS 注册（新协议）

入口 Feature：`src/frontend/pdf-home/features/infra-app/index.js`  
适配器：`src/frontend/pdf-home/adapters/websocket-adapter-home.js`（继承 `WebSocketAdapterBase`）

事实：
- pdf-home 是单例窗口，client_id 固定为 `"pdf-home"`
- WSClient 也会推断身份（`src/frontend/common/ws/ws-client.js`），但 pdf-home v2 会显式传入 identityOptions（更稳定）

### 4.2 搜索/结果/打开 viewer（WS 方式）

UI 触发：
- 搜索条：`SEARCH_EVENTS.QUERY.REQUESTED` / `SEARCH_EVENTS.QUERY.CLEARED`（`src/frontend/pdf-home/features/search/components/search-bar.js`）
- 结果区批量“阅读”：循环发送 `WEBSOCKET_MESSAGE_TYPES.OPEN_PDF`（`src/frontend/pdf-home/features/search-results/index.js`）

注意（非常现实的坑）：
- 在 pdf-home 代码中会出现“优先 emitGlobal，失败才 emit”的写法，这是为了规避某些构建/桥接场景下 scoped 事件发不出去的问题。
- 这类写法会让“事件作用域”更加难以推断，所以文档调试时建议同时开 EventBus tracing（见 `src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md`）。

### 4.3 打开 viewer（QWebChannel / PyQt 方式）

桥接：`src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js`  
事件：`PDF_HOME_EVENTS.QWEBCHANNEL.INIT`（用于错误域/提示）

事实：
- pdf-home 既可能用 WS（MsgCenter/后端）打开 viewer，也可能用 PyQt bridge 直接打开 viewer（取决于当前实现路径与环境）。
- 这意味着“打开 viewer”不是单一事件链路，排障必须先确认走的是哪条路。

### 4.4 工具窗口打开/关闭（MsgCenter / Hosted）

协议 type：
- `WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_OPEN_REQUESTED`：`app-window:open:requested`
- `WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_CLOSE_REQUESTED`：`app-window:close:requested`

典型链路（以 anno-manager 为例）：
- 业务侧发起事件：`PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED`
- `pdf-viewer` 的 `WebSocketAdapter` 监听该事件并发送 `app-window:open:requested`（固定 `client_id="anno-manager"`，`window_type="anno-manager"`）
- 用例参考：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.anno-manager-window-open.test.js`

风险提示：
- “打开窗口”通常会伴随“注册 client / gate / ready / 导航”等后续链路，属于高耦合场景；新增此类流程时，务必在设计阶段把门控事件拆开，避免复用 `RENDER.READY` 这类泛化状态事件。

---

## 5. gate（门控）机制：严格语义与使用边界

实现：`src/frontend/common/ws/ws-gate-runner.js`

### 5.1 `gate.once` vs `gate.on`

- `gate.once`：
  - 若目标事件已在 store 中标记 `fired`，立即执行（命中历史）。
  - 否则订阅下一次目标事件，等到后执行一次。
- `gate.on`：
  - **永远只等待下一次**目标事件（不管历史发生过什么）。

### 5.2 gate 依赖“状态字典 store”

store 只是一块内存：
- 谁负责 `markEventFired(...)`，谁决定了哪些事件可用于 `gate.once` 命中历史。
- 在 pdf-viewer 的 WS 适配器里，目前显式观测并写入 store 的事件极少（默认只做了 `RENDER.READY`）。

因此 gate 的正确使用步骤（AI 必须照做）：
1) 明确你想等待的“条件”到底是什么（渲染就绪？某Feature流程结束？导航完成？）
2) 找到这个条件对应的**专用事件**（优先选“流程 DONE”类）
3) 确认该事件：
   - 会被发布（在代码里能找到 emit 点）
   - 若你要用 `gate.once`，则它会被写入 store（能找到 `markEventFired` 的观测入口）
4) 若以上任意一点不成立：不要用该事件做 gate（应新增专用事件/或调整 store 观测范围）

---

## 6. 竞态风险清单（按“现象→根因→规避”）

### R1：门控跳转“偶现失败/跳错位置”

现象：
- MsgCenter gate 导航有时失败、有时跳到旧位置、有时完全无效

高概率根因：
- gate 使用 `RENDER.READY`，与 `pdf-resume` 或其他自动导航链路同时触发
- `NavigationService` 互斥导致其中一个请求失败（并不会排队）

规避建议（按优先级）：
1) gate 改用流程型专用事件（例如 resume 的 `RESUME.FLOW.DONE`）而非 `RENDER.READY`
2) 若必须在 render-ready 之后跳转：增加“导航仲裁”（单一入口串行化）或显式重试策略（严格、可观测，不要静默兜底）

### R2：事件“发了但没人收到”

根因常见组合：
- 使用了 `ScopedEventBus.emit(...)` 但外部在监听全局事件（忘了 `@scope/` 前缀隔离）
- 使用了未登记的全局事件（被白名单拦截）

排查路径：
1) 先看事件名是否以 `@` 开头（决定是否受白名单约束）
2) 查常量是否存在（`event-constants.js` / `pdf-viewer-constants.js`）
3) 必要时开 event tracing 观察真实发布的 event 字符串

### R3：WS “后端回包成功但前端没反应”

根因：
- `WEBSOCKET_MESSAGE_TYPES` 已放行，但 `WSClient` 没有路由/结算 pending（详见 `docs/TECH/WS-MESSAGE-ROUTING-GUIDE.md`）

---

## 7. 给后续 AI 的强制检查清单（做任何事件改动前）

1) 我用的是 `EventBus` 还是 `ScopedEventBus`？发出去的事件名最终是什么（是否带 `@scope/`）？
2) 事件是“状态型一次性”还是“过程型多次”？（例如 `RENDER.READY` 属于一次性）
3) 是否会触发 `navigationService.navigateTo()`？若会，是否可能与 resume/其他导航并发？
4) 若要用 gate：
   - 我选的 gate 事件是否会被记录到 store（否则 `once` 命中不了历史）？
   - 我是在等“渲染就绪”还是在等“业务流程完成”？有没有更专用的 DONE 事件？
5) 新增全局事件前，是否已在常量中登记并确保白名单放行？
