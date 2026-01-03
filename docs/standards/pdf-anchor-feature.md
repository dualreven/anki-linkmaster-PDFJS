# pdf-viewer：PDFAnchorFeature（面条治理拆分说明）

## 目标
- 将 `src/frontend/pdf-viewer/features/pdf-anchor/index.js` 收敛为“生命周期 + 装配 + 少量薄封装”，单文件 ≤500 行。
- 保持对外导出与行为不变：`export class PDFAnchorFeature` + `export default PDFAnchorFeature`。
- 事件名继续严格使用 `PDF_VIEWER_EVENTS` / `WEBSOCKET_MESSAGE_EVENTS` 常量引用。

## 拆分后的文件（职责）
- `src/frontend/pdf-viewer/features/pdf-anchor/index.js`
  - Feature 装配：安装/卸载、侧边栏 UI 注册、事件监听安装、PositionTracker 装配、少量 wrapper。
- `src/frontend/pdf-viewer/features/pdf-anchor/anchor-event-listeners.js`
  - `#setupEventListeners` 外移：锚点 CRUD/激活/导航请求/WS 错误提示等事件处理。
- `src/frontend/pdf-viewer/features/pdf-anchor/anchor-navigation.js`
  - `navigateToAnchor` 外移：通过 `PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED` 触发受控跳转，并在跳转时发出 `ANCHOR.ACTIVATE`。
- `src/frontend/pdf-viewer/features/pdf-anchor/anchor-position-tracker.js`
  - PositionTracker 装配与写回：仅在存在激活锚点时写回；1 秒节流；导航后冻结 3 秒（由调用方触发 freeze）。
- `src/frontend/pdf-viewer/features/pdf-anchor/anchor-utils.js`
  - 纯逻辑工具：时间格式（HH:MM）、position 百分比/存储值归一化等。

## 测试
- 新增：`src/frontend/pdf-viewer/features/pdf-anchor/__tests__/anchor-utils.test.js`
- 既有回归（保持通过）：`src/frontend/pdf-viewer/features/pdf-anchor/__tests__/*.test.js` 与 `components/__tests__/*.test.js`

