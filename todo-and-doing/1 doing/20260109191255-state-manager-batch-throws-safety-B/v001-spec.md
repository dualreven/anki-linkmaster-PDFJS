# 任务说明（B）- StateManager.batchUpdate 异常安全（P2）

## 0. 任务目标
完善 `StateManager.batchUpdate(fn)` 的异常安全与行为约定：
- 当 `fn` 内 throw 时，`StateManager` 必须恢复到可继续使用状态（不能卡在 “batch 模式”）。
- 事件发射行为必须明确：throw 时是否允许发 `STATE.CHANGED`（建议：不发，或仅发一次；二选一但要测试覆盖）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/core/state-manager.js`
  - `src/frontend/pdf-viewer/core/__tests__/state-manager.test.js`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增回归测试覆盖：
  1) `batchUpdate(() => { throw ... })` 后再次调用 `batchUpdate` 不应报“嵌套”或进入坏状态；
  2) throw 场景下 `STATE.CHANGED` 的约定行为（按你实现断言）。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109191255-state-manager-batch-throws-safety-B/working-log.md`。

