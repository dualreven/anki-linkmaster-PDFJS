# Card Planner - MsgCenter pending-forward 支持 ingest

**功能ID**: 20260110172214-card-planner-msgcenter-pending-forward-ingest-I  
**优先级**: 高（P0：阻塞手工验收）  
**版本**: v001  
**创建时间**: 2026-01-10 17:22  
**状态**: 设计中  

## 现状说明
- 用户手工验收 Step4（注入样例草稿卡）失败，回执为：
  - `type=card-planner:ingest:failed`
  - `code=404`
  - `error_code=NO_TARGET_FOUND`
  - `message=未找到任何匹配的目标客户端（共尝试 1 个路由）`
- 触发点在 MsgCenter `forward` 路由：当 `to=[{client_id:\"new-card-scheduler\"}]` 但目标客户端尚未注册到 RouteRegistry 时，会直接返回 `NO_TARGET_FOUND`。
- 目前仅对 `pdf-viewer:navigate:requested` 有“auto-launch + pending-forward + 202 回执”特例；Card Planner ingest 未覆盖。

## 存在问题
- 竞态：`gui_launcher` 打开新卡片规划器窗口后立即注入，窗口 WS 注册晚于注入请求到达 → forward 找不到目标 → 404。
- 这会导致“明明窗口已经打开，但注入失败”，无法稳定人工验收。

## 提出需求
- 当收到 `card-planner:ingest:requested` 且路由动作是 `forward`，但 RouteRegistry 未找到任何目标 socket 时：
  1) **不得**直接返回 `NO_TARGET_FOUND`；
  2) 必须将该消息按 `client_id` 进入 pending-forward 队列（TTL 控制），等待目标客户端注册后自动 flush；
  3) 立刻返回 **202** 回执给请求方（避免 UI 误判失败）。
- 保持 Fail-Fast：只有“目标未注册/不可路由”这一类竞态才走 pending-forward；其它 schema/handler 校验失败仍应失败。

## 解决方案（建议）
- 在 `src/backend/msgCenter_server/standard_server.py` 的 `route_action == \"forward\"` 分支中：
  - 复用现有 `_queue_pending_forward(...)` 与 `_flush_pending_forward_for_client(...)`；
  - 新增 `card-planner:ingest:requested` 的特例逻辑，行为对齐 `pdf-viewer:navigate:requested`：
    - 若 `routing_targets` 中能解析 `client_id`（期望为 `new-card-scheduler`），则入队并返回 202；
    - 可选：同时发射 `app-window:open:requested`（to=backend），确保后端会打开/激活该窗口（必须保持全局唯一，不得引入重复窗口回归）。
- 回执建议：
  - `type=card-planner:ingest:completed`
  - `code=202`
  - `status=\"accepted\"`（或 `success` 但 message 明确 queued）
  - `message` 写清楚“已排队等待目标客户端注册后转发”。

## 约束条件
- 仅修改后端 MsgCenter 模块相关代码：
  - `src/backend/msgCenter_server/**`
- 禁止引入“静默兜底”：除“目标未注册”外，任何非法输入必须报错。

## 可行验收标准
### 单元测试（必须新增/补齐）
- 新增 pytest：覆盖以下场景并防回归：
  1) forward `card-planner:ingest:requested` 且目标不存在 → 返回 202，并入 pending-forward（不返回 404）。
  2) 目标客户端随后 `client:register:requested` 注册同 client_id → 自动 flush，将入队消息发送到该 socket（可通过 fake socket 的 `sendTextMessage` 断言）。
  3) TTL 过期的队列条目不会被 flush（如你实现/调整 TTL 行为）。

### 人工验收（给用户）
- 启动 MsgCenter + `gui_launcher`；
- 打开新卡片规划器窗口；
- 立刻点击“注入样例草稿卡”：
  - 不应出现 `NO_TARGET_FOUND`；
  - 即使窗口尚未完成注册，也应在几秒内自动完成注入（窗口侧 toast/渲染出现）。

