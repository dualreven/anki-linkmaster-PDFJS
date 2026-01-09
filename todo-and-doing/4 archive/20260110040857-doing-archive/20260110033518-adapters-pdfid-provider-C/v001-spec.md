# [pdf-viewer][C] adapters：去 URL 依赖（pdfId provider 注入）（P1）规格说明

**功能ID**: 20260110033518-adapters-pdfid-provider-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 03:35:18  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-C`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-C`）

## 背景（来自扫描报告）
- 报告：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`（P1-A）
- 当前仍存在：`src/frontend/pdf-viewer/adapters/websocket-adapter-viewer.js` 调用 `getCurrentPdfIdFromWindow()`（URL 隐式耦合）。

## 目标
让 adapters 不再直接读取 `window.location`/URL：
- 为 `websocket-adapter-viewer.js` 引入显式 `pdfIdProvider`（或等价命名）；
- provider 缺失/返回空值：直接 throw（Fail-Fast）；
- 更新装配层传入 provider（仅最小接线）。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/adapters/**`
  - 如需接线：`src/frontend/pdf-viewer/bootstrap/**` 或 adapters 装配入口（只做注入，不做额外业务改动）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 禁止兜底：不得在 adapters 内部继续 fallback 到 `getCurrentPdfIdFromWindow()`。

## 必须新增回归测试（至少 1 条）
- 新增 Jest 用例覆盖：
  1) 未提供 provider → 必须抛错（错误信息包含缺失原因）
  2) 提供 provider → 不读取 URL（可通过 mock `window.location`/spy 来断言）

## 验收（DoD）
- 必须提交到 `worker/refactor-C`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

