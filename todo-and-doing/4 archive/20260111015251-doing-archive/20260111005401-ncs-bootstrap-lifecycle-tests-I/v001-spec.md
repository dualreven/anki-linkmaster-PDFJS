# New Card Scheduler - v006 集成回归测试（bootstrap/feature/container 生命周期）

**功能ID**: 20260111005401-ncs-bootstrap-lifecycle-tests-I  
**优先级**: 中（P1：防回归与合并验收支点）  
**版本**: v001  
**创建时间**: 2026-01-11 00:54  
**状态**: 设计中  

## 现状说明
- v006 是架构对齐改造，风险主要在“双启动/资源泄漏/入口不一致”。
- 需要一组“集成级契约测试”锁住：
  - entrypoint 走 bootstrap runner
  - bootstrap 返回可 destroy
  - destroy 后 DOM 不残留/二次 destroy 不爆炸

## 提出需求
1) 新增一份（或多份）Jest 契约测试，覆盖：
   - `bootstrapNewCardSchedulerAppFeature` 存在且可调用
   - 返回对象包含 `destroy()` 且可调用
   - 在 jsdom 下 mount/destroy 后关键 DOM（如 `#planner-workspace` 的子节点）被清理或至少不重复挂载
2) 测试文件必须只新增，不修改其他源码文件（保持隔离）。

## 约束条件（隔离：写死 scope，禁止重叠）
### 允许新增（仅限）
- 仅新增：
  - `src/frontend/new-card-scheduler/__tests__/bootstrap-lifecycle.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.html`、`index.js`（F）
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`features/**`（G）
- 禁止修改：`src/frontend/new-card-scheduler/main.js`（H）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 完成定义（DoD）
- 必须提交 git，并提供 commit hash。
- 通过最小门禁：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-lifecycle.contract.test.js -i`

