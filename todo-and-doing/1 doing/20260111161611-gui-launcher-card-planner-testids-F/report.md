# Report - 20260111161611-gui-launcher-card-planner-testids-F

## Scope
- （必填）允许修改/新增（v001 scope 内）：`gui_launcher.py`（+ 可选 python tests）

## Commands & Results
- `pnpm -s run lint`：✅
- python 定向测试命令（如有）：`python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_testids.py` ✅

## Deliverable
- Commit: `863ed851`
- 主要变更点：
  - 新增“填充测试ID”按钮：填充 `ann_test_1,ann_test_2` 到 bulk-get 输入框
  - 新增“复制样例 token”按钮：复制 `[[ann_test_1]] [[ann_test_2]]` 到剪贴板
  - 新增“一键用测试ID执行 bulk-get”按钮，并用 label 显示 `count` 与 `contains_test_ids`
  - 新增 pytest 回归：`src/gui_launcher/__tests__/test_gui_launcher_card_planner_testids.py`

## Notes / Risks
- （可选）已知风险与后续建议：
