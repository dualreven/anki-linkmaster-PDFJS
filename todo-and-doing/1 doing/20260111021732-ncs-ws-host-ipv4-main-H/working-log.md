# Working Log - 20260111021732-ncs-ws-host-ipv4-main-H

## 目标
- main createApp 默认 WS host 从 `localhost` 统一到 `127.0.0.1`。

## 交付
- Commit: `1f9a140b`

## 自检
- `pnpm -s run lint`：✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/main-ws-host.contract.test.js -i`：✅
