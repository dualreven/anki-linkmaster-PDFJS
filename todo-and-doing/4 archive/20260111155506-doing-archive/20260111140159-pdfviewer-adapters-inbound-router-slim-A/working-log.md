# 20260111140159-pdfviewer-adapters-inbound-router-slim-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 14:01
### 工作内容:
- 初始化任务，阅读规范与现状代码，列出拟改动文件与测试路径。
### 工作步骤:
1. 阅读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 及相关规范条目
2. 仅在 `src/frontend/pdf-viewer/adapters/**` 内定位入站路由/订阅点
3. 先写回归测试，再做重构与对称卸载
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- 入站路由收敛：将 outline/anchor 域入站 handlers 从 `ws-inbound-bridge.js` 抽离到独立文件，bridge 保持单入口装配执行。
- 生命周期对称：`WebSocketAdapter.destroy()` 增补清理 inbound destroySignal 绑定；并提供 `install()/uninstall()` 语义别名。
- 防回归测试：新增 `destroy` 后不再处理 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED` 的回归用例。
### 存在问题:
- Jest 输出提示 `baseline-browser-mapping` 数据过旧（非本任务范围，不影响用例通过）。
### 下一步计划:
- 无。
