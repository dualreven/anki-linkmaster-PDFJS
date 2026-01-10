# 20260111005401-ncs-bootstrap-feature-runner-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 为 new-card-scheduler 增加 feature-based bootstrap runner（install/uninstall 框架，最小可用）。
### 工作步骤:
1. 新增 `bootstrap/app-bootstrap-feature.js`，导出 `bootstrapNewCardSchedulerAppFeature`。
2. 新增 `features/legacy/legacy-feature.js`（包装 H 任务提供的 main 导出）。
3. 新增 Jest：`bootstrap-runner.contract.test.js`。
### 工作结果:
- 已新增最小可用 bootstrap runner + legacy feature，并补齐最小契约回归测试。
- 门禁通过：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js -i` ✅
- commit hash：`<TBD>`
### 下一步计划:
- 将 `<TBD>` 替换为本任务最终 commit hash。
