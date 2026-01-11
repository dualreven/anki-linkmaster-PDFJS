# Doing Archive - 20260111155855

本目录归档了 v009 批次中已完成并合入 `main` 的 F 任务（Card Planner：Q/A 智能输入框）。

## 合入清单（main）
- F：`6d9f3731`（feat: QA smart input + 3 tests）
- F：`dbcdcea1`（fix: reject whitespace token + token-utils test）
- 任务文档：`a1b38ed6`

## main 门禁（规划者统一复验）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.render.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.paste-and-append.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/qa-smart-input.ingest-append.contract.test.js src/frontend/new-card-scheduler/planner/__tests__/token-utils.test.js -i` ✅

