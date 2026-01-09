# Working Log（C）- 20260109175630-infra-nav-destroy-cleanup-C

## 1. 结论摘要
- 泄漏点：
  - `NavigationService.#setupEventListeners()` 注册 `eventBus.on(...)` 未保存 unsubscribe，`destroy()` 后仍会响应事件，且重复安装会触发“重复订阅”。
  - `NavigationService.#waitForPageReady()` 使用递归 `setTimeout` 轮询但未记录/可取消，`destroy()` 后仍可能继续回调。
- 修复：
  - 收集 EventBus unsubscribe 并在 `destroy()` 统一解除。
  - 引入可取消的 timeout 注册表：`destroy()` 时清理所有 pending timer，并使等待中的 `navigateTo()` 返回失败（error 含 destroyed）。
- 回归测试：
  - 新增 `navigation-service.destroy-cleanup.test.js` 覆盖：destroy 后不再响应事件、可重复创建、定时器取消。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.destroy-cleanup.test.js -i`

## 3. 交付信息
- commit：见 `git log -1`（`worker/refactor-C`）
