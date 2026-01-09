# pdf-annotation：TextHighlightTool 改为 store-reactive（去事件驱动 marker）

**功能ID**: 20260109104640-text-highlight-store-reactive-C  
**优先级**: 中（P1：与 screenshot 对齐，减少双驱动）  
**版本**: v001  
**创建时间**: 2026-01-09 10:46:40  
**状态**: 设计中

## 现状说明
- ScreenshotTool 已改为 store-reactive（主线已合入 main）。
- TextHighlightTool 仍有较多 CRUD 事件订阅来驱动渲染/清理。

## 提出需求
- TextHighlightTool 订阅 `AnnotationManager.store`，以 state diff 驱动高亮 overlay 的增删改。
- 移除对 `ANNOTATION.CREATED/DELETED/DATA.LOADED` 的依赖（UI/overlay 不靠事件闭环）。

## 约束条件
- 只允许修改：`src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/**`
- 允许新增/更新测试：同目录 `*.test.js`

## 可行验收标准
- `pnpm -s run lint`
- 至少 1 条回归测试：store 更新后 overlay 渲染/清理正确。

## 协作协议
- 提交到 `worker/refactor-C`，提供 commit hash。

