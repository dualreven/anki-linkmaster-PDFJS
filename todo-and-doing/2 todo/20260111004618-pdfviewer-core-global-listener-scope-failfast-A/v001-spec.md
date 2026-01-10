# PDFViewer core：GlobalListenerScope Fail-Fast + 生命周期收敛

**功能ID**: 20260111004618-pdfviewer-core-global-listener-scope-failfast-A
**优先级**: 高（P0：全局监听器治理）
**版本**: v001
**创建时间**: 2026-01-11 00:46:18
**状态**: 设计中

## 目标
- 将 `src/frontend/pdf-viewer/core/global-listener-scope.js` 做成真正的 Fail-Fast：
  - unsubscribe 失败不能静默吞掉（不得 try/catch 仅 warn）
  - unsubscribe 二次调用视为 bug（Fail-Fast）
- 将 `LifecycleManager` 的全局监听器注册统一迁移为使用 `GlobalListenerScope`（减少重复模式，提升可测性）。

## 约束条件（严格代码隔离：必须遵守）
### scope（只允许改这些）
- `src/frontend/pdf-viewer/core/**`
- `todo-and-doing/1 doing/20260111004618-pdfviewer-core-global-listener-scope-failfast-A/working-log.md`
- **禁止修改**：`src/frontend/pdf-viewer/bootstrap/**`、`src/frontend/pdf-viewer/assets/**`、`src/frontend/pdf-viewer/features/**`
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 自检（提交前必须执行并贴到 working-log）
- `git diff --name-only main..HEAD` 结果必须全部落在上述 scope 内；否则视为未完成（必须重提）。

## 实施要点
- `onWindow/onDocument` 返回的 unsubscribe：
  - 第一次调用：必须执行 `removeEventListener`
  - 第二次调用：必须抛错（帮助发现重复清理/重入问题）
- `LifecycleManager` 改为用 `onWindow(...)` 注册 error/unhandledrejection，并在 uninstall/destroy 路径调用 unsubscribe。

## 可行验收标准（DoD）
- 必须提交 git，并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) unsubscribe 二次调用必须抛错
  2) LifecycleManager install→uninstall：解绑必须发生且无残留
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅
