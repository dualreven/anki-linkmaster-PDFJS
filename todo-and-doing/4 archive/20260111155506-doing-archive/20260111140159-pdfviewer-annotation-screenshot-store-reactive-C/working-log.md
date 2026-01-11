# 20260111140159-pdfviewer-annotation-screenshot-store-reactive-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 14:01
### 工作内容:
- 初始化任务，确认 ScreenshotTool 当前渲染/订阅路径，设计 store-reactive 改造与回归测试。
### 工作步骤:
1. 阅读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与测试清理规范
2. 仅在 `src/frontend/pdf-viewer/features/pdf-annotation/**` 内定位 ScreenshotTool 相关代码
3. 先写回归测试，再推进 store-reactive
4. 跑 `pnpm -s run lint` 与定向 Jest
### 工作结果:
- 已完成（2026-01-11 15:12）：
  - ScreenshotTool：将 pagerendered / RENDER.PAGE_COMPLETED / scale 相关路径收敛为“刷新信号”，不再绕过 storeReactiveMarkers 直接渲染 marker。
  - storeReactiveMarkers：新增 `invalidateAll()` / `invalidatePage(pageNumber)`，用于页面重绘/缩放时强制重算（但仍以 store snapshot 为真源）。
  - markerQueue：新增 `clearPendingForPage(pageNumber)`，页面就绪后仅清空 pending；渲染统一由 storeReactiveMarkers 触发。
  - 回归测试：增强 `screenshot-tool.store-diff.regression.test.js`，覆盖 destroy 后 store/event/pdfjs listener 均正确卸载，且后续 store.set 不再触发渲染。
  - Lint：`pnpm -s run lint` ✅
  - Jest：`pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/screenshot-tool.store-diff.regression.test.js -i` ✅
  - Commit：`f1189dee`
### 存在问题:
- 无
### 下一步计划:
- 如需手工点检：缩放/翻页/刷新后截图 marker 是否能稳定恢复（store 未变更时也能重绘）。
