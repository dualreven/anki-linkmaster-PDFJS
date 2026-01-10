# [pdf-viewer][D] pdf-search：debounce/throttle 可取消（P1）规格说明

**功能ID**: 20260110040857-pdf-search-debounce-cancel-D  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 04:08:57  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/refactor-D`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-D`）

## 背景（来自面条化治理计划）
- 计划：`docs/reports/PDFVIEWER_SPAGHETTI_REMEDIATION_PLAN_20260109.md`
- 现状：search 输入链路存在 debounce/throttle 定时器残留风险；在 destroy / 切换文档时可能触发“过期回调”写 UI 或发事件。

## 目标
提供可取消的 debounce/throttle（或统一的 scheduler）：
- search 的输入/查询调度在 destroy 时能显式 cancel；
- 不允许 destroy 后的异步回调继续触发副作用；
- 新增最小回归测试覆盖“cancel 生效”。

## 约束
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-search/**`（必要时可抽到 `src/frontend/common/**` 的小工具，但必须复用现有约定）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：参数错误直接 throw。

## 必须新增回归测试（至少 1 条）
- 建议覆盖：
  1) 创建 debounce 后触发多次，destroy/cancel 后推进 timers，不应再调用核心 handler；
  2) 断言无多余事件 emit / DOM 写入。

## 验收（DoD）
- 必须提交到 `worker/refactor-D`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

