# 20260111005401-ncs-bootstrap-lifecycle-tests-I 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 00:54
### 工作内容:
- 为 v006 启动范式对齐补齐集成级契约测试（bootstrap/feature lifecycle）。
### 工作步骤:
1. 新增 `bootstrap-lifecycle.contract.test.js`，对齐 G/H 提供的 API。
2. 在 jsdom 环境下验证：bootstrap/destroy/重复 destroy 行为。
### 工作结果:
- （待实现）
### 下一步计划:
- 提交 commit hash + 贴出 lint/jest 通过结论。
## 工作记录2
**时间**: 
2026-01-11 01:25:23
### 工作内容:
- 新增 Jest 契约测试：覆盖 main.js 可被安全 import（禁用 auto bootstrap）、createCardPlannerApp dispose 生命周期与幂等、二次 mount 不重复挂载。
### 工作结果:
- 已完成交付（待提交/合并）。
