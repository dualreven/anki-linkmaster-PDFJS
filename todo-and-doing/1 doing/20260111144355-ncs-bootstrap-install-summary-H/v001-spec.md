# NCS - bootstrap 安装摘要与失败可观测（installAll 结果汇总）

**功能ID**: 20260111144355-ncs-bootstrap-install-summary-H  
**优先级**: P2（提升可观测性，减少“装了没装上”盲区）  
**版本**: v001  
**创建时间**: 2026-01-11 14:43  
**状态**: doing  

## 需求
在 `bootstrapNewCardSchedulerAppFeature(...)` 完成 `installAll()` 后：
1) 输出安装摘要（logger.info）：已注册 features / 已安装 features / 失败 features（若可得）
2) 若存在失败 feature：
   - 通过 `notification.showError(...)` 提示“有 feature 安装失败（详见日志）”
   - 不改变现有“失败不影响其他 feature”的策略

## 约束（严格隔离 scope）
### 允许修改/新增（仅限）
- `src/frontend/new-card-scheduler/bootstrap/app-bootstrap-feature.js`
- `src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/planner/**`（F 负责）
- 禁止修改：`src/frontend/common/micro-service/**`（G 负责）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 交付物（必须提交到 git）
- ≥1 条 Jest 回归测试：在 jsdom + FakeWebSocket 环境下断言 logger/notification 被调用（成功/失败路径至少覆盖一种）
- `report.md`（必须提交）：含 scope、lint/jest 结果、commit hash

## 验收标准（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-install-summary.contract.test.js -i` ✅
- git 提交：提供 **commit hash**，工作区干净

