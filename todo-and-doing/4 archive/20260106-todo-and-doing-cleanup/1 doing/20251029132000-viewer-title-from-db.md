# pdf-viewer 标题仅来自数据库（严格无兜底）与 toast 改造 — 执行记录（2025-10-29 13:20:00）

问题描述
- 打开 pdf-viewer（hosted/prod）后，左上角标题未显示数据库中的书名，仅显示“PDF阅读器”；全程未出现错误 toast。
- js 日志仅见 “[Injected] info request sent for title”，未见 `info:completed` 的响应处理。

根因分析
- WSClient 未将 `pdf-library:info:completed` 路由为 `websocket:message:response`，导致 UIManagerCore 与注入脚本监听不到；URLNavigationFeature 通过 `sendPDFDetailRequest` 的 pending 结算拿到了详情，但未触发标题更新逻辑。
- 个别路径仍使用 `alert`，不符合“禁止兜底/使用 toast”的规范。

本次改动
- src/frontend/common/ws/ws-client.js
  - 新增路由：`pdf-library:info:completed` → RESPONSE；`...:failed` → ERROR。
  - 冗余加入 VALID_MESSAGE_TYPES 放行 `info:completed/failed`。
- src/frontend/pdf-viewer/pyqt/main_window.py
  - 注入脚本错误分支改为 `logger.error(..., { toast:{ type:'error', ms:6000 } })`。
- src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js
  - 移除 `alert`，改为 `logger.error(..., { toast })`。

验收清单
- 启动 hosted(prod) → 双击打开 `c83c60c58ad2`：
  - 期望 JS 日志出现 `[UIManagerCore] 标题已从数据库更新` 或注入片段的 `Header title updated from DB`；
  - 失败时出现错误 toast（不弹 alert）；
  - 标题仅在成功取到 `data.title` 后更新，不做任意回退（严格无兜底）。

后续事项
- 若仍未更新标题：检查生产包是否包含本次 src 改动（必要时重建 dist）；确认 `#pdf-title` DOM 存在。
- 观察：若 `pdf-library:info:completed` 在其它上下文也需要作为 RESPONSE 消费，可补充更全面的事件路由用例测试。
