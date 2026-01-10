# New Card Scheduler - WS 默认 host 统一 IPv4（main createApp）

**功能ID**: 20260111021732-ncs-ws-host-ipv4-main-H  
**优先级**: P1（统一默认连接行为，避免 localhost 解析差异）  
**版本**: v001  
**创建时间**: 2026-01-11 02:17  
**状态**: doing  

## 背景
- `src/frontend/new-card-scheduler/main.js` 的 `createNewCardSchedulerAppOrThrow` 在 `wsUrl` 缺省时会拼接 `ws://localhost:<port>`。
- 为与既有 loopback 策略一致，应统一默认 host 为 `127.0.0.1`。

## 需求 / 交付
- 将 `createNewCardSchedulerAppOrThrow` 的默认 `resolvedWsUrl` 从 `ws://localhost:<port>` 改为 `ws://127.0.0.1:<port>`（仅影响 wsUrl 缺省路径）。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/main.js`
- 新增测试：`src/frontend/new-card-scheduler/__tests__/main-ws-host.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.js`（F 负责）
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`features/**`（G 负责）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 回归测试建议（DoD 必须满足）
- 采用“读文件 + 断言默认 URL 不再包含 ws://localhost:”的契约方式即可。

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- `pnpm -s run lint` 必须通过。
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/main-ws-host.contract.test.js -i` 必须通过。

