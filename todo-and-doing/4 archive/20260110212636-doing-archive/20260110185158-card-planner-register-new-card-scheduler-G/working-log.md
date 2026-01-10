# 20260110185158-card-planner-register-new-card-scheduler-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 18:51
### 工作内容:
-（待执行）为 new-card-scheduler 增加 MsgCenter 注册（新协议），修复 Step3 pending-forward 不 flush。
### 工作步骤:
1) 新增 ws-registration wiring：连接建立后发送 `client:register:requested`
2) main.js 安装 wiring（避免堆逻辑）
3) Jest：断言注册消息结构与 no-`to`
### 工作结果:
-（待执行）
### 存在问题:
-（待执行）
### 下一步计划:
-（待执行）提交 commit hash + 测试命令

## 工作记录2
**时间**: 2026-01-10 19:31:58
### 工作内容:
- new-card-scheduler 在 WS 连接建立后自动向 MsgCenter 注册（新协议），并在 UI 显示 reg 状态与错误信息（不静默）。
### 工作步骤:
1) 新增 `wiring/ws-registration.js`：订阅 `WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED` 发送 `client:register:requested`（不带 `to`）
2) 监听 `client:register:completed|failed`（按 request_id 匹配），失败 toast + logger.error
3) `ui/ws-status-panel.js` 增加 `reg=unknown|registering|ok|failed` 与 `reg_error=...`
4) `main.js` 安装 registration wiring，并把 reg 状态写入状态面板
5) 跑 lint + Jest（by path）
### 工作结果:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/ws-registration.contract.test.js -i` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js -i` ✅
### 存在问题:
- 无
### 下一步计划:
- 手工点检：打开 `http://localhost:3000/new-card-scheduler/`，应看到 `ws=connected` 且 `reg=ok`；再做 gui_launcher 注入应能 forwarded/自动 flush。
