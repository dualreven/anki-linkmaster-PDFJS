# 前端 WS 消息白名单与路由机制（Annotation 案例）

面向对象：所有在 pdf-viewer 中新增或维护“经由 WebSocket 的请求-响应”的功能域（如 annotation、bookmark、anchor 等）。

目的：避免“服务端已返回成功，但前端未识别/未落地”的典型坑；规范新增消息类型时的最小改造点与排障流程。

## 核心概念

- 白名单（Allow/Validate）
  - 位置：`src/frontend/common/event/event-constants.js`
  - 作用：声明哪些消息类型是被允许的，避免被 WSClient 拦截为未注册类型。
  - 误解澄清：白名单“只负责放行”，不负责“命名/路由”。

- 路由（Map/Route）
  - 位置：`src/frontend/common/ws/ws-client.js`
  - 作用：把具体的 `type` 映射到一个内部事件，并在此之前“结算 pending 请求”（`_settlePendingRequest`）。
  - 误解澄清：没有路由分支时消息不会被拒绝，但会“默认广播为 `websocket:message:unknown`”（仅用于观测），同时可能导致 pending 未结算。

- 结算（Settle）
  - 场景：`WSClient.request()` 发出 `*:requested`，服务端回 `*:completed`/`*:failed`。
  - 关键点：`handleMessage()` 中先按 `request_id` + `isTerminal` 进行结算，随后再进行路由/广播。

## 规范要求（新增/维护消息类型时）

1) 在前端常量中声明类型（白名单）
   - 文件：`src/frontend/common/event/event-constants.js`
   - 动作为：
     - 在 `WEBSOCKET_MESSAGE_TYPES` 中声明 `…:requested`
     - 在 `WEBSOCKET_MESSAGE_EVENTS` 中增加对应完成/失败事件字符串（若需要）
     - 确保 `AllowedGlobalEvents` 能收集到这些字符串（自动）

2) 在 WSClient 的 switch-case 显式路由（最容易被忽略）
   - 文件：`src/frontend/common/ws/ws-client.js`
   - 动作为：
     - 对 `…:completed`/`…:failed` 显式分支：
       - `_settlePendingRequest(message)` 或 `_settlePendingRequest(message, { error })`
       - 路由为通用 `RESPONSE`/`ERROR`（或更具体事件）
     - 原则：凡是 `*:completed`/`*:failed`，都应能触发结算；避免走 default→UNKNOWN 后 pending 仍未结算。

3) 前后端类型字符串必须完全一致
   - 命名规范：三段式、小写、连字符 `:` 分割，如 `annotation:list:completed`
   - 后端定义参考：`src/backend/msgCenter_server/standard_protocol.py`
   - 前端路由与白名单必须使用完全一致的字面量字符串。

## Annotation 案例复盘（两大堵点）

- 堵点1：白名单未覆盖注解域全部类型
  - 现象：消息被拦截为未注册类型，WSClient 早退；或虽然放行，但未进入预期的处理路径。
  - 解决：将 `annotation:list/save/delete:completed/failed` 加入 VALID_MESSAGE_TYPES/白名单。

- 堵点2：WSClient switch-case 未给注解类型具体路由
  - 现象：`annotation:list:completed` 被广播为 `websocket:message:unknown`；更重要的是 pending 请求未结算，导致上层（AnnotationManager）判定“远端失败”。
  - 解决：在 switch-case 中新增注解域分支，先 `_settlePendingRequest` 后路由为通用 `RESPONSE/ERROR`。

## 排障清单（遇到“后端成功、前端空表”）

1) 观察日志中是否有 `*:completed` 消息（如 `annotation:list:completed`）
   - 若没有：检查服务端是否确实返回；或是否被白名单拦截（未放行）。

2) 检查是否有“结算日志/迹象”（如 `[WSClient] Settling request …`）
   - 若没有：重点怀疑“WSClient 多实例”（A 发送、B 接收）或 switch-case 未路由导致 early-return；
   - 核查 request_id：在发送与接收时打印并对比 `hasPending`。

3) 若已结算但上层仍空表
   - 优先检查模型层是否严格校验导致整批失败（例如 Annotation.fromJSON 的类型特定字段校验）。
   - 建议改为“逐条 try/catch 跳过无效项”，避免“一条坏数据拖垮整批”。

## Bookmark vs Annotation 的差异（为什么大纲“总能成功”）

- Bookmark 采用“远端优先 + 本地兜底缓存”模式（Remote + LocalStorage）：
  - 加载：启动时先读 localStorage 立即渲染，再用远端结果覆盖缓存；
  - 结果：即便远端结算偶发不顺，仍有可视结果，刷新后不至于空白。

- Annotation 初版仅“远端单通道”，对 WSClient 路由/结算依赖更强；
  - 建议逐步引入“本地兜底缓存”以对齐书签的稳定性（但这不是白名单/路由问题的替代品，而是体验增强）。

## 最小改造模板（新增某域如 foo）

1) event-constants.js：
```js
export const WEBSOCKET_MESSAGE_TYPES = {
  FOO_LIST: 'foo:list:requested',
  FOO_SAVE: 'foo:save:requested',
};

export const WEBSOCKET_MESSAGE_EVENTS = {
  FOO_LIST_COMPLETED: 'foo:list:completed',
  FOO_LIST_FAILED: 'foo:list:failed',
  FOO_SAVE_COMPLETED: 'foo:save:completed',
  FOO_SAVE_FAILED: 'foo:save:failed',
};
```

2) ws-client.js：
```js
switch (message.type) {
  case 'foo:list:completed':
    this._settlePendingRequest(message);
    targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE; // 或更具体
    break;
  case 'foo:list:failed':
    this._settlePendingRequest(message, { error: message?.error || message?.data });
    targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
    break;
  // save 同理…
}
```

3) 上层管理器（Manager）：
  - 先通过 request() 拿到 `…:completed`，再做模型映射；
  - 映射过程中建议“逐条 try/catch”，跳过不合规历史数据，避免整批失败。

## 结论

- “白名单允许”与“路由命名/结算”是两个层面，缺一都会出问题；
- 遇到 `unknown` 不能先怀疑“字符串不一致”，应先核对“是否有路由命名/是否结算 pending”；
- 若仍空表，优先检查模型层校验是否过严导致整批失败；
- 对用户体验要求高的域，建议采用“远端优先 + 本地兜底”的双通道策略（参考 Bookmark）。

