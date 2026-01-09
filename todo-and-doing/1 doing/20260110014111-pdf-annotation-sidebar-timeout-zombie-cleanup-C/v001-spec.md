# [pdf-viewer][C] pdf-annotation：Sidebar zombie code + timeout 清理规格说明

**功能ID**: 20260110014111-pdf-annotation-sidebar-timeout-zombie-cleanup-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 开发中

## 现状说明
- 扫描报告指出：Sidebar UI 已 store-reactive，但仍残留 `subscriptions.js` 中的 zombie code（误导维护者）。
- Sidebar 中存在 destroy 后仍可能触发的 `setTimeout`（DOM 操作延迟）。

## 存在问题
- 误导性代码增加维护成本；延迟 DOM 操作存在生命周期风险（destroy 后操作已销毁节点）。

## 提出需求
- 清理/收敛 Sidebar 的 zombie subscriptions：只保留真实被调用的订阅/回调。
- destroy 时必须清理所有 timeout，避免延迟回调触碰已销毁 DOM。
- 必须补 1 条回归测试防回归。

## 解决方案（建议）
- 用测试先锁定：destroy 后 timeout 不再触发（spy 或 fake timers）。
- 再做最小删改：移除未使用的 handler 参数与 dead code。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/pdf-annotation/**`

### 严格遵循代码规范和标准
- 必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- Fail-Fast：缺失依赖/DOM 直接报错，不做静默忽略。

## 可行验收标准
### 单元测试（必须新增）
- 新增回归测试：destroy 后推进 timers，不触发任何 DOM 写入/不抛异常。

### 门禁
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径>` ✅

