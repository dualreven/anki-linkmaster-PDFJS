# Report：20260111140159-pdfviewer-adapters-inbound-router-slim-A

## 交付信息
- Owner: A
- Commit: `69a2f975`
- Scope: `src/frontend/pdf-viewer/adapters/**`

## 改动清单
- `src/frontend/pdf-viewer/adapters/websocket-adapter.js`
- `src/frontend/pdf-viewer/adapters/ws-inbound-bridge.js`
- `src/frontend/pdf-viewer/adapters/ws-inbound-domain-handlers.js`
- `src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.inbound-uninstall.regression.test.js`

## 门禁与测试
- Lint: `pnpm -s run lint`（结果：✅）
  - `[memory-bank] OK (lines=177)`
  - `[frontend-line-limit] OK`
  - `[feature-internal-eventbus-gates] OK`
  - `[pdfviewer-global-listener-gates] OK`
  - `[pdfviewer-no-eventbus-on-in-components] OK`
- Jest: `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.inbound-uninstall.regression.test.js -i`（结果：✅）
  - `PASS src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.inbound-uninstall.regression.test.js`
  - 注：提示 `baseline-browser-mapping` 过旧（非本任务范围，不影响通过）

## 说明
- 是否需要手工点检：否（纯 adapters 路由拆分 + 卸载契约回归测试）
- 风险点：低；主要风险为入站 handlers 装配顺序变动（已由回归测试覆盖“卸载后不再处理入站消息”）。
