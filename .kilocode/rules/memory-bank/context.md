# Memory Bank（精简版 / 权威）

## 总体目标
- 前端（pdf-home、pdf-viewer）为纯 UI 模块，复用共享基础设施（EventBus / Logger / WSClient），仅在必要时通过 QWebChannel 与 Python 通信。
- 后端分三类：WebSocket 转发器（仅收发转发）、HTTP 文件服务器（仅文件传输）、PDF 业务服务器（独立、接收指令执行业务）。
- 日志分层：前端控制台经 DevTools 捕获写入 UTF-8 文件；后端统一用 Python logging（文件覆盖写，UTF-8）。
- AI Launcher 模块化：服务短小、可 start/stop/status，模块可独立运行与测试。

## 统一规范
- 目录命名：统一 kebab-case（示例：`pdf-home` / `pdf-viewer`），禁止 `pdf_home`。
- 文件 I/O：所有读写显式 UTF-8；确保换行 `\n` 正确。
- 前端依赖：统一使用 `src/frontend/common/*`（EventBus / Logger / WSClient）。

## 模块职责
- pdf-home：列表/选择/动作的 UI；QWebChannel 前端侧管理；前端日志 → `logs/pdf-home-js.log`。
- pdf-viewer：渲染与控件 UI；按 pdf_id 输出日志 → `logs/pdf-viewer-<pdf-id>-js.log`。
- WebSocket 转发器：`src/backend/websocket/standard_server.py`（headless，仅路由）。
- HTTP 文件服务器：`src/backend/http_server.py`（仅文件传输，支持 Range，UTF-8 日志）。
- PDF 业务服务器（待实现）：`src/backend/services/pdf_business_server.py`（建议路径）。
- AI Launcher：`ai-scripts/ai_launcher/*`（ServiceManager / ProcessManager / CLI / 示例服务）。

## 现状（快照）
- 已完成：
  - 命名清理（统一 kebab-case）；前端日志捕获（pdf-home、pdf-viewer 按 pdf_id）。
  - pdf-viewer UI 私有字段使用修复（以 `#elements/#state` 为中心）。
  - HTTP 文件服务器可独立运行；AI Launcher 模块化骨架就绪。
- 待办：
  - 实现最小版 PDF 业务服务器并接入 WS 转发。
  - 复核 pdf-viewer 全量对齐共享 EventBus/WSClient。
  - 为 Launcher 增加健康检查与 E2E 脚本。

## 验证要点
- 前端：独立 launcher 运行成功；前端日志文件生成且为 UTF-8。
- 后端：WS 转发 echo/路由可用；HTTP 文件服健康检查与 Range 请求通过。
- Launcher：服务 start/stop/status 正常。


# 细节规划 
## pdf-home模块与 pdf-viewer模块的公共特点
- 目录：`src/frontend/pdf-home`
架构: pyqt+qwebengine+js
pyqt层:
  - QWebChannel通信
  - 前端日志捕获（Logger）
  - 前端事件总线（EventBus）
  - WebSocket客户端（WSClient）
