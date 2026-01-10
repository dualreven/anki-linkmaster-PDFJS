# Working Log - 20260111021732-ncs-ws-host-ipv4-legacy-feature-G

## 目标
- legacy feature 默认 WS host 从 `localhost` 统一到 `127.0.0.1`，提升注册稳定性。

## 交付
- Commit: `（待填写）`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/legacy-ws-host.contract.test.js -i`：✅
