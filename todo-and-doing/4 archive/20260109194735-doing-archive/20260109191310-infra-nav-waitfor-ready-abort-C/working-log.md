# Working Log（C）- 20260109191310-infra-nav-waitfor-ready-abort-C

## 1. 结论摘要
- 风险点：
  - `NavigationService.#waitForPageReady()` 内部使用 `setTimeout` 轮询，若不具备可取消能力，viewer 卸载/切文件/销毁服务后可能继续跑旧回调。
- 修复：
  - 引入“可取消的等待”实现：所有 `waitForPageReady` 相关 `setTimeout` 统一纳入内部注册表；`destroy()` 触发 abort，清理所有 pending timeout 并使等待中的 Promise 失败退出（error 含 destroyed）。
- 回归测试：
  - 新增 `navigation-service.waitfor-ready-abort.test.js`（fake timers）覆盖：
    - 50ms 轮询场景 destroy 后定时器清零；
    - viewerContainer 缺失的固定延迟 fallback destroy 后定时器清零；
    - 且同页+scroll=false 场景不会产生 `NAVIGATION.GOTO` side-effect。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.waitfor-ready-abort.test.js -i`

## 3. 交付信息
- commit：见 `git log -1`（`worker/refactor-C`）
