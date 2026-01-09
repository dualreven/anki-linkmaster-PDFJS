# [pdf-viewer][B] ScreenshotTool：从事件驱动渲染推进到 store-reactive（P1）规格说明

**功能ID**: 20260110033517-pdf-annotation-screenshot-store-reactive-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 03:35:17  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-B`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-B`）

## 背景（来自扫描报告）
- 报告：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`（P1-C）
- 当前仍可见：ScreenshotTool 依赖 `ANNOTATION.CREATED/DELETED` 与 `ANNOTATION.DATA.LOADED` 来驱动 marker 恢复/移除，存在“状态变化不经事件”的不同步风险。

## 目标（小步可交付）
让 ScreenshotTool 的 marker 渲染只由 **AnnotationManager.store** 驱动（基于 diff）：
- 新增/删除 screenshot 类型标注 → marker 增/删；
- 载入数据（bulk load）→ marker 自动恢复；
- destroy 后不再响应 store 变化（订阅必须对称解除）。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 禁止双驱动：不得同时依赖 “store diff” 与 “CREATED/DELETED” 来驱动同一套 marker（避免重复渲染/竞态）。
- Fail-Fast：关键依赖缺失应显式报错（不要吞错继续跑）。

## 必须新增回归测试（至少 1 条）
- 建议新增测试覆盖：
  1) 模拟 store 从空 → 增加 1 个 screenshot annotation：marker 被创建；
  2) 再从 store 移除该 annotation：marker 被移除；
  3) destroy 后再变更 store：不应再写 DOM/不应再注册 pdfjs 事件。

## 验收（DoD）
- 必须提交到 `worker/refactor-B`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

