# 20260110175029-infra-ui-coordinator-slim-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:50:29
### 工作内容:
- 拆分 `infra-ui-coordinator.js` 并补一条 uninstall 清理回归测试。
### 工作步骤:
1. 梳理 coordinator 当前订阅清单（按领域分组）
2. 抽出 subscriptions 子模块并保持行为不变
3. 新增/更新 Jest 回归测试覆盖 uninstall 清理
### 工作结果:
- 待开始
### 存在问题:
- 待开始
### 下一步计划:
- 实现并提交（附测试路径）

## 工作记录2
**时间**: 2026-01-10 18:22:56
### 工作内容:
- coordinator 拆分为多个 subscriptions installer（按领域分组），coordinator 只负责编排与统一 cleanup。
- 新增回归测试：destroy 后所有订阅的 unsubscribe 都被调用（覆盖 uninstall 清理）。

### 验收:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/__tests__/infra-ui-coordinator.uninstall-cleans-subscriptions.test.js -i` ✅

### 下一步计划:
- 提交 commit 并回报 hash
