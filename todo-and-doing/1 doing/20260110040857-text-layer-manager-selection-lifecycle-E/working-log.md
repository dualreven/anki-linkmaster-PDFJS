# 20260110040857-text-layer-manager-selection-lifecycle-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写“destroy 后无残留监听”的最小回归测试
2. 梳理 TextLayerManager 的 bind/unbind 边界，确保对称清理
3. 确保 create/destroy 循环与页面切换下 selection 可用
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

