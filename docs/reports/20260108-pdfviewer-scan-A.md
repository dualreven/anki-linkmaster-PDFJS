# PDFViewer 面条化扫描报告 (A - adapters)

**任务ID**: 20260108212130-pdfviewer-spaghetti-scan-A  
**扫描时间**: 2026-01-08 22:15  
**扫描范围**: `src/frontend/pdf-viewer/adapters/**`

## 1. 扫描执行清单
- `pnpm -s run lint`: 通过 (no errors)
- `search_file_content`: 命中 `eventBus.on` (39处), `setTimeout` (仅测试), `ObservableState` (0处)
- 源码审计文件:
  - `websocket-adapter.js`
  - `websocket-adapter-outgoing-handlers.js`
  - `ws-inbound-bridge.js`
  - `websocket-adapter-load-pdf-file.js`
  - `websocket-adapter-viewer-navigate.js`

## 2. 风险点列表 (P0/P1/P2)

| 级别 | 文件:行号 | 风险类型 | 描述 | 建议修复方向 |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | `websocket-adapter.js:116` | 职责重复/碎片化 | 入站消息同时走 `this.#routeMessage` 和 `handleViewerWsInbound`，逻辑分散在类成员方法和外部桥接函数中。 | 统一入站处理器入口，减少 `WebSocketAdapter` 类的分支负担。 |
| **P1** | `websocket-adapter-outgoing-handlers.js:1` | 隐式耦合 (Global) | 大量使用 `getCurrentPdfIdFromWindow()` 从 URL 读取状态，增加了对浏览器环境的依赖。 | 在适配器初始化时通过构造函数注入 `pdfId` 来源，或从 Manager 获取。 |
| **P1** | `websocket-adapter-outgoing-handlers.js:5` | 订阅管理风险 | 函数依赖外部传入的 `subscriptions` bag。若新增监听忘记手动 add，会导致销毁时内存泄漏。 | 考虑让 handler 返回统一的清理函数或数组，由调用方集中处理。 |
| **P1** | `websocket-adapter-load-pdf-file.js:7-22` | 逻辑冗余/脆弱 | `pdfId` 解析包含 4 种字段 fallback + 正则匹配。这种“猜测”逻辑容易因后端变更而失效。 | 在后端/协议层统一 `pdf_id` 字段名，简化适配器层逻辑。 |
| **P2** | `websocket-adapter-outgoing-handlers.js:23-34` | 职责跨越 | 适配器层直接包含了“更新最近访问时间”的业务逻辑。 | 应由 `Feature` 层监听 `FILE.LOAD.SUCCESS` 并调用相应的 Manager，适配器只负责透传。 |
| **P2** | `websocket-adapter.js:166` | 异步安全性 | `runWithGate` 是 fire-and-forget 的异步调用，若执行中途 `destroy()` 被触发，可能引发竞态。 | 为 `runWithGate` 增加 AbortSignal 或在回调中检查 `this.#initialized`。 |

## 3. “面条化结构”描述
- **外部环境依赖环**: 适配器 -> `getCurrentPdfIdFromWindow` -> `window.location`。这种模式使得适配器在非浏览器环境（如单元测试）中难以独立运行，且 URL 结构的任何微动都会波及多个文件。
- **逻辑碎片化**: 入站消息的分发逻辑（Routing）被切分成了两半：一半在 `WebSocketAdapter` 类内部处理核心导航/加载，另一半在 `ws-inbound-bridge` 处理业务域（Outline/Anchor）。
- **副作用黑盒**: `websocket-adapter-outgoing-handlers.js` 表面上是“转发器”，实际上承担了部分业务决策（如：判定 pdfId 存在时才发 `PDF_LIBRARY_RECORD_UPDATE_REQUESTED`）。

## 4. 拆分与改进建议
1.  **解耦 URL**: 将 `pdfId` 的获取从纯工具函数改为可配置的对象/接口。
2.  **收敛入站分发**: 将 `WebSocketAdapter` 类中的 `switch(type)` 逻辑迁移到类似 `ws-inbound-bridge` 的插件化处理器中。
3.  **标准化 Payload**: 移除适配器内复杂的“猜测式”字段解析，强制要求后端符合某一规范，或在统一的中间层做 Normalize。

## 5. 回归测试建议
- **Leak Test**: 编写一个测试，实例化 `WebSocketAdapter` 并调用 `setupMessageHandlers`，随后 `destroy()`，断言 `eventBus` 上的所有相关 `subscriberId: "WebSocketAdapter"` 的监听器均已移除。
- **Gate Race Test**: 模拟一个带有 `gate` 的导航请求，在 gate 等待期间调用 `destroy()`，确保不会抛出未捕获的错误。

