# [card-planner][F] gui_launcher：增加“人工测试 Card Planner 流程”按钮（无需外部条件）

**功能ID**: 20260110105623-card-planner-gui-launcher-manual-test-F  
**优先级**: 高（阻塞人工验收）  
**版本**: v001  
**创建时间**: 2026-01-10 10:56:23  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/refactor-F`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-F`）

## 背景
目前 Card Planner（新卡片规划器）在没有“外部消息注入/创建草稿卡”的条件下，难以手工走通完整流程验证（创建卡 → 插入 ids → 发射 final-output → 看回执）。

仓库已有按钮：`gui_launcher.py` 中的“启动 新卡片规划器 (Hosted)”只负责打开窗口，不负责注入测试数据。

## 目标
在 `gui_launcher` 增加一个按钮，用于**一键构造可人工观察的测试场景**：
1) 自动启动/激活 `new-card-scheduler` 窗口；
2) 通过 MsgCenter 向 planner 注入一张草稿卡，并写入 Q/A 示例 annotation-id；
3) 可在 gui_launcher 日志中看到发送的消息与必要的回执/超时告警（不做静默兜底）。

## 约束
- 必须遵守 `docs/contracts/card-planner.md`（Ingest/State/Final Output）语义。
- Fail-Fast：参数缺失、端口不可用、MsgCenter 未监听、序列化失败等必须明确报错并记录日志。
- 仅修改 GUI/Launcher 相关代码：优先 `gui_launcher.py`，必要时 `src/gui_launcher/**`。

## 建议实现（可调整，DoD 不变）
### 1) UI：新增按钮
在 `gui_launcher.py` 主窗口 `row_tools` 增加按钮（建议文案）：
- `Card Planner 测试：注入样例草稿卡`

点击后执行：
1) 复用现有 `_start_new_card_scheduler_hosted()` 启动窗口；
2) 发送两条 `card-planner:ingest:requested` 到 `to="new-card-scheduler"`：
   - 第 1 条：`target.kind="new"` + `face="Q"` + `annotation_ids=["ann_1","ann_2"]`
   - 第 2 条：`target.kind="last"` + `face="A"` + `annotation_ids=["ann_3"]`  
   说明：`CardsEngine` 的 `last` 在未选中时会定位“最近创建的卡片”（即第 1 条创建的卡），可把 A 写入同一卡片。

### 2) 消息格式（强制）
必须是标准协议字段集合（至少包含）：
```json
{
  "type": "card-planner:ingest:requested",
  "to": "new-card-scheduler",
  "timestamp": 0,
  "request_id": "rid",
  "data": { "op": { ... }, "annotation_ids": ["ann_1"] }
}
```

### 3) 回执策略（非必须，但推荐）
- 若 MsgCenter/Planner 会回 `card-planner:ingest:completed/failed`，则用 `request_id` 关联并打印 `[ACK]`。
- 若未收到回执：打印 `[WARN] 超时未收到回执（已发送）`，但不得吞掉异常。

## 必须新增/更新测试（至少 1 条）
在 `src/gui_launcher/__tests__/` 增加或扩展测试，用 pyqt stubs 捕获调用：
- 验证点击“测试注入”按钮后，会调用 `_send_ws_text_qt` 且 payload 中包含：
  - `type="card-planner:ingest:requested"`
  - `to="new-card-scheduler"`
  - `data.op.kind` 与 `data.op.target.kind` 符合预期
  - `data.annotation_ids` 解析正确（分号/空白等不参与本任务）

## 验收（DoD）
- `pnpm -s run lint` ✅（main 侧统一跑）
- `python -m pytest -q <你新增/修改的 gui_launcher 测试路径>` ✅
- 手工点检：
  1) 启动 `python gui_launcher.py`
  2) 点击“启动后端(Hosted)”确保 MsgCenter 端口监听
  3) 点击“Card Planner 测试：注入样例草稿卡”
  4) 观察新卡片规划器窗口：应出现草稿卡，Q/A 计数与元信息预览可见（至少出现 `ann_1/ann_2/ann_3`）

