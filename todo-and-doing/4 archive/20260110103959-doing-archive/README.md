# Doing Archive - 20260110103959

- 归档原因：Card Planner（G/H/I）本轮交付已合入 main 并通过门禁。
- 合入提交（main）：
  - G：`91e6984` + `3dbe243`
  - H：`46da3e7`、`3724914`
  - I：`d7cdd9b`
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js -i` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js -i` ✅
  - `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_card_planner_final_output_unit.py` ✅

