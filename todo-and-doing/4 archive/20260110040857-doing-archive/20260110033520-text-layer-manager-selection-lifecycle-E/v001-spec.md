# [pdf-viewer][E] TextLayerManager：selection 监听生命周期回归加固（P1）规格说明

**功能ID**: 20260110033520-text-layer-manager-selection-lifecycle-E  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 03:35:20  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-E`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-E`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`
- 关注点：`TextLayerManager` 在 `document` 上安装 `selectionchange`，并向容器派发 `selectionchanged`；容器切换/销毁时必须保证：
  - 不向陈旧容器派发；
  - destroy 后必须移除 `selectionchange` 监听，避免泄漏与跨实例污染。

## 目标（以回归测试驱动）
1) 增加最小回归测试覆盖：
   - setContainer 切换后，事件只派发到最新容器；
   - destroy 后触发 selectionchange，不再派发、不再写 DOM。
2) 若测试暴露缺口，再做最小修复（禁止大改造）。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/ui/text-layer-manager.js`
  - `src/frontend/pdf-viewer/ui/__tests__/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：缺失 container 等关键依赖必须 throw。

## 验收（DoD）
- 必须提交到 `worker/refactor-E`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

