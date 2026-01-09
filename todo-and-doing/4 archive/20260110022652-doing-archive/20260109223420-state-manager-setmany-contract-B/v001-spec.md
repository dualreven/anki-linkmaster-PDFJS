# 任务说明（B）- StateManager.setMany 入参契约化（P2）

## 0. 任务目标
第5轮新增了 `StateManager.setMany(updates)`。本任务把它“契约化”，避免未来被当成“万能对象合并”用成面条：
- 只允许更新白名单字段（例如 state 中存在且允许外部批量更新的字段）。
- 对未知字段/非法 updates 必须 throw（Fail-Fast）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/core/state-manager.js`
  - `src/frontend/pdf-viewer/core/__tests__/state-manager.test.js`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 新增测试覆盖：
  - `setMany({ unknownField: 1 })` 必须 throw（错误信息包含 unknownField）。
  - 合法字段批量更新仍只触发一次 `STATE.CHANGED`。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/state-manager.test.js -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109223420-state-manager-setmany-contract-B/working-log.md`。

