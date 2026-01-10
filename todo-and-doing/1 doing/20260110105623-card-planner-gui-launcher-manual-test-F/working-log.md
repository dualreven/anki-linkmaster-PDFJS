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

