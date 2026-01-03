# AnnotationManager（标注数据管理）说明

> 代码入口：`src/frontend/pdf-viewer/features/pdf-annotation/core/annotation-manager.js`

## 职责（高层）
- 接收 `PDF_VIEWER_EVENTS.ANNOTATION.*` 事件并完成 CRUD。
- 维护内存中的标注 Map（id → Annotation）。
- 负责持久化策略：mock 保存（无 wsClient / 未连接 / 缺少 pdfId）或远端保存（wsClient + pdfId）。

## 重要行为
- **全局 CREATE 事件**仅处理 `AnnotationType.TEXT_HIGHLIGHT`（来自 quick-actions）。
- **LOAD**：远端 list 失败必须触发 `LOAD_FAILED`（禁止静默 `LOADED(0)`）。
- **comment 兼容映射**：若缺少像素 `position` 但存在 `positionPercent`，在保存前尝试换算补齐 `position{x,y}`（避免后端校验拒绝）。

## 拆分（面条治理）
- `src/frontend/pdf-viewer/features/pdf-annotation/core/annotation-position-utils.js`：`computePositionFromPercent()`（纯逻辑，可单测）

