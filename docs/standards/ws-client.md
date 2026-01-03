# WSClient（common/ws）面条治理说明

目标：把 `src/frontend/common/ws/ws-client.js` 收敛为“装配/连接管理层”，把可独立复用/可测试的逻辑拆到小模块中，保证单文件行数门禁（≤500）并保持既有行为不变。

## 模块拆分图

- `src/frontend/common/ws/ws-client.js`
  - 连接管理：connect / disconnect / reconnect
  - 队列发送：send / flush
  - 对外 API：request / sendHeartbeat / sendPDFDetailRequest
  - 委托：
    - identity → `ws-client-identity.js`
    - 入站路由 → `ws-client-inbound-router.js`
    - request/pending → `ws-client-requests.js`
    - unregister → `ws-client-unregister.js`
    - 出站白名单/入站兼容类型 → `ws-client-contract.js`

## 关键不变语义（必须保持）

1) **request 超时计时从“实际发送”开始**  
未连接时 `request()` 会把消息放入队列，不能在排队阶段就开始 timeout；否则会出现“先超时、后 flush 发送、响应无人接收”。  
对应回归用例：`src/frontend/common/ws/__tests__/ws-client.request-timeout.defer.test.js`

2) **出站类型严格白名单（Fail-Fast）**  
`request()` 仅允许发送 `WEBSOCKET_MESSAGE_TYPES` 中后缀为 `:requested` / `:request` 的类型；未登记直接抛错。  
实现：`src/frontend/common/ws/ws-client-contract.js`

3) **入站白名单与兼容类型**  
入站消息若不在 `AllowedGlobalEvents` 且不在 `WS_CLIENT_VALID_MESSAGE_TYPES` 兼容列表内，会作为错误处理并拦截。  
实现：`src/frontend/common/ws/ws-client-inbound-router.js` + `src/frontend/common/ws/ws-client-contract.js`

4) **动态事件名的 eslint 限制**  
路由时会 `emit(targetEvent, ...)`，因此在入站路由里对该行使用了显式 lint 豁免（项目规则 `custom/event-name-format`）。

## 新增/修改消息类型时看哪里

- 新增 WS 常量：`src/frontend/common/event/event-constants.js`（`WEBSOCKET_MESSAGE_TYPES`）
- 是否需要入站兼容（非白名单环境）：`src/frontend/common/ws/ws-client-contract.js`（`WS_CLIENT_VALID_MESSAGE_TYPES`）
- 是否需要统一路由到 RESPONSE/ERROR：`src/frontend/common/ws/ws-client-inbound-router.js`

## 新增的最小单元测试

- identity：`src/frontend/common/ws/__tests__/ws-client-identity.test.js`
- outbound types builder：`src/frontend/common/ws/__tests__/ws-client-contract.test.js`

