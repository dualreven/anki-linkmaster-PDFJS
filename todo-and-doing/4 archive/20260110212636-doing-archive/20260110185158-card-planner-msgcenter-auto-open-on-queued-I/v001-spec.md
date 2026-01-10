# Card Planner - MsgCenter ingest queued(202) 时自动打开/激活 new-card-scheduler（自愈）

**功能ID**: 20260110185158-card-planner-msgcenter-auto-open-on-queued-I  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 18:51  
**状态**: 设计中  

## 现状说明
- MsgCenter 已实现：`card-planner:ingest:requested` forward 未命中时进入 pending-forward 并回 `202 accepted`。
- 但如果窗口尚未打开/未激活，用户仍需要手动打开窗口才能触发后续注册与 flush。

## 提出需求
- 当 MsgCenter 对 ingest 走 queued(202) 路径时，**额外**发射一条：
  - `type=app-window:open:requested`
  - `to=\"backend\"`
  - `data.window_type=\"new-card-scheduler\"`
  - `data.client_id=<target_client_id>`（通常是 `new-card-scheduler`）
- 必须做“去重节流”：同 client_id 在短时间窗口内（例如 10~15s）只触发一次 open（防止注入按钮连点导致刷屏/抖动）。

## 约束条件
- 仅修改：
  - `src/backend/msgCenter_server/**`
- Fail‑Fast：如果解析不出 `client_id`，仍应 400；不得静默兜底。

## 可行验收标准
### 单元测试（必须新增/补齐）
- pytest：构造 forward 未命中 → queued(202) 的 ingest：
  - 断言返回 `202 accepted`
  - 断言 server 发出了 `app-window:open:requested`（可通过监听 `server.message_received` 或 mock 发送函数/记录 emitted 消息实现）
  - 断言短时间内重复调用不会重复发射 open（去重节流生效）

### 人工验收
- 不手动打开新卡片规划器窗口，直接点注入：
  - 后端应自动打开/激活窗口；
  - 注册完成后 pending-forward 自动注入生效。

