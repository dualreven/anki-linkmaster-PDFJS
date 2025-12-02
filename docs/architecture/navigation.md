# 导航与互斥策略（索引版）

结论
- 当前版本不再支持通过 URL 查询参数（page-at/position/anchor-id 等）直接触发导航。
- 所有导航均由前端 Feature / WebSocket 消息驱动，URL 仅用于标识要打开的 PDF（pdf-id 等）。
- 跨文档导航：在 `FILE.LOAD.SUCCESS` 时恢复执行（pendingManualNav）。

场景
- 冷启动/新窗口：由 URL 参数解析 `pdf-id/title` 选择文档，随后由 Feature（outline/anchor/annotation/resume 等）或 WS 消息触发导航。
- 已打开窗口：只通过 WS 指令或内部事件定向导航（不再依赖 URL 查询参数）。

目标
- 避免“导航正在进行中/Forward navigate → error”类时序问题，同时彻底移除对 URL 参数导航的依赖。

参考
- 事件与契约：docs/standards/events.md、docs/contracts/ws-outline.md
