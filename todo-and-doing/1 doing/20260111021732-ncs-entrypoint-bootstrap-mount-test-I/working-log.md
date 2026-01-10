# Working Log - 20260111021732-ncs-entrypoint-bootstrap-mount-test-I

## 目标
- 增加一条“从入口 index.js 触发”的 mount 回归测试，防止再次出现空白页。

## 交付
- Commit: （必填）

## 自检
- `pnpm -s run lint`：
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js -i`：

