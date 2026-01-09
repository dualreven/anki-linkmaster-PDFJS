# Working Log（A）- 20260109191240-lifecycle-global-error-cleanup-A

## 1. 结论摘要
- 根因/风险：`LifecycleManager` 会注册 `window` 级别的 `error/unhandledrejection` 监听；若 Viewer 重建但旧实例未对称 cleanup，会导致重复 toast/重复日志。需确保同一实例内 setup 幂等且 cleanup/destroy 一定卸载。
- 修复：补齐 `LifecycleManager.destroy()`（语义别名，等价于 `cleanup()`），并用回归测试锁定“setup 不重复注册 + cleanup 对称 remove”行为。
- 回归测试：更新 `src/frontend/pdf-viewer/core/__tests__/lifecycle-manager.test.js`，mock `window.addEventListener/removeEventListener` 校验调用次数与 handler 引用一致性。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/lifecycle-manager.test.js -i`

## 3. 交付信息
- commit：本提交（请用 `git log -1` 查看 hash）
