# 20260110123105-infra-nav-navigation-service-cleanup-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:31:05
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 destroy 清理的最小回归测试（eventBus off + timers cancel）
2. 重构 NavigationService：bind/unbind 成对；waitForPageReady 可取消
3. 确保 uninstall/destroy 路径对称且 fail-fast
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 12:47
### 工作内容:
- 新增最小回归测试：锁定 `NavigationService.destroy()` 的订阅清理与 `waitForPageReady` 定时器取消（destroy 后不再触发异步回调）。

### 工作步骤:
1. 新增回归测试：`src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.navigation-service-cleanup.regression.test.js`
2. 用 spy 断言 destroy 会调用所有 unsubscribe，并且 destroy 后 `jest.getTimerCount()` 为 0
3. 自验：跑 lint 与 jest（按路径）

### 工作结果:
- 提交：`2e2471d` `test(infra-nav-core): regression for NavigationService destroy cleanup`
- 验收：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.navigation-service-cleanup.regression.test.js -i` ✅

### 存在问题:
- Jest 提示 `baseline-browser-mapping` 数据过旧（非本任务范围，不影响测试通过）。

### 下一步计划:
- main 侧 cherry-pick `2e2471d`。
