# 任务说明（A）- LifecycleManager 全局错误监听卸载对称性（P1）

## 0. 任务目标
确保 `LifecycleManager` 注册的全局错误监听（`window error` / `unhandledrejection` 等）在销毁时一定对称卸载，避免 viewer 重建后重复弹 Toast/重复记录日志。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/core/lifecycle-manager.js`
  - `src/frontend/pdf-viewer/core/__tests__/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- `setupGlobalErrorHandling()` 多次调用不会重复注册监听器（或明确 throw，二选一但必须稳定）。
- `cleanup()`/`destroy()` 后监听器被移除。
- 必须新增回归测试（mock `window.addEventListener/removeEventListener` 或用 jsdom 事件触发验证）。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 1 个 commit（修复+测试）。
- 更新 `todo-and-doing/1 doing/20260109191240-lifecycle-global-error-cleanup-A/working-log.md`。

