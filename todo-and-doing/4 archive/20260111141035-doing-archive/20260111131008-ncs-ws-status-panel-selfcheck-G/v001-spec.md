# NCS - WS 状态面板增加“自检/刷新”能力（可观测性）

**功能ID**: 20260111131008-ncs-ws-status-panel-selfcheck-G  
**优先级**: P1（提升排障效率，避免“看起来没注册”但缺乏证据）  
**版本**: v001  
**创建时间**: 2026-01-11 13:10  
**状态**: doing  

## 需求 / 交付
在新卡片规划器顶部 WS 状态面板（`mountWsStatusPanelOrThrow`）新增“自检/刷新”能力：
1) UI 增加一个轻量按钮（如 `刷新` / `自检`），点击后：
   - `eventBus.emit(WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST, ...)` 发起状态请求
2) 面板监听 `WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE`：
   - 渲染至少 3 个字段：`url`、`readyState`、`reconnectAttempts`
3) Fail-fast：收到非预期 payload 时应抛错或明确记录（不要静默吞错）。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/ui/ws-status-panel.js`
- 修改/新增测试：`src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/features/**`、`src/frontend/new-card-scheduler/planner/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 测试建议（DoD 必须满足）
- `pnpm -s run lint`
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js -i`
  - 断言：点击按钮会 emit STATUS.REQUEST
  - 断言：收到 STATUS.RESPONSE 后 DOM 文本包含 url/readyState/reconnectAttempts

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- 必须补回归测试。

