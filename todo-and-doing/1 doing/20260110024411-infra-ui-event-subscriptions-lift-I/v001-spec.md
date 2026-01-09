# [pdf-viewer][I] infra-ui：订阅提升/集中清理 规格说明

**功能ID**: 20260110024411-infra-ui-event-subscriptions-lift-I  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 02:44:11  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-I`

## 背景
`todo-and-doing/1 doing/20260110014111-infra-ui-event-subscriptions-lift-B/` 已存在同类任务（B 口径）。本任务用于让 I 承接该问题的实现推进（以 commit 交付为准）。

## 目标
在 `src/frontend/pdf-viewer/features/infra-ui/**` 内：
- 将分散的 eventBus/DOM 订阅收敛为“集中注册 + 集中清理”的结构；
- `destroy/uninstall` 必须对称解绑；
- 补 1 条最小回归测试覆盖“destroy 后不再触发 handler/不残留监听”。

## 约束
- 仅修改：`src/frontend/pdf-viewer/features/infra-ui/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：缺失依赖/DOM 必须报错。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径> -i` ✅

