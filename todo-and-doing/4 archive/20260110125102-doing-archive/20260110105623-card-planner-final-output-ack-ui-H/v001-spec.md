# [card-planner][H] 新卡片规划器：Final Output 回执可见性（显示 completed/failed）

**功能ID**: 20260110105623-card-planner-final-output-ack-ui-H  
**优先级**: 高（人工验收可见性）  
**版本**: v001  
**创建时间**: 2026-01-10 10:56:23  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-H`）

## 背景
当前 UI 已有“发射最终制卡信息”按钮，但：
- 发射时未显式携带 `request_id`（无法和回执关联）；
- UI 未订阅 `card-planner:final-output:completed/failed`，人工无法确认后端是否已接收与校验通过。

## 目标
1) 发射 `card-planner:final-output:requested` 时显式携带 `request_id` + `timestamp`；
2) UI 订阅回执：
   - `card-planner:final-output:completed`：toast 成功（显示 count 或 message）
   - `card-planner:final-output:failed`：toast 失败（显示错误原因）
3) 必须新增回归测试，覆盖“发射 + 收到回执”的可见性链路。

## 约束
- 仅修改：`src/frontend/new-card-scheduler/**`
- Fail-Fast：缺失 eventBus/wsClient/notification 必须抛错或明确报错，不得静默吞掉。
- 不改变 `docs/contracts/card-planner.md` 已固定的 payload 结构（只补齐 request_id/timestamp 与 UI 反馈）。

## 建议实现（可调整，DoD 不变）
### 1) 发射时携带 request_id
在 `src/frontend/new-card-scheduler/planner/app.js` 的 `mountFinalOutputButton` 中：
- 生成 `request_id`（可复用 `src/frontend/common/ws/ws-client-requests.js::generateRequestId()` 或自建同等规则）
- `wsClient.send({ type, request_id, timestamp, data })`

### 2) 订阅回执并显示
在 `createCardPlannerApp` 内用 `eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, ...)` 监听：
- 若 `type` 属于 final-output 回执集合且 `request_id` 命中本次发射的 rid：
  - completed：`notification.showInfo(...)`
  - failed：`notification.showError(...)`

注意：
- 只处理“自己发射的 rid”，避免误报。
- `dispose()` 时必须解除订阅（防泄漏）。

## 必须新增回归测试（至少 1 条）
建议 Jest 新增文件：
- `src/frontend/new-card-scheduler/__tests__/card-planner.final-output.ack.contract.test.js`

覆盖点（至少两项）：
1) 点击按钮后，`wsClient.send` 中包含 `request_id` 与正确 `type/data`；
2) 模拟收到 `card-planner:final-output:completed/failed`（同 rid）后，调用 `notification.showInfo/showError`。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <你新增/修改的测试路径> -i` ✅
- 手工点检：打开 `http://localhost:3000/new-card-scheduler/`，点击“发射最终制卡信息”，应看到成功/失败 toast（取决于后端回执）。

