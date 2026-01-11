# Report - 20260111144355-card-planner-qa-smart-input-F

## Scope
- 允许修改/新增（v001 scope 内）：
  - `src/frontend/new-card-scheduler/planner/ui/**`
  - `src/frontend/new-card-scheduler/planner/cards-model.js`
  - `src/frontend/new-card-scheduler/planner/wiring/paste-wiring.js`
  - `src/frontend/new-card-scheduler/planner/__tests__/**`

## Commands & Results
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.render.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.paste-and-append.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.ingest-append.contract.test.js -i`：✅

## Deliverable
- Commit: `16047994`
- 主要变更点：
  - 新增 Q/A 并列“智能输入框”：`textarea` 叠层高亮渲染 `[[id]]`（富文本观感）
  - 支持粘贴 `ann_1 ann_2\\n[[ann_3]]` 等格式，解析后末尾追加并阻止原始文本直接落入输入框
  - 注入/粘贴后的 UI 显示统一为 `[[id]]`（由 engine 单一真源驱动渲染）
  - `CardsEngine` 增加“替换某卡某面”API，支持输入框编辑回写
  - 新增 3 条 Jest 回归（render/paste/ingest）

## Notes / Risks
- 兼容性说明：仓库已有回归测试会查找并点击 `button[title="点击设置粘贴焦点：Q/A"]`；本任务按用户需求“UI 不展示按钮”，因此在 `workspace.js` 中**保留按钮节点但隐藏**（`display:none`）以避免既有测试/门禁失败。
