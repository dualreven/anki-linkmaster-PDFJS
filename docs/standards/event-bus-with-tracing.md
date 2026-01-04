# EventBus（带 tracing）说明

目标：将 `src/frontend/common/event/event-bus-with-tracing.js` 控制在 ≤500 行，并把“为什么这么做/约束/排雷”外移到文档。

## 你应该从哪里开始看
- 实现：`src/frontend/common/event/event-bus-with-tracing.js`
- tracing：`src/frontend/common/event/message-tracer.js`
- 全局事件白名单：`src/frontend/common/event/global-event-registry.js`

## 设计要点（最小）
- 事件名三段式：`{module}:{action}:{status}`。
- global 事件：必须先登记白名单（`global-event-registry.js`）。
- tracing：用于调试调用链；不应改变事件行为本身。

