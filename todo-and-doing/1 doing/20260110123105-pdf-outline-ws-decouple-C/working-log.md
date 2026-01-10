# 20260110123105-pdf-outline-ws-decouple-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:31:05
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写“UI 不直连 WEBSOCKET_EVENTS”的最小回归测试
2. 把 WS 消费迁移到 Manager/Adapter，UI 订阅领域事件/store
3. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 14:55:20
### 工作内容:
- 完成 `pdf-outline` 去 WS 直连：WS 入站仅在 adapter/bridge 消费并转为 `PDF_VIEWER_EVENTS.OUTLINE.LOAD.*`；UI/Feature 仅消费领域事件与 `OutlineManager`。
- 补齐回归测试并通过门禁，提交到 `worker/refactor-C`。
### 工作步骤:
1. 修改 `ws-inbound-bridge`：将 `OUTLINE_LIST_COMPLETED(null)` 桥接为 `OUTLINE.LOAD.EMPTY`；将 `OUTLINE_LIST_FAILED` 桥接为 `OUTLINE.LOAD.FAILED`；并补齐列表归一化逻辑。
2. 修改 `pdf-outline`：移除 `WEBSOCKET_EVENTS` 入站订阅，改订阅 `OUTLINE.LOAD.*`；init flow 改为等待领域事件。
3. 新增回归测试：`OutlineFeature` 初始化不订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`；并统一修复本目录测试为“安装入站桥接（模拟 WebSocketAdapter）”。
4. 自验门禁：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <pdf-outline/__tests__/*.test.js> -i`
5. 提交：`git commit -m "refactor(pdf-outline): decouple ws inbound via bridge"`
### 工作结果:
- ✅ Lint：通过（`pnpm -s run lint`）
- ✅ Jest：通过（16 suites / 26 tests）
- ✅ Commit：`1bd8760`（branch：`worker/refactor-C`）
### 下一步计划:
- 由主分支侧按计划合入；如需我继续处理相邻任务（A/D/E），请继续下发。
