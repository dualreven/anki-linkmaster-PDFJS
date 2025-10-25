# Working Log - navigation-intent-ws-subscription

时间：2025-10-20 15:09:35

阶段：设计规划（不改代码）

要点：
- 规范化 WS 动作名为 `pdf-viewer:navigation:intent:{requested|completed|failed}`；
- 采用“消息订阅 → 统一意图 → 门闸 → 分发 → 回执”的解耦架构；
- 不直接触碰 Annotation/Anchor/Outline 插件，对外暴露统一入口事件；
- 已在 `.kilocode/rules/memory-bank/{architecture.md, tech.md}` 记录设计。

下一步（待批准后执行）：
- 实现 `WsNavigationAdapter` 框架；新增 `Navigation Orchestrator` 外壳与事件常量；
- P1 先接入 page、outline（按ID），通过单元与集成测试验证；
- 打通回写 `...intent:{completed|failed}` 并引入错误码体系。

注意（白名单必须项，未做将被 EventBus/WS 拒绝）：
- EventBus 全局事件：在 `pdf-viewer-constants.js` 定义并导出 `pdf-viewer:navigation-intent:{requested|completed|failed}`；`global-event-registry.js` 会自动收集。
- WS 入站放行：在 `ws-client.js` 的 `VALID_MESSAGE_TYPES` 中加入 `'pdf-viewer:navigation-intent:requested'`。
- WS 出站常量：在 `event-constants.js` 的 `WEBSOCKET_MESSAGE_TYPES` 登记三段式常量（至少 `*:requested`）。
