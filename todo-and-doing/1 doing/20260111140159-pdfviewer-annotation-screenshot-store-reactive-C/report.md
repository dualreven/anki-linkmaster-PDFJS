# Report：20260111140159-pdfviewer-annotation-screenshot-store-reactive-C

## 交付信息
- Owner: C
- Commit: `f1189dee`
- Scope: `src/frontend/pdf-viewer/features/pdf-annotation/**`

## 改动清单
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/index.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/marker-queue.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/store-reactive-markers.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/screenshot-tool.store-diff.regression.test.js`

## 门禁与测试
- Lint: `pnpm -s run lint`（结果：✅）
- Jest: `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/screenshot-tool.store-diff.regression.test.js -i`（结果：✅）

## 说明
- 事件处理：保留 PDF.js/app 事件作为“刷新信号”，实际 marker 增删改渲染统一走 storeReactiveMarkers（避免绕过 store 的双驱动）。
- 卸载清理：回归测试覆盖 destroy 后 store unsubscribe、eventBus unsubscribe、pdfjs off 均触发；destroy 后 store.set 不再渲染/移除 marker。
- 环境提示：Jest 输出有 `baseline-browser-mapping` 过期提醒（非失败，不影响本任务门禁）。

