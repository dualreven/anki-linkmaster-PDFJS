# [pdf-viewer][E] TextLayerManager：selection 生命周期回归与清理对称（P1）规格说明

**功能ID**: 20260110040857-text-layer-manager-selection-lifecycle-E  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 04:08:57  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/refactor-E`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-E`）

## 背景（来自面条化治理计划）
- 计划：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`
- 现状：TextLayer/selection 相关监听在切换页面/销毁时容易残留，导致 selection 状态错乱或重复监听。

## 目标
让 TextLayerManager 的 selection 生命周期清晰、清理对称：
- 初始化/绑定只发生一次（或幂等）；
- destroy 时解除所有监听；
- 切换文档/页面后 selection 仍能正常工作且无重复监听。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/**` 中与 TextLayerManager 相关的最小范围文件（以 DoD 为准最小化）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：关键依赖缺失直接 throw。

## 必须新增回归测试（至少 1 条）
- 建议覆盖：
  1) create → destroy → 再 create 的循环，不应残留全局监听；
  2) selection 流程仍可用（可用最小 DOM + 事件模拟）。

## 验收（DoD）
- 必须提交到 `worker/refactor-E`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

