# 统一“跳转意图”WS订阅与事件命名（v001-spec）

时间：2025-10-20 15:09:35

## 背景与问题
- 现有拟议的 WS 动作名 `pdfviewer:navigation:jump:requested` 不符合事件命名规范（模块名需使用 kebab-case，如 `pdf-viewer`），且语义上偏向“按页/跳转”，不利于统一 anchor/annotation/outline/page 四类目标的扩展与解耦。
- 未来 msgcenter 将主动“要求前端跳转”，需与前端各插件（Annotation/Anchor/Outline）解耦，避免后端直接耦合到前端内部事件。

## 目标
- 采用统一、规范的三段式命名（模块:操作:状态），并将“跳转需求”抽象为“导航意图（NavigationIntent）”，实现“消息订阅 → 单一入口 → 门闸 → 分发 → 统一回执”的架构。
- 解耦后端与前端插件，让前端内部的 Annotation/Anchor/Outline 通过 Orchestrator 统一调度。

## 命名方案（WS 消息类型，严格三段式 A:B:C）
- 请求：`pdf-viewer:navigation-intent:requested`
- 完成：`pdf-viewer:navigation-intent:completed`
- 失败：`pdf-viewer:navigation-intent:failed`

说明：
- 模块：`pdf-viewer`
- 操作：`navigation:intent`（复合操作，遵循“模块:操作:状态”的规范）
- 状态：`requested|completed|failed`

## 负载数据模型（NavigationIntent）
```json
{
  "traceId": "uuid-like or ws-msg-id",
  "source": "ws",
  "pdfId": "optional-12-hex",
  "target": {
    "kind": "annotation|anchor|outline|page",
    "id": "for id-based targets",
    "pageAt": 12,
    "position": 33.5
  },
  "priority": "normal|high",
  "replace": true
}
```
- kind=page 使用 `pageAt/position`；其余目标使用 `id`（`pageAt/position` 仅作提示可选）。
- `pdfId` 如与当前不同，前端先触发加载，待 `FILE.LOAD.SUCCESS` 后再进入门闸判断。

## 前端订阅与解耦设计（不改代码的目标形态）
- 新增 `WsNavigationAdapter`（适配器）
  - 订阅 `pdf-viewer:navigation-intent:requested`，将消息转换为前端统一入口事件（建议 `pdf-viewer:navigation-intent:requested` → `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.REQUESTED`）；
  - 在接收到 Orchestrator 的结果事件后，按需回写 `pdf-viewer:navigation-intent:{completed|failed}`，携带 `traceId` 和结果。
- 新增 `Navigation Orchestrator`
  - 统一入口：监听 `...INTENT.REQUESTED`；
  - 门闸：聚合 FILE/RENDER/ANNOTATION/ANCHOR/BOOKMARK 的就绪状态（GateTracker）；
  - 分发：根据 `target.kind` 向 Annotation/Anchor/Outline/Page 对应的执行器分发；
  - 回执：统一发出 `...INTENT.RESULT.{SUCCESS|FAILED}`（EventBus），供适配器回写 WS。

## 门闸策略（简述）
- page：`FILE.LOAD.SUCCESS`；带 position 建议等 `RENDER.READY`
- outline：`FILE.LOAD.SUCCESS` + `BOOKMARK.LOAD.SUCCESS`
- annotation：`FILE.LOAD.SUCCESS` + `ANNOTATION.DATA.LOADED`
- anchor：`FILE.LOAD.SUCCESS` + `ANCHOR.DATA.LOADED` + `RENDER.READY`

## 交付物与步骤（落地分期）
1) 事件常量与路由（前端）：新增 INTENT 事件集合与 Orchestrator 外壳（仅打通入口与结果，不改插件）
2) 适配器（前端）：`WsNavigationAdapter` 订阅 WS，转发 INTENT 并回写结果
3) 渐进接入领域：
   - P1：page、outline（按ID）接入
   - P2：annotation、anchor 接入
4) 测试与回滚：
   - 单元：Intent 解析/门闸等待/结果汇总
   - 集成：URL→INTENT、WS→INTENT 全链路；traceId 贯穿
   - 回滚策略：保留旧事件桥接 1 期，日志观察无误后移除

## 验收标准
- WS → 前端：一次 `...intent:requested` 可在日志中追踪到入口/门闸/分发/结果（带 traceId）
- 前端 → WS：回写 `...intent:{completed|failed}`，包含结果摘要与错误码（missing_gate / not_found / invalid / timeout / denied）
- 和各插件解耦：后端仅面向 INTENT，不直接依赖 Annotation/Anchor/Outline 内部实现细节

## 白名单改动清单（必须，未改代码，进入实施时务必完成）

1) EventBus 全局事件白名单（三段式常量）
- 在 `src/frontend/common/event/pdf-viewer-constants.js` 增加常量并导出：
  - `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.REQUESTED = 'pdf-viewer:navigation-intent:requested'`
  - `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.COMPLETED = 'pdf-viewer:navigation-intent:completed'`
  - `PDF_VIEWER_EVENTS.NAVIGATION.INTENT.FAILED = 'pdf-viewer:navigation-intent:failed'`
- 说明：`global-event-registry.js` 会自动收集 `PDF_VIEWER_EVENTS`，但前提是以上常量必须存在。

2) WS 入站消息白名单（允许 msgcenter → 前端 的类型）
- 在 `src/frontend/common/ws/ws-client.js` 的 `VALID_MESSAGE_TYPES` 中添加：
  - `'pdf-viewer:navigation-intent:requested'`
- 说明：否则该类型将被判定为“unknown”，不会进入适配器。

3) WS 出站类型（前端 → 后端 ACK 常量）
- 在 `src/frontend/common/event/event-constants.js` 的 `WEBSOCKET_MESSAGE_TYPES` 中登记：
  - `PDF_VIEWER_NAVIGATION_INTENT_REQUESTED = 'pdf-viewer:navigation-intent:requested'`
  - `PDF_VIEWER_NAVIGATION_INTENT_COMPLETED = 'pdf-viewer:navigation-intent:completed'`
  - `PDF_VIEWER_NAVIGATION_INTENT_FAILED = 'pdf-viewer:navigation-intent:failed'`
- 说明：`WSClient.ALLOWED_OUTBOUND_TYPES` 会收集所有 `*:requested` 以允许发送；completed/failed 由后端接收用于对账（可选）。

4) 单测补充（建议）
- `src/frontend/common/event/__tests__/global-event-registry.navigation-intent.test.js`：断言 `isGlobalEventAllowed('pdf-viewer:navigation-intent:requested') === true`。
- `src/frontend/common/ws/__tests__/ws-client.navigation-intent.test.js`：模拟入站消息，确认 `VALID_MESSAGE_TYPES` 放行。

5) 文档与追踪
- 在 `.kilocode/rules/memory-bank/tech.md` 的“WS 适配”段落已以三段式更新为 `pdf-viewer:navigation-intent:*`；实施完成后更新“已完成/已验证”标记。
