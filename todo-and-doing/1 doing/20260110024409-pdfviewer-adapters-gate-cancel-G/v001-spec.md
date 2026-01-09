# [pdf-viewer][G] adapters：gate/destroy 竞态收敛 规格说明

**功能ID**: 20260110024409-pdfviewer-adapters-gate-cancel-G  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 02:44:09  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`

## 背景
`todo-and-doing/1 doing/20260110014111-pdfviewer-adapters-gate-cancel-A/` 已存在同类任务（A 口径）。本任务用于让 G 承接该问题的修复推进（以 commit 交付为准）。

## 目标
让 `src/frontend/pdf-viewer/adapters/**` 在 gate/等待期间发生 `destroy()` 时：
- 不再触发任何业务副作用；
- 不抛未捕获异常；
- 订阅/定时器清理对称；
- 补 1 条最小回归测试防回归。

## 约束
- 仅修改：`src/frontend/pdf-viewer/adapters/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：输入非法直接抛错，禁止兜底。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.gate-destroy.regression.test.js -i` ✅（若文件名不同，以实际新增为准）

