# 导航与互斥策略（索引版）

结论
- URL 导航与 WS 导航互斥，禁止并发触发
- 跨文档导航：在 `FILE.LOAD.SUCCESS` 时恢复执行（pendingManualNav）

场景
- 冷启动/新窗口：由 URL 参数解析（`pdfId/anchorId/annotationId/outlineItemId/pageAt/position`）
- 已打开窗口：只通过 WS 指令定向导航（抑制 URL 参数）

目标
- 避免“导航正在进行中/Forward navigate → error”类时序问题

参考
- 事件与契约：docs/standards/events.md、docs/contracts/ws-outline.md
