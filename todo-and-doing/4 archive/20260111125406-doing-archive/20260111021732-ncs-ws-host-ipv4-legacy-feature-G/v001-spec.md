# New Card Scheduler - WS 默认 host 统一 IPv4（legacy feature）

**功能ID**: 20260111021732-ncs-ws-host-ipv4-legacy-feature-G  
**优先级**: P1（提升注册稳定性，避免 localhost IPv6/IPv4 解析差异）  
**版本**: v001  
**创建时间**: 2026-01-11 02:17  
**状态**: doing  

## 背景
- 近期已出现 `localhost` 在 Windows/QtWebEngine 下 IPv4/IPv6 解析不稳定导致连接失败的问题（Vite 侧已统一 `127.0.0.1`）。
- 新卡片规划器窗口侧 WS 默认仍使用 `ws://localhost:<port>`，可能导致连接失败，从而无法注册，进而出现 `pending-forward`。

## 需求 / 交付
- 将 new-card-scheduler legacy feature 的 WS 默认 URL 从 `ws://localhost:<port>` 统一为 `ws://127.0.0.1:<port>`。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/features/legacy/legacy-feature.js`
- 新增测试：`src/frontend/new-card-scheduler/__tests__/legacy-ws-host.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.js`（F 负责）
- 禁止修改：`src/frontend/new-card-scheduler/main.js`（H 负责）
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 回归测试建议（DoD 必须满足）
- `legacy-ws-host.contract.test.js` 采用“读文件 + 断言不包含 ws://localhost:”的契约方式即可（避免引入复杂 mock）。

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- `pnpm -s run lint` 必须通过。
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/legacy-ws-host.contract.test.js -i` 必须通过。

