# Infra-nav / pdf-url-loader 面条化扫描（F）——2026 01 09

## 1. 扫描范围与约束
- 跟踪目标：`src/frontend/pdf-viewer/features/infra-nav-core/**` 与 `src/frontend/pdf-viewer/features/pdf-url-loader/**`。
- 只读扫描，禁止触碰业务代码；唯一输出是本报告，后续若拆分需在 `docs/reports` 新增任务文档。
- `pnpm -s run lint` 作为门禁。

## 2. 关键发现（按优先级）

### P0：`NavigationService` 事件订阅与延时等待混杂，卸载不清理导致订阅泄漏
- 证据：`#setupEventListeners` 在 `src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js` 第 54-73 行向 EventBus 注册 `TOTAL_PAGES_UPDATED` 与 `PAGE.CHANGING`，但 `destroy()`（369-374 行）只重置内部状态并未调用 `eventBus.off` 或清除 `setTimeout`，`#waitForPageReady` 本身又在 322-352 行使用 `setTimeout` 轮询 DOM。
- 风险：Core Navigation Feature 可能在多次安装/卸载、单页热重载或测试中一直保留旧订阅；事件泄漏会让同一事件被多次处理、堆栈膨胀，并且 `#waitForPageReady` 占用的定时器永远不会被中断，造成“最大调用栈”/频繁日志噪声。
- 建议拆分：
  1. 把事件注册逻辑封装进 `#bindNavigationEvents`，再新增 `#unbindNavigationEvents`，`destroy()` 调用 `off(subscriberId)`（或保存返回的取消函数）确保卸载时干净。
  2. `#waitForPageReady` 改为可取消/可测试的轮询（例如 `AbortController` + `requestAnimationFrame`），避免与旧 `NavigationService` 共享相同的 DOM 定时器。
- 回归测试：模拟多个 `CoreNavigationFeature.install`/`uninstall` 周期（或对 `NavigationService` 的 `destroy()` 直接调用），验证 `eventBus.on`/`off` 被成对调用；验证 `waitForPageReady` 在 `destroy()` 后不再执行任何 `setTimeout` 回调。

### P1：`PDFUrlLoaderFeature.install` 负责过多，依赖解析、网络、事件、日志混杂
- 证据：`src/frontend/pdf-viewer/features/pdf-url-loader/index.js` 77-193 行在一把手里完成日志级别配置、容器降级兼容、EventBus/`navigationService` 查找、`URLParamsParser.parse/validate`、`wsClient.sendPDFDetailRequest`、文件加载事件的直接发射以及 `validation` 的同步 `emit`。而且即便 `wsClient` 不可用也会直接在 `install` 中依赖 `context.container`，造成“扫描 vs 运行时”界限混乱。
- 风险：该方法既是初始化入口，又承担参数管线、网络请求、事件发送等多入口职责，任何小改动都必须理解整个流；单元测试也难以隔离 `wsClient`/`eventBus` 行为。
- 建议拆分：
  1. 把容器依赖解析（EventBus、navigationService、wsClient）抽成 `InfraNavDependencyResolver`（按模块注入）。
  2. 将 URL 参数处理与“细节查询 + 上报 FILE.LOAD.REQUESTED”拆成 `UrlParamRegistrar`/`FileLoadCoordinator`，避免 `install` 直接触发网络。
  3. 保留 `install` 只负责 wiring、订阅和状态机初始化。
- 回归测试：新增 `PDFUrlLoaderFeature.install` 的集成测试，mock `wsClient`/`eventBus` 验证 `install` 只注册监听、不在 `wsClient` 不可用时抛出；对 `UrlParamRegistrar` 写单测，确保 `pdfId` 为空时不会发起网络请求。

### P1：`#handleNavigationRequested` 是个大状态机，`pending`、去重、重载、导航全拼靠一段代码撑
- 证据：方法（305-405 行）一肩挑起输入日志、参数验证、`navInProgress` `inflightNavKey` 去重、`pendingManualNav` 记录、`PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED` 触发、`navigationService.navigateTo` 调用以及成功/失败事件的发射；`#pendingManualNav` 在 369 行被赋值，但只有 `#handlePDFLoadSuccess` 清理，`#handlePDFLoadFailed`、`uninstall` 不清理导致失败后仍会自动重放老请求。
- 风险：状态变量横跨异步边界，测试或 UI 触发新导航时很容易遗留 `#pendingManualNav`、`#inflightNavKey` 真正完成前就被重置，导致重复导航、超时或 `Maximum call stack` 日志。`JSON.stringify` 去重也没有上下文保护，任何循环结构都会抛出未捕获异常。
- 建议拆分：
  1. 把 `pendingManualNav`、`navInProgress`、`inflightNavKey` 组合成单独的 `NavigationRequestGate`，提供 `tryStart(params)`/`complete()` 等清晰 API，并在 `FILE.LOAD.FAILED` 里显式 reset。
  2. 把 `pdfId` 检查与 `navigationService.navigateTo` 的调用抽离为纯逻辑（`UrlNavigationResolver`），方便覆盖不同场景（重加载 vs 页内跳转）。
- 回归测试：模拟一个连续的 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 序列（先跨 pdfId，再发起重放），验证 `pendingManualNav` 只在成功时才重置，并且 `FILE.LOAD.FAILED` 会清掉旧待办；对 `navInProgress` 去重逻辑写单测，确保 `inflightNavKey` 块不会在新请求时阻塞。

