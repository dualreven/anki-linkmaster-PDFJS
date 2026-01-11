# Working Log - 20260111144355-feature-context-eventbus-alias-G

## 目标
- FeatureContext 增加 `eventBus` 别名（= `globalEventBus`），并补回归测试。

## 交付
- Commit: `92874a2d`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/common/micro-service/__tests__/feature-context.eventbus-alias.test.js -i`：✅
