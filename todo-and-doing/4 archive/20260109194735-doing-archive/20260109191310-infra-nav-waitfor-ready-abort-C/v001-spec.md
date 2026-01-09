# 任务说明（C）- NavigationService.waitForPageReady 可取消（P1）

## 0. 任务目标
让 `NavigationService` 的 “等待页面 ready” 轮询具备可取消能力，确保：
- viewer 卸载/切换文件/销毁服务后，不会继续跑旧的 `setTimeout` 轮询回调。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js`
  - `src/frontend/pdf-viewer/features/infra-nav-core/__tests__/**`
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 引入取消机制（例如内部 `AbortController` 或显式 `cancelToken`），并在 `destroy()` 中触发取消。
- 新增回归测试：用 fake timers 验证 destroy 后不会再触发轮询回调/不会再触发任何 eventBus side-effect。
- 门禁：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 1 个 commit（代码+测试）。
- 更新 `todo-and-doing/1 doing/20260109191310-infra-nav-waitfor-ready-abort-C/working-log.md`。

