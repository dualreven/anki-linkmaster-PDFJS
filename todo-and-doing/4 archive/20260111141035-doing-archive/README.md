# 20260111141035-doing-archive

## 归档内容（v008：NCS legacy feature 安装失败修复 + 隔离任务）

- 任务目录：
  - `20260111131008-ncs-legacy-feature-context-eventbus-F`
  - `20260111131008-ncs-ws-status-panel-selfcheck-G`
  - `20260111131008-ncs-create-empty-card-button-H`
  - `20260111131008-gui-launcher-ncs-wait-register-then-inject-I`

## 验收结论

- `new-card-scheduler.legacy` feature 安装失败已修复：legacy feature 从 `context.globalEventBus` 读取 eventBus（对齐 FeatureRegistry 契约）。
- `ws-status-panel` 增加“自检/刷新”能力与回归测试。
- Planner 增加“创建空卡”按钮与回归测试。
- gui_launcher 增加“等待 NCS 注册再注入”流程与 pytest 回归。

## 验收命令

- `pnpm -s run lint`
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-runner.install-legacy.contract.test.js src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/create-empty-card-button.contract.test.js -i`
- `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`

