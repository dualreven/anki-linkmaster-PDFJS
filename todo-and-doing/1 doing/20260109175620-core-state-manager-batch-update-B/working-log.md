# Working Log（B）- 20260109175620-core-state-manager-batch-update-B

## 1. 结论摘要
- 新增 API：`StateManager.batchUpdate(fn)`
- 行为约定：
  - 批量内多次 `set*` 不会逐次 emit；结束时若有变化则仅 emit 1 次 `PDF_VIEWER_EVENTS.STATE.CHANGED`（`field="batchUpdate"`，附带 `changes[]` + `state` 快照）
  - 同一字段在 batch 内多次变化：`oldValue` 取第一次变化前值，`newValue` 取最后一次变化后值
  - 禁止嵌套 batch（Fail‑Fast：直接 throw）
- 回归测试：批量更新 4 个字段仅触发 1 次 `STATE.CHANGED`

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 交付信息
- commit：`<pending>`
