# 任务说明（C）- NavigationService destroy 清理订阅/定时器（P1）

## 0. 任务目标
补齐 `NavigationService` 的卸载清理，避免重复安装导致订阅泄漏/残留定时器：
- `#setupEventListeners()` 注册的 EventBus 订阅必须在 `destroy()` 中解除。
- `#waitForPageReady` 相关轮询/定时器必须可取消，并在 `destroy()` 时停止。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js`
  - `src/frontend/pdf-viewer/features/infra-nav-core/__tests__/**`
- **不要修改** `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- `destroy()` 后不再响应任何 EventBus 事件；不会继续执行等待轮询回调。
- 新增回归测试：模拟 install->destroy->emit 事件，验证 handler 不再被调用；并验证定时器被取消（可用 fake timers）。
- 门禁通过：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 提交 1 个 commit（修复 + 测试）。
- 更新 `todo-and-doing/1 doing/20260109175630-infra-nav-destroy-cleanup-C/working-log.md`。

