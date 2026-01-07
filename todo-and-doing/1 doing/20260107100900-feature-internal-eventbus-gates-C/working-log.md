# 20260107100900-feature-internal-eventbus-gates-C - 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-07 10:09:00
### 工作内容:
- 下达任务：制定并落地“Feature 内部禁用 EventBus 闭环”的最小门禁与迁移指引。
### 工作步骤:
1. 阅读 `v001-spec.md` 与相关 SPEC-HEAD（coding/test/pdf-viewer）
2. 设计“轻量可执行”的扫描规则与白名单策略
3. 先补测试/自验证用例
4. 实现脚本/门禁并接入 `pnpm run lint` 或 CI 入口
5. 跑 lint + 测试
### 工作结果:
- （待执行）
### 存在问题:
- （待记录）
### 下一步计划:
- 在 `worker/refactor-C` 上实现并提交（交付 commit hash）

