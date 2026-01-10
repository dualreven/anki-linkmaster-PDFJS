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
- （待实现）
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。

