# New Card Scheduler - 入口联动回归测试（从 index.js 触发 mount）

**功能ID**: 20260111021732-ncs-entrypoint-bootstrap-mount-test-I  
**优先级**: P1（为 P0 修复提供更强防回归）  
**版本**: v001  
**创建时间**: 2026-01-11 02:17  
**状态**: doing  

## 需求 / 交付
- 新增一条“更贴近真实启动”的契约测试：
  - 在 jsdom 构造 `index.html` 所需关键 DOM（toolbar/sidebar/workspace 等）
  - stub `globalThis.WebSocket`（参考现有 `bootstrap-runner.contract.test.js` 的 `FakeWebSocket`）
  - `import("src/frontend/new-card-scheduler/index.js")` 后，应能把 planner UI mount 到 `#planner-workspace`（至少 `childElementCount > 0`）

## 约束（隔离 scope，禁止重叠）
### 允许新增（仅限）
- 新增测试：`src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/index.js`（F 修复）
- 禁止修改：`src/frontend/new-card-scheduler/bootstrap/**`、`features/**`、`main.js`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- `pnpm -s run lint` 必须通过。
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js -i` 必须通过。

