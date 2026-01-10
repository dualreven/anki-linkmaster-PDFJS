# [pdf-viewer][E][P2] core：LifecycleManager 全局 error handler 卸载对称

**功能ID**: 20260110123105-core-lifecycle-error-scope-E  
**优先级**: 低（P2，防长期全局污染）  
**版本**: v001  
**创建时间**: 2026-01-10 12:31:05  
**预计完成**: 2026-01-13  
**状态**: 开发中  
**负责分支**: `worker/refactor-E`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-E`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
- 发现：`LifecycleManager.setupGlobalErrorHandling()` 在 `window` 上注册 `unhandledrejection` 与 `error`，虽有 guard，但销毁后仍可能保留对 eventBus 的引用，造成跨模块“全局 handler”污染。

## 目标
1) 将 global error handler 的注册/注销与 viewer 生命周期绑定：destroy/cleanup 时必须卸载。
2) 若已存在 guard，仍必须提供可验证的“卸载对称”实现（不要只靠 flag）。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/core/**` 与相邻最小文件集
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：重复注册/缺失依赖必须显式报错或 throw（以既有约定为准）。

## 必须新增回归测试（至少 1 条）
- 建议覆盖：
  1) `setupGlobalErrorHandling()` 注册一次；
  2) `cleanup()` 后 `window.removeEventListener` 成对调用；
  3) 再次初始化不会产生重复监听（无泄漏）。

## 验收（DoD）
- 必须提交到 `worker/refactor-E`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

