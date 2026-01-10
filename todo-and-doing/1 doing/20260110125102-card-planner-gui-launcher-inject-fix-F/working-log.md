# 20260110125102-card-planner-gui-launcher-inject-fix-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（修复注入 to 字段与多窗口问题入口）
### 工作步骤:
1) 注入消息 `to` 改为 `[{client_id:\"new-card-scheduler\"}]`
2) pytest 覆盖 `to` 列表结构
3) 验收：lint + pytest by path
### 工作结果:
- 待执行

## 工作记录2
**时间**: 2026-01-10 16:34:30
### 工作内容:
- 修复 gui_launcher 注入消息 forward 路由：`to` 改为列表且包含 `client_id="new-card-scheduler"`；并补齐失败场景（NO_TARGET_FOUND）弹窗与错误日志。
### 关键变更:
- `gui_launcher.py`：两条 `card-planner:ingest:requested` 的 `to` 改为 `[{ "client_id": "new-card-scheduler" }]`
- `src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`：更新断言 `to` 为 list 且首元素包含 `client_id`
### 验收命令与结果:
1) `pnpm -s run lint` ✅
2) `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py` ✅
### 提交:
- commit: `0e9a8c6`
