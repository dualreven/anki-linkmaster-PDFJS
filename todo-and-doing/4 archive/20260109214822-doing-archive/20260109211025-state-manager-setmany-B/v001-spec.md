# 任务说明（B）- StateManager.setMany 批量更新入口（P2）

## 0. 任务目标
在现有 `batchUpdate(fn)` 基础上增加一个更直观的批量更新入口（建议命名 `setMany(updates)`）：
- `setMany({fieldA: x, fieldB: y})` 内部走 `batchUpdate`，保证 `STATE.CHANGED` 只触发一次。
- 非法入参必须 throw（Fail-Fast）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/core/state-manager.js`
  - `src/frontend/pdf-viewer/core/__tests__/state-manager.test.js`
- 不要改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增单测覆盖：
  - `setMany` 只发一次 `STATE.CHANGED`
  - 非法入参 throw
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109211025-state-manager-setmany-B/working-log.md`。

