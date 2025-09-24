# 系统架构（清理版）

本文件记录当前权威的分层架构与模块职责，过时内容已移除。

## 分层与边界
- 前端（pdf-home、pdf-viewer）：纯 UI，使用共享基础设施（EventBus/Logger/WSClient），可用 QWebChannel 进行必要桥接。
- 后端：
  - WebSocket 转发器（headless）：仅负责消息收发与路由；不包含 UI。
  - HTTP 文件服务器：仅负责 PDF 文件/静态内容传输，支持 Range、UTF-8 日志。
  - PDF 业务服务器：独立模块（待实现），接收 WS 指令执行业务逻辑并应答。
- 日志：前端经 DevTools 捕获到 UTF-8 日志文件；后端统一 Python logging。
- 启动：AI Launcher 模块化，服务皆可独立运行与测试。

## 命名与 IO 规范
- 目录用 kebab-case（如 `pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 所有文件读写必须显式 UTF-8，且确保换行 `\n` 正确。

## 前端关键实现
- pdf-home：`src/frontend/pdf-home/*`（容器、QWebChannel 管理、前端日志捕获到 `logs/pdf-home-js.log`）。
- pdf-viewer：`src/frontend/pdf-viewer/*`（`ui-manager-core.js` 以 `#elements/#state` 为中心；按 `pdf_id` 输出 `logs/pdf-viewer-<pdf-id>-js.log`）。

## 后端关键实现
- WebSocket 转发器：`src/backend/websocket/standard_server.py`。
- HTTP 文件服务器：`src/backend/http_server.py`。
- PDF 业务服务器：`src/backend/services/pdf_business_server.py`（预留路径，待实现）。

## AI Launcher（模块化）
- 位置：`ai-scripts/ai_launcher/*`
- 组成：ServiceManager / ProcessManager / CLI / 示例服务（ws-forwarder、pdf-file-server、npm-dev-server）。

## 下一步
1) 实现 PDF 业务服务器最小可用版本并接入 WS 转发。
2) 校验 pdf-viewer 完整对齐共享 EventBus/WSClient 的模式。
3) 为 AI Launcher 增加健康检查与 E2E 脚本。

