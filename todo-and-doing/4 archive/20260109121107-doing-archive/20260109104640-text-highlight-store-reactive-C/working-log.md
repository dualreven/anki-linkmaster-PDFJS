# 20260109104640-text-highlight-store-reactive-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-09 10:46:40
### 工作内容:
- 任务创建（C 负责）
### 工作步骤:
1. 先补测试（store 驱动 overlay）
2. 再移除 CRUD 事件订阅
3. 对齐 ScreenshotTool 的生命周期清理模式
### 工作结果:
- N/A

## 工作记录2
**时间**: 2026-01-09 11:31:31
### 工作内容:
- TextHighlightTool 改为 store-reactive（订阅 `AnnotationManager.store`），移除 CRUD 事件驱动 overlay。
### 工作步骤:
1. 更新回归测试：改为通过 store 更新触发 overlay 渲染/清理（不触发 `ANNOTATION.CREATED/DELETED/DATA.LOADED`）。
2. 实现 store 订阅：Tool `initialize()` 内 `store.subscribe(..., { fireImmediately: true })`，`destroy()` 内 unsubscribe。
3. OverlayController 新增 `applyAnnotationsSnapshot()`：对 snapshot 做 diff，驱动 overlay 增删改；并缓存按页数据用于翻页/缩放后恢复。
4. 移除 `event-subscriptions.js` 中对 `ANNOTATION.CREATED/UPDATED/DELETED/DATA.LOADED` 的订阅，仅保留交互与页面渲染时机订阅。
5. 验收：跑 Jest（本目录）与全仓库 lint。
### 工作结果:
- ✅ `pnpm exec jest src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight -i` 通过（4 suites / 12 tests）。
- ✅ `pnpm -s run lint` 通过。
