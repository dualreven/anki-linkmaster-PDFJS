# WebSocketAdapter（pdf-viewer/adapters）面条治理说明

目标：把 `src/frontend/pdf-viewer/adapters/websocket-adapter.js` 收敛为“装配/路由层”，把可独立复用/可测试的业务处理抽到小模块中，保证单文件行数门禁（≤500）且保持对外导出与行为不变。

> 权威代码入口：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`

## 模块拆分图

- `src/frontend/pdf-viewer/adapters/websocket-adapter.js`
  - 生命周期：初始化/销毁、消息队列 drain、subscriptions 清理
  - 入站路由：根据 `WEBSOCKET_MESSAGE_TYPES` 分发到处理器
  - 委托：
    - 出站事件订阅（内部→外部）→ `src/frontend/pdf-viewer/adapters/websocket-adapter-outgoing-handlers.js`
    - `load_pdf_file` 入站解析 → `src/frontend/pdf-viewer/adapters/websocket-adapter-load-pdf-file.js`
    - viewer navigate 入站处理 → `src/frontend/pdf-viewer/adapters/websocket-adapter-viewer-navigate.js`

## 关键不变语义（必须保持）

1) **对外导出不变**  
`export class WebSocketAdapter` 与 `export function createWebSocketAdapter` 不变；外部调用方不需要改 import。

2) **事件名必须使用常量**  
所有 `eventBus.on/emit` 必须使用 `PDF_VIEWER_EVENTS` / `WEBSOCKET_EVENTS` / `WEBSOCKET_MESSAGE_TYPES` 等常量，避免触发项目自定义 eslint 规则。

3) **Fail-Fast（不做兜底）**  
未知/不符合契约的入站 payload 不应该静默忽略；必要时应显式报错或走明确的失败回执路径（尤其是需要 RESPONSE/ERROR 的请求型消息）。

4) **pdf_id 获取口径统一**  
需要从当前窗口 URL 获取 pdf_id 时，统一使用 `src/frontend/pdf-viewer/shared/url-context.js` 的 `getCurrentPdfIdFromWindow()`，避免在多处重复解析逻辑。

## 新增/修改消息类型时看哪里

- WS 消息类型常量：`src/frontend/common/event/event-constants.js`（`WEBSOCKET_MESSAGE_TYPES`）
- WebSocket 复用规范：`docs/SPEC/WEBSOCKET-REUSE-001.md`
- pdf-viewer 内部事件常量：`src/frontend/common/event/pdf-viewer-constants.js`

## 回归测试（改动后必须先跑）

- adapter suite：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.*.test.js`

