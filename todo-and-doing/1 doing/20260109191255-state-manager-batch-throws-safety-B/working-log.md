# Working Log（B）- 20260109191255-state-manager-batch-throws-safety-B

## 1. 结论摘要
- 行为约定：`batchUpdate(fn)` 内 throw 时不发 `STATE.CHANGED`（避免发出“部分成功”的聚合事件），但内部状态会按已执行的 set* 变化保留（不做回滚）。
- 修复：throw 后确保清理 batch 状态，后续可再次调用 `batchUpdate`（不应误判为嵌套/坏状态）。
- 回归测试：覆盖 throw 后可继续 batchUpdate + throw 场景下不发 `STATE.CHANGED`。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 交付信息
- commit：`fix(pdf-viewer): make batchUpdate exception-safe`（hash 见 `git log -1`）
