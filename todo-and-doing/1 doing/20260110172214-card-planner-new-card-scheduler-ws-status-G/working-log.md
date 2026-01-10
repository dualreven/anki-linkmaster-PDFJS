# 20260110172214-card-planner-new-card-scheduler-ws-status-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:22
### 工作内容:
-（待执行）在新卡片规划器窗口中显示 WS 连接/注册状态，辅助排查注入竞态。
### 工作步骤:
1. （待执行）实现轻量状态组件并挂载到工具栏
2. （待执行）接入 WSClient 状态事件或补齐最小事件
3. （待执行）补齐 Jest 渲染测试
### 工作结果:
-（待执行）
### 存在问题:
-（待执行）
### 下一步计划:
-（待执行）提交 commit hash + 测试命令

## 工作记录2
**时间**: 2026-01-10 17:49:48
### 工作内容:
- 在 `new-card-scheduler` 顶部工具栏常驻显示 WS 状态（client_id + connecting/connected/failed/disconnected + error）。
### 工作步骤:
1) 新增轻量组件 `ui/ws-status-panel.js`，订阅 `WEBSOCKET_EVENTS.CONNECTION.*` 更新状态
2) 在 `main.js` 接入：连接前显示 `connecting`；连接失败不静默（面板展示 error）
3) 新增 Jest 回归 `ws-status-panel.contract.test.js` 覆盖 connected vs failed 文案与 error 可见性
### 工作结果:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js -i` ✅
- commit: `164b634`
### 存在问题:
- 无
### 下一步计划:
- 提交 commit hash；手工点检：打开 `http://localhost:3000/new-card-scheduler/` 查看右上角 `client_id` 与 `ws=` 状态。
