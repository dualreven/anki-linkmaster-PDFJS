# 20260110195258-pdfviewer-annotation-commenttool-store-reactive-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：CommentTool overlay 改为 store-reactive，去除对 `DATA.LOADED` 的硬依赖。
### 下一步计划:
1. 梳理 CommentTool 当前 overlay 恢复链路（DATA.LOADED/page rendered 等）
2. 接入 AnnotationManager.store 订阅并实现 overlay diff/恢复
3. 补回归测试：store 更新即可恢复 overlays
4. 提交 commit + 记录验收命令

## 工作记录2
**时间**: 2026-01-10 20:33:30
### 工作内容:
- 完成 CommentTool store-reactive：marker 恢复/更新完全由 `annotationManager.store` 驱动；移除对 `ANNOTATION.DATA.LOADED` 的硬依赖与渲染型 CRUD 监听。
### 工作步骤:
1. 移除 `CommentTool` 内 `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED` 订阅。
2. 引入 store 订阅（Fail-Fast：`annotationManager.store.subscribe` 必须存在且必须返回 unsub）。
3. 实现 comment markers 的 store diff：
   - store 移除 comment → `commentMarker.removeMarker` + 从 pending 队列移除
   - store 新增/更新 comment → 强制重建 marker 并 `ensureOverlayFor`（避免“已挂载则跳过”导致更新不同步）
4. 新增回归测试：不触发 `DATA.LOADED`，仅 store 更新即可渲染/移除 `.comment-marker`。
5. 自验门禁：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool.store-reactive.test.js src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool-destroy-unsubscribe.test.js -i`
6. 提交：`refactor(comment-tool): make marker rendering store-reactive`
### 工作结果:
- ✅ Lint：通过（`pnpm -s run lint`）
- ✅ Jest：通过（2 suites / 2 tests）
- ✅ Commit：`504944f0`（`worker/refactor-C`）
### 关键文件:
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-store-reactive.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool.store-reactive.test.js`
