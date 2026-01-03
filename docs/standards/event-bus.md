# EventBus（common/event）面条治理说明

目标：把 `src/frontend/common/event/event-bus.js` 收敛为“对外 API + 少量装配”，把大段实现拆到小模块中，保证单文件行数门禁（≤500），且不改变既有行为与测试结果。

## 拆分结果（文件）

- `src/frontend/common/event/event-bus.js`
  - 仍是对外入口：`EventBus`、`getEventBus/getAllEventBuses/...`、默认导出
  - 方法委托：
    - 订阅相关：`event-bus-subscriptions.js`
    - 发布相关：`event-bus-emitter.js`
    - 事件名校验：`event-name-validator.js`
    - 日志采样配置：`event-bus-logging.js`

## 不变约束（必须保持）

1) **全局事件白名单**  
非 `@scope/` 的事件名必须通过 `global-event-registry` 白名单，否则订阅/发布都被阻止并记录错误日志。

2) **事件名格式校验（三段式）**  
当启用校验（`enableValidation=true`）时，事件必须符合 `{module}:{action}:{status}`（正好 3 段），否则订阅/发布被阻止。

3) **错误隔离**  
订阅者回调抛错不会中断其他订阅者执行；错误会记录日志（含 subscriberId/actorId/trace 信息）。

4) **可选追踪（Tracing）**  
启用 tracing 时，`emit` 会：
  - 生成 `messageId/traceId`
  - 记录每个订阅者执行结果与耗时
  - `emit()` 返回 `{ messageId, traceId, timestamp }`

5) **日志抑制/采样**  
高频事件会被抑制或采样输出；配置位于 `event-bus-logging.js`。

## 修改点如何扩展

- 新增抑制/采样规则：改 `src/frontend/common/event/event-bus-logging.js`
- 调整事件名校验提示：改 `src/frontend/common/event/event-name-validator.js`
- 修改订阅行为（重复订阅检测等）：改 `src/frontend/common/event/event-bus-subscriptions.js`
- 修改发布行为（trace、E2E tap、回调调用方式等）：改 `src/frontend/common/event/event-bus-emitter.js`

