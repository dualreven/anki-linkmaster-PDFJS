# Working Log - 20260111021732-ncs-entrypoint-call-bootstrap-F

## 目标
- 修复新卡片规划器“只有基础布局、功能不可用/未注册”的入口问题：`index.js` 调用 bootstrap。

## 交付
- Commit: `d39174d3`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js -i`：✅
