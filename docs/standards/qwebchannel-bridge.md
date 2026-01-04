# QWebChannelBridge（pdf-home ↔ PyQt）说明

目标：将 `src/frontend/pdf-home/qwebchannel/qwebchannel-bridge.js` 控制在 ≤500 行，并把长注释/设计说明外移到文档。

## 职责
- 负责加载/初始化 `QWebChannel`（Hosted/QtWebEngine）。
- 对外提供 Promise 风格 API，并通过 `PDF_HOME_EVENTS` 与前端其他模块交互。

## 相关
- Qt 侧桥接对象名：通常为 `pyqtBridge`（以实际窗口注入为准）。
- 统一错误提示：走 `notifyDomainError`，避免 alert/confirm。

