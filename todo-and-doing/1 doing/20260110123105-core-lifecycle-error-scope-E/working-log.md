# 20260110123105-core-lifecycle-error-scope-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:31:05
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 cleanup 卸载的最小回归测试（spy window.add/removeEventListener）
2. 实现卸载对称（destroy/cleanup 必卸载）
3. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 下一步计划:
- 交付 commit hash

