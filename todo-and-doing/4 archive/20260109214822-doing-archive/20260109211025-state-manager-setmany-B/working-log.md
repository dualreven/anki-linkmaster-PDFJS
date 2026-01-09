# Working Log（B）- 20260109211025-state-manager-setmany-B

## 1. 结论摘要
- API：新增 `StateManager.setMany(updates)`，用于更直观地批量设置多个字段。
- 行为约定：
  - `setMany` 在非 batching 场景下内部走 `batchUpdate`，保证 `STATE.CHANGED` 聚合事件只触发一次；
  - 在 `batchUpdate` 内调用 `setMany` 不会嵌套调用 `batchUpdate`（避免“禁止嵌套”异常），直接逐个调用对应 `set*`。
  - `updates` 必须是 plain object，且仅允许字段：`initialized/currentFile/currentPage/totalPages/zoomLevel`；否则 fail-fast throw。
- 回归测试：覆盖 `setMany` 单次聚合事件、非法入参 throw、batchUpdate 内调用 setMany 不触发嵌套异常。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 交付信息
- commit：`feat(pdf-viewer): add StateManager.setMany`（hash 见 `git log -1`）
