# 任务说明（B）- StateManager 批量更新/降噪（P2）

## 0. 任务目标
降低 `StateManager` 的“多次 set* 触发多次 STATE.CHANGED 快照事件”的面条化风险，为后续 UI 订阅解耦打基础：
- 新增一个 **显式** 的批量更新入口（例如 `batchUpdate` 或 `withBatch`），确保批量更新只发一次变更事件。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/core/state-manager.js`
  - `src/frontend/pdf-viewer/core/__tests__/**`（新增/修改测试）
- 不要改动其他 feature 业务逻辑（本任务只做“设施接口 + 单测”）。
- **不要修改** `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增批量更新 API（无 fallback；非法入参必须 throw）。
- 新增回归测试：批量更新 N 个字段时 `STATE.CHANGED` 只触发 1 次（或符合你定义的明确规则）。
- 门禁通过：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 提交 1 个 commit（包含 API + 单测）。
- 更新 `todo-and-doing/1 doing/20260109175620-core-state-manager-batch-update-B/working-log.md`。

