# Working Log - 20260111131008-ncs-legacy-feature-context-eventbus-F

## 目标
- 修复 `LegacyNewCardSchedulerFeature` 安装失败（context.eventBus 缺失），使 NCS legacy feature 可正常 install。

## 交付
- Commit: `2eb2c4e5`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/bootstrap-runner.install-legacy.contract.test.js -i`：✅
