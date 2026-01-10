# 20260110105623-card-planner-gui-launcher-manual-test-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 10:56:23
### 工作内容:
- 初始化任务（未开始编码）
### 工作步骤:
1) 在 `gui_launcher.py` 增加按钮并绑定 slot
2) 复用 `_start_new_card_scheduler_hosted()` 打开窗口
3) 通过 `_send_ws_text_qt` 发送两条 `card-planner:ingest:requested`
4) 新增/更新 pytest 覆盖该按钮路径
5) 验收：lint + pytest by path
### 工作结果:
- 待执行
### 下一步计划:
- 完成交付并回填 commit hash

## 工作记录2
**时间**: 2026-01-10 12:14:30
### 工作内容:
- gui_launcher 增加“Card Planner 测试：注入样例草稿卡”按钮：一键启动/激活 new-card-scheduler，并通过 MsgCenter 注入两条 ingest（Q: ann_1/ann_2，A: ann_3）。
### 关键变更:
- `gui_launcher.py`：新增按钮并绑定 `_card_planner_manual_test_inject_sample_draft_cards()`；发送两条 `card-planner:ingest:requested`（`to="new-card-scheduler"`），等待 `ingest:completed/failed` 回执（2s 超时打 WARN）
- `src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`：新增 pytest 覆盖发送的两条 ingest payload 关键字段与回执等待参数
### 验收命令与结果:
1) `pnpm -s run lint` ✅
2) `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py` ✅
### 提交:
- commit: `ce005a1`
### 手工点检步骤:
1) 启动：`python gui_launcher.py`
2) 点击“启动后端(Hosted)”确保 MsgCenter 监听
3) 点击“Card Planner 测试：注入样例草稿卡”
4) 切到新卡片规划器窗口：应出现草稿卡，且可见 ann_1/ann_2/ann_3 的预览/计数（至少能看到这些 id）
