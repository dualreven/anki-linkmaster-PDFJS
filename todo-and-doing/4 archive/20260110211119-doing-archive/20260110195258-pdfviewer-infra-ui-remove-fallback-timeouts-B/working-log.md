# 20260110195258-pdfviewer-infra-ui-remove-fallback-timeouts-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：移除 filename→pdfId 兜底；移除 setTimeout 竞态初始化，改为事件驱动且可清理。
### 下一步计划:
1. 定位兜底逻辑与 setTimeout 触发点
2. 选取替代事件（`RENDER.READY`/`RENDER.PAGE_COMPLETED`）并实现一次性初始化
3. 补回归测试（Fail-Fast + 无时间窗依赖）
4. 提交 commit + 记录验收命令

## 工作记录2
**时间**: 2026-01-10 20:34:02
### 工作内容:
- 移除 `onZoomChanged` 的 filename→pdfId 兜底推断：缺失 pdfId 时改为显式 `logger.error`（Fail-Fast，不再隐式写入）。
- 移除 `onFileLoadSuccess` 的 `setTimeout(..., 100)` 初始化：改为 `RENDER.READY` 一次性初始化 page info（无时间窗依赖）。
- 删除 `PDFViewerManager.load()` 内的调试 `setTimeout(..., 2000)`，消除竞态来源。
- 新增回归测试：兜底被禁止 + 初始化不使用 setTimeout 且由 RENDER.READY 驱动。

### 验收:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/__tests__/event-listeners.remove-fallback-and-init-with-render-ready.test.js -i` ✅

### 下一步计划:
- 已合入 main：`7f77cba5`（代码+测试）、`e8eeeb01`（working-log）
