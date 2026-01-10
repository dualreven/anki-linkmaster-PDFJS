# Card Planner - new-card-scheduler 启动时注册到 MsgCenter（P0）

**功能ID**: 20260110185158-card-planner-register-new-card-scheduler-G  
**优先级**: 高（P0：阻塞 Step3 注入）  
**版本**: v001  
**创建时间**: 2026-01-10 18:51  
**状态**: 设计中  

## 现状说明（验收失败事实）
- `gui_launcher` 注入返回 `code=202 queued`，且提示“待客户端注册后自动转发”，但新卡片规划器窗口没有收到注入效果。
- 窗口显示 `ws=connected` 只能代表 WebSocket 建链成功，**不代表 MsgCenter RouteRegistry 已注册该 client_id**。
- `new-card-scheduler` 当前没有类似 `WebSocketAdapterBase` 的“连接建立后自动发送注册消息”逻辑。

## 存在问题
- `client_id=new-card-scheduler` 未注册到 MsgCenter → forward 永远找不到目标 → pending-forward 永远无法 flush → Step3 永远失败。

## 提出需求
- 新卡片规划器窗口在 WS 连接建立后，必须向 MsgCenter 发送 `client:register:requested` 完成注册（Fail‑Fast）：
  - 优先使用新协议（`data.client_id + data.client_type[] + data.capabilities[]`），并保持 **不包含 `to` 字段**。
  - 注册失败（含 409/400）必须可观测（日志/界面提示），禁止静默。

## 解决方案（建议）
- 在 `src/frontend/new-card-scheduler/**` 内新增一个小模块（例如 `wiring/ws-registration.js`）：
  - 订阅 `WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED`
  - 发送 `WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED`
  - payload（建议）：
    - `client_id = "new-card-scheduler"`（或 URL 参数解析出的 clientId）
    - `client_type = ["window:new-card-scheduler", "editable"]`
    - `capabilities = ["card-planner"]`
    - `metadata = { module: "new-card-scheduler" }`
- 在 `main.js` 中安装该 registration wiring（保持文件体积与职责边界）。
- 可选：在现有 WS 状态面板上增加一行 `reg=ok|failed`（如果你愿意顺手做，但必须有测试）。

## 约束条件
- 仅修改：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试（必须新增/补齐）
- Jest：模拟 `WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED` 事件，断言 `wsClient.send(...)` 被调用且消息满足：
  - `type === "client:register:requested"`
  - `to` 字段不存在（Fail‑Fast）
  - `data.client_id === <clientId>`
  - `data.client_type` 为非空数组

### 人工验收（给用户）
- 打开新卡片规划器窗口后，后端日志应出现：
  - `[Registration] 检测到新协议注册: client_id=new-card-scheduler ...`
- 再点注入：应从 `202 queued` 变为 `200 forwarded` 或者 `202 queued` 后在 1~2 秒内自动注入生效。

