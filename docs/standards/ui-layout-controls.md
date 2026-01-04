# UILayoutControls（pdf-viewer 布局/交互控件）说明

目标：将 `src/frontend/pdf-viewer/features/infra-ui/components/ui-layout-controls.js` 控制在 ≤500 行，并把详细说明外移到文档。

## 职责
- 装配/管理 UI 控件：滚动模式、跨页模式、旋转、鼠标模式（文本/拖拽）。
- 通过 `PDF_VIEWER_EVENTS` 与其他模块交互，避免直接跨 Feature 调用内部实现。

## 关键文件
- 实现：`src/frontend/pdf-viewer/features/infra-ui/components/ui-layout-controls.js`
- 事件常量：`src/frontend/common/event/pdf-viewer-constants.js`

