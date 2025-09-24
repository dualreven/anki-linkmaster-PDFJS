# 技术规范（清理版）

本文件汇总当前权威的技术与使用规范，过时内容已清理。

## 命名规范
- 目录统一使用 kebab-case：示例 `pdf-home`、`pdf-viewer`。
- 禁止使用 `pdf_home`（snake_case）。

## 文件 I/O 规范
- 所有文件读写必须显式指定 UTF-8 编码（Python `encoding='utf-8'`；PowerShell `-Encoding UTF8`）。
- 确保换行 `\n` 正确；按会话覆盖写场景使用 `mode='w'`。

## 前端日志规范
- 通过 QtWebEngine 远端调试（DevTools）捕获前端控制台：
  - pdf-home：写入 `logs/pdf-home-js.log`
  - pdf-viewer：写入 `logs/pdf-viewer-<pdf-id>-js.log`
- JS 层可使用共享 Logger 输出到控制台；由 Python 捕获程序写入日志（UTF-8）。

## 后端日志规范
- 统一使用 Python `logging`，显式 UTF-8；必要时采用覆盖写并确保行尾正确。

## 前端基础设施
- 统一依赖 `src/frontend/common/*`：
  - `event/event-bus.js`
  - `utils/logger.js`
  - `ws/ws-client.js`
- QWebChannel 逻辑由前端管理（如 `src/frontend/pdf-home/qwebchannel-manager.js`）。

## 启动与编排（AI Launcher）
- 模块化服务管理：
  - `ai-scripts/ai_launcher/core/service_manager.py`
  - `ai-scripts/ai_launcher/core/process_manager.py`
  - `ai-scripts/ai_launcher/cli/command_parser.py`
- 示例服务：
  - `services/persistent/ws_service.py`：WebSocket 转发器
  - `services/persistent/pdf_service.py`：HTTP 文件服务器
  - `services/persistent/npm_service.py`：Vite 开发服务器
- 示例入口：`ai-scripts/ai_launcher/example_run.py`（支持 `start/stop/status`）

## 测试与可运行性
- 每个模块需提供独立运行与最小验证路径：
  - 前端应用：独立 launcher + 日志文件检查。
  - WebSocket 转发：指令回环/路由测试。
  - HTTP 文件服：健康检查 + Range 请求测试。
  - Launcher：服务 `start/stop/status` 冒烟测试。

