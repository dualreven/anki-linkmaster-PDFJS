# Working Log - 20260111144355-card-planner-qa-smart-input-F

## 目标
- 实现 Card Planner 的 Q/A 并列智能输入框（标注ID识别/高亮/粘贴/注入追加 `[[id]]`），并补回归测试。

## 交付
- Commit: `16047994`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.render.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.paste-and-append.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.ingest-append.contract.test.js -i`：✅
