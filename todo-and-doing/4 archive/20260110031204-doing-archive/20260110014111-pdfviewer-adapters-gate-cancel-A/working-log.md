# 20260110014111-pdfviewer-adapters-gate-cancel-A 工作日志
**参考标准**: v001-spec.md

## 2026-01-10 01:41
### 工作内容
- 任务下发（待 A 开工）。
### 下一步计划
- A：先写回归测试，再做最小改造并确保 lint/jest 通过。

## 2026-01-10 02:35
### 工作内容
- 修复 adapters gate/destroy 竞态：destroy 后可取消 gate 等待，且不再产生业务副作用/残留定时器。
- 补 1 条最小回归测试：gate 等待中 destroy 不发回执、不触发导航。

### 工作步骤
1. 新增可取消 gate runner（AbortSignal）并接入 `VIEWER_NAVIGATE_REQUESTED` gate 等待路径。
2. `WebSocketAdapter.destroy()` 触发 abort，取消 gate 等待并清理订阅/定时器。
3. 修复入站消息重复处理导致的重复订阅（移除重复调用）。
4. 跑 lint 与 jest（按路径）。

### 工作结果
- 新增：`src/frontend/pdf-viewer/adapters/ws-gate-runner-cancellable.js`
- 新增：`src/frontend/pdf-viewer/adapters/ws-inbound-destroy-signal.js`
- 新增：`src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.gate-destroy.regression.test.js`
- 修改：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`
- 修改：`src/frontend/pdf-viewer/adapters/ws-inbound-bridge.js`
- 修改：`src/frontend/pdf-viewer/adapters/ws-inbound-handlers.js`

### 验收
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.gate-destroy.regression.test.js -i` ✅

### 交付信息
- main 合入：`8f56a12`
