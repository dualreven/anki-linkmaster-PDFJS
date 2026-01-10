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

## 工作记录2
**时间**: 2026-01-10 14:29
### 工作内容:
- 将 `LifecycleManager.setupGlobalErrorHandling()` 由“重复调用仅 warn + return”改为 Fail-Fast：重复调用直接抛错，避免全局 handler 污染被静默掩盖。
- 新增回归测试覆盖：重复调用抛错且不重复 add；cleanup 后可再次 setup；每轮 add/remove 必须对称且 handler 引用一致。

### 改动范围:
- `src/frontend/pdf-viewer/core/lifecycle-manager.js`
- `src/frontend/pdf-viewer/core/__tests__/lifecycle-manager.test.js`

### 自验:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/core/__tests__/lifecycle-manager.test.js -i` ✅

### 工作结果:
- 已完成：`0532c5229434df227c644d4e9b3c0e261bca2e44`
