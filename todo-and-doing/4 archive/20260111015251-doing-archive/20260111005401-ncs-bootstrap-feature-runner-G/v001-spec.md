# New Card Scheduler - bootstrap runner（Feature/container 框架落地，最小可用）

**功能ID**: 20260111005401-ncs-bootstrap-feature-runner-G  
**优先级**: 高（P0：提供统一 bootstrap API，供入口调用）  
**版本**: v001  
**创建时间**: 2026-01-11 00:54  
**状态**: 设计中  

## 现状说明
- `pdf-viewer` 已有 `bootstrap/app-bootstrap-feature.js` 风格的 feature-based 启动。
- new-card-scheduler 尚无同款 `bootstrap/**` 与 feature lifecycle（install/uninstall）框架。

## 提出需求
1) 提供一个稳定的 bootstrap API（供 F 的 `index.js` 调用）：
   - 导出：`bootstrapNewCardSchedulerAppFeature(...)`
   - 返回：`{ destroy() }` 或 `uninstall()`（必须可释放资源）
2) 至少落地一个 Feature 容器（install/uninstall），但**先不要求**把所有逻辑拆成多个 feature（可先有 legacy feature 占位）。

## 解决方案（建议）
- 新增：
  - `src/frontend/new-card-scheduler/bootstrap/app-bootstrap-feature.js`
  - `src/frontend/new-card-scheduler/features/legacy/legacy-feature.js`（install/uninstall 包装现有 main 的导出，接口由 H 任务提供）
- 设计契约（供 I 测试使用）：
  - `bootstrapNewCardSchedulerAppFeature({ rootEl? })`：
    - rootEl 缺省：内部按现有约定查找 `#planner-workspace`
    - 返回对象必须包含 `destroy()`，重复调用 destroy 必须幂等（或明确抛错，但需可测）。

## 约束条件（隔离：写死 scope，禁止重叠）
### 允许新增（仅限）
- 仅新增：
  - `src/frontend/new-card-scheduler/bootstrap/**`
  - `src/frontend/new-card-scheduler/features/**`
  - `src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.html`、`src/frontend/new-card-scheduler/index.js`（F 负责）
- 禁止修改：`src/frontend/new-card-scheduler/main.js`（H 负责）
- 禁止修改：`src/frontend/new-card-scheduler/planner/**`（本阶段不拆内部实现）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 完成定义（DoD）
- 必须提交 git，并提供 commit hash。
- 通过最小门禁：
  - `pnpm -s run lint`
  - Jest（本任务新增测试）：`src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js`
    - 断言：bootstrap 返回对象包含 `destroy()`，且调用 `destroy()` 不抛异常（最小契约）。

