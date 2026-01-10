# [pdf-viewer][A][P0] infra-nav-core：NavigationService 卸载清理 + 可取消 waitForPageReady

**功能ID**: 20260110123105-infra-nav-navigation-service-cleanup-A  
**优先级**: P0  
**版本**: v001  
**创建时间**: 2026-01-10 12:31:05  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-A`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-A`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`
- 发现：`NavigationService` 在 `#setupEventListeners` 注册 EventBus 监听，但 `destroy()` 未成对卸载；`#waitForPageReady` 使用 `setTimeout` 轮询 DOM，缺少取消机制，卸载后仍可能继续触发回调造成泄漏/噪声日志。

## 目标
1) `NavigationService.destroy()` 必须 **对称清理**：
   - 卸载所有 eventBus 订阅（成对 off / unsubscribe）；
   - 取消所有仍在等待的 `waitForPageReady` 轮询（不再触发回调）。
2) `waitForPageReady` 变为可取消、可测试的实现（例如 `AbortController` 或内部 token），destroy 后不得继续执行任何异步回调。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/infra-nav-core/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：关键依赖缺失直接 throw；禁止静默兜底继续跑。

## 必须新增回归测试（至少 1 条）
- 新增 Jest 用例覆盖至少两项：
  1) `destroy()` 后，之前注册的 eventBus 订阅不会再触发（可用 spy 断言 off/取消函数被调用）；
  2) `destroy()` 后，`waitForPageReady` 不会再触发任何 `setTimeout` 回调（fake timers + spy）。

## 验收（DoD）
- 必须提交到 `worker/refactor-A`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

