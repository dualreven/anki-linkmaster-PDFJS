# 20260110021212-card-planner-sidebar-layout-regression-tests-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 02:12:12
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 参考 `src/frontend/pdf-home/features/sidebar/__tests__/sidebar-layout-push.test.js` 的断言方式
2. 在 new-card-scheduler 下新增回归测试文件并构造最小 DOM
3. 覆盖：默认推开 / 折叠恢复 / 再展开 / dispose 不残留
4. 自检：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成测试并交付 commit hash

