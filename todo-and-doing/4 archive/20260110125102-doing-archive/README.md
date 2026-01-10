# Doing Archive - 20260110125102

- 归档原因：Card Planner 手工注入测试 **人工验收失败**，需重发 v002 修复。
- 失败现象（来自 gui_launcher 日志）：
  - `card-planner:ingest:failed`（code=400）：
    - `to 字符串只能是 'backend'，当前值: 'new-card-scheduler'`
  - 点击注入按钮会再次触发打开窗口，导致出现第二个新卡片规划器窗口（期望全局唯一）。
- 根因定位：
  - 注入消息 `to` 使用了非法字符串（应使用 `to` 列表转发到目标 client_id）。
  - `ensure_new_card_scheduler_hosted()` 当前不做单例激活（重复 open 可能打开新窗口）。
- 后续任务：已以 v002 重新下发（见 `todo-and-doing/1 doing/20260110125102-*-F/G/H/I/`）。

