# 20260110040857-adapters-pdfid-provider-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 fail-fast 的最小回归测试（缺 provider/pdfId 直接 throw）
2. 引入 pdfIdProvider（或显式参数）并在边界 wiring 注入
3. 删除 adapters 内直接读 URL 的逻辑
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 10:54
### 工作内容:
- adapters 不再直接解析 URL 获取 pdfId，改为强制注入 `pdfIdProvider`（Fail-Fast）。
- 修复入站执行器上下文透传：`runWsInboundHandlers` 透传 `pdfIdProvider/viewerInstanceId` 等字段，保证入站 handler 可用。
- 新增/调整回归测试：未注入 provider 直接 throw；并将多条旧测试从“依赖 URL 参数”改为“依赖注入 provider”。

### 验收:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/adapters/__tests__/pdf-id-provider.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.pdfid-provider.failfast.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.outline-bridge.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.outline-null-guard.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.update-visited.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-failure-feedback.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-gate.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.gate-destroy.regression.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.anchor-create-missing-pdfid.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.anchor-navigate.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.negative-compat.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.contract.anchor.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-outline.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.anchor-emit-catch.test.js src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-annotation-anchor.test.js -i` ✅

### 工作结果:
- 已完成：commit `4bcf073f54d6403875806b5aac0e5eca8fc3ed35`（branch：`worker/refactor-C`）。
