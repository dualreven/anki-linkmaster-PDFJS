# doing 归档说明（2026-01-11 00:01）

本归档包含 Card Planner v005（F/G/H/I）任务目录：修复 `annotation:bulk-get` 超时与可观测性/自检工具。

## 归档原因（完成定义达成）
- FGHI 已各自提交交付 commit（带回归测试）。
- main 侧已合入并通过门禁与定向测试：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/toast-dedupe.contract.test.js src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js src/frontend/new-card-scheduler/__tests__/card-planner.final-output.ack.contract.test.js src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i`
  - `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_annotation_bulk_get_unit.py src/gui_launcher/__tests__/test_gui_launcher_annotation_bulk_get_selftest.py`

## 人工验收建议（最小）
1) 打开新卡片规划器，注入草稿卡：不应再出现 `annotation:bulk-get 超时` toast（若失败应直接提示明确错误原因）。
2) 打开 `gui_launcher`，使用新增的 annotation bulk-get 自检入口：应能看到 `completed/failed` 的明确回执与耗时日志。

