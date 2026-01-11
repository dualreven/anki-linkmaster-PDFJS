# Report - 20260111144355-feature-context-eventbus-alias-G

## Scope
- 修改：`src/frontend/common/micro-service/feature-registry-context.js`
- 新增测试：`src/frontend/common/micro-service/__tests__/feature-context.eventbus-alias.test.js`

## Commands & Results
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/common/micro-service/__tests__/feature-context.eventbus-alias.test.js -i`：✅

## Deliverable
- Commit: `92874a2d`
- 主要变更点：FeatureContext 在 `globalEventBus` 存在时新增只读别名 `eventBus`（同一引用）；并加回归测试覆盖 alias + 只读 + 缺失时不兜底。
