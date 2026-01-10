# [pdf-viewer][C] adapters：去除 URL 解析对 pdfId 的直连依赖（P1）规格说明

**功能ID**: 20260110040857-adapters-pdfid-provider-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 04:08:57  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/refactor-C`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-C`）

## 背景（来自面条化治理计划）
- 计划：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`
- 现状：adapters 层存在“从 URL/导航入口反推 pdfId”的隐式依赖，导致跨模块耦合与测试困难。

## 目标
把 “pdfId 的来源” 抽象为可注入 provider（或显式参数）：
- adapters 不再直接读取/解析 URL 来得到 pdfId；
- 入口（bootstrap / feature install）在边界处一次性决定 pdfId，并传入 adapters；
- 关键路径增加最小回归测试，确保行为不变且依赖缺失时 fail-fast。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/adapters/**`（如确需改动 wiring，可扩展到相邻 install 文件，但需最小化）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：缺少 pdfId/provider 必须 throw；不得静默 fallback。

## 必须新增回归测试（至少 1 条）
- 建议覆盖：
  1) 未注入 provider / pdfId 时调用入口直接 throw；
  2) 注入后，adapters 产生的关键事件/调用与之前一致（可用 spy/assert）。

## 验收（DoD）
- 必须提交到 `worker/refactor-C`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

