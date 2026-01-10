# New Card Scheduler - main.js 改为可复用模块（导出 createApp + 禁止自启动）

**功能ID**: 20260111005401-ncs-main-export-and-autoboot-guard-H  
**优先级**: 高（P0：把“脚本式装配”迁为可被 bootstrap/feature 调用）  
**版本**: v001  
**创建时间**: 2026-01-11 00:54  
**状态**: 设计中  

## 现状说明
- `src/frontend/new-card-scheduler/main.js` 内部包含大量“手工装配”逻辑，并且自身负责启动（脚本式）。
- v006 目标是让启动过程由 `index.js -> bootstrap runner -> feature/container` 统一调度，因此 `main.js` 应改为“可导入、可调用、可卸载”的模块。

## 提出需求
1) `main.js` 必须导出一个供 legacy feature 调用的 API（命名建议二选一）：
   - `createNewCardSchedulerAppOrThrow({ rootEl, clientId?, wsPort?, ... })` 返回 `{ destroy() }`
   - 或 `bootstrapNewCardSchedulerLegacyOrThrow(...)` 返回 `{ destroy() }`
2) `main.js` **不得再自动启动**（移除或严格受控自启动），避免 `index.js`+`bootstrap` 触发双启动。
3) `destroy()` 必须尽最大可能释放资源（Fail-Fast 原则：缺少关键清理句柄应抛错或至少在测试中可观测）。

## 约束条件（隔离：写死 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/main.js`
- 新增测试：`src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.html`、`src/frontend/new-card-scheduler/index.js`（F 负责）
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`src/frontend/new-card-scheduler/features/**`（G 负责）
- 禁止修改：`src/frontend/new-card-scheduler/planner/**`（避免扩大影响面）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 完成定义（DoD）
- 必须提交 git，并提供 commit hash。
- 通过最小门禁：
  - `pnpm -s run lint`
  - Jest：`src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js`
    - 断言：导出函数存在、调用后返回对象含 `destroy()`；调用 `destroy()` 后不抛异常（或符合你定义的可测错误策略）。

