# 20260110040857-pdf-search-debounce-cancel-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写“cancel 生效”的最小回归测试（fake timers）
2. 实现可取消 debounce/throttle（或替换为现有可取消方案）
3. destroy 时必须 cancel，避免过期回调写 UI/emit
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

