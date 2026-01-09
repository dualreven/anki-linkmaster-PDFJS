# [pdf-viewer][H] pdf-search：抽离 SearchBoxDOMManager 规格说明

**功能ID**: 20260110024410-pdf-search-dom-manager-extract-H  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 02:44:10  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`

## 背景
`todo-and-doing/1 doing/20260110014111-pdf-search-dom-manager-extract-D/` 已存在同类任务（D 口径）。本任务用于让 H 承接该问题的实现推进（以 commit 交付为准）。

## 目标
在 `src/frontend/pdf-viewer/features/pdf-search/**` 抽离 `SearchBoxDOMManager`（或等价命名）：
- 只负责 DOM 查询/事件绑定/解绑；
- 通过回调把输入/点击事件交给业务逻辑层；
- 提供明确 `init()`/`destroy()`；
- 补 1 条 JSDOM 单测，覆盖 init/cleanup 对称性（destroy 后不再触发回调）。

## 约束
- 仅修改：`src/frontend/pdf-viewer/features/pdf-search/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：缺失 DOM 必须抛错。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径> -i` ✅

