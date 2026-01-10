# doing 归档说明（2026-01-10 18:51）

本归档包含 Card Planner v003（F/G/H/I）任务目录。

## 归档原因（验收未通过，需要返工）
用户手工验收结果：
- Step1：正常
- Step2：正常（窗口 WS 显示 `connected`）
- Step3：不成功（注入没有让窗口新增卡片/看到注入效果）
- Step4：成功（窗口全局唯一）
- Step5：未执行

Step3 关键日志（gui_launcher）：
- MsgCenter 对两次注入均返回：
  - `type=card-planner:ingest:completed`
  - `status=accepted`
  - `code=202`
  - `message=未找到目标客户端，已进入 pending-forward 队列，待客户端注册后自动转发`
- 但窗口侧未出现注入效果（推断 pending-forward 没有被 flush）。

## 初步定位（供后续任务引用）
1) `new-card-scheduler` 当前仅建立 WS 连接，并未发送 `client:register:requested` 注册到 MsgCenter（没有 `WebSocketAdapterBase` 的注册逻辑），因此 RouteRegistry 永远找不到 `client_id=new-card-scheduler`，pending-forward 无法自动 flush。
2) `gui_launcher` 的 `[ACK_META]` 解析存在兼容性问题：ACK 的 `code/status/message` 在顶层，但当前解析打印为 `None`（需要兼容顶层与 data 两种形态）。

## 下一步
下发 v004：
- G：为 new-card-scheduler 增加 MsgCenter 注册（新协议优先）+ 回归测试；必要时在 UI 显示“已注册/注册失败”。
- I：当 ingest queued(202) 时可选触发 `app-window:open:requested`（自愈），并补 pytest；以及/或增加调试查询入口（避免盲注入）。
- F：修复 gui_launcher ACK_META 解析与提示文案（202 场景更清晰）。
- H：配合注册与 pending-forward，补齐“注册状态可观测”或联调日志（以测试为准）。

