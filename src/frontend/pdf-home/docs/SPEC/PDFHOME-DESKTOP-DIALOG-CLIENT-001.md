# PDF-Home 桌面对话框客户端规范

- **规范名称**: PDF-Home 桌面对话框客户端规范
- **规范编号**: PDFHOME-DESKTOP-DIALOG-CLIENT-001
- **版本**: 1.0
- **最后更新**: 2025-09-22
- **维护者**: AI-Assistant
- **引用规范**: WEBSOCKET-CLIENT-ROUTING-002, PDFHOME-WEBSOCKET-INTEGRATION-001, LOGGING-STANDARD-001

## 1. 作用范围
- 适用于 `pdf-home` 模块在桌面端 (PyQt) 运行时的 WebSocket 客户端实现。
- 管理与标准 WebSocket 服务器 (`ws://localhost:<port>`) 的握手、能力声明以及文件选择代理流程。
- 对应代码位置：`src/backend/app/pdf_home_dialog_client.py`（本次新增）。

## 2. 会话注册与握手
1. 客户端启动后必须在 `WebSocket.connected` 事件中发送 `client_register_request`：
   ```json
   {
     "type": "client_register_request",
     "timestamp": 1726950000000,
     "request_id": "register_<uuid>",
     "data": {
       "module": "pdf-home",
       "client_id": "pdf-home-<pid>-<random8>",
       "tags": ["ui", "file-dialog"],
       "capabilities": {"dialogs": true, "logging": false}
     }
   }
   ```
2. 若 1 秒内收到 `client_register_response`，需记录分配的 `client_id` 并输出 INFO 级日志。
3. 若收到 `client_register_timeout` 或连接断开，需要在 3 秒后自动重连并重新发送握手。
4. 断线重连应复用同一个 `client_id` 以便服务器清理旧会话。

## 3. 文件选择代理流程
1. 服务器推送 `file_selection_proxy_request` 时，客户端必须读取 `data.prompt` 与 `data.options` 并弹出 `QFileDialog`：
   - 默认目录：`options.initial_dir`，缺省则取用户主目录。
   - 是否多选：`options.multi`，默认允许多选。
2. 选择结果需原样返回本地文件绝对路径，无需在客户端写入 PDF 管理器。
3. 响应消息结构：
   ```json
   {
     "type": "file_selection_proxy_response",
     "timestamp": 1726950005000,
     "request_id": "proxy_req_123",        // 与服务器转发的 request_id 相同
     "data": {
       "selected_files": ["C:/docs/example.pdf"],
       "failed": [],
       "cancelled": false
     }
   }
   ```
4. 若用户取消或对话框无结果，`selected_files` 为空且 `cancelled` 设为 `true`。
5. 如果弹框过程中出现异常，需捕获并返回：
   ```json
   {
     "failed": [{"reason": "dialog_error", "message": "..."}]
   }
   ```
   同时将 `cancelled` 设为 `true`。

## 4. 重连与容错
- 默认启动自动重连，间隔 `3s`、指数退避上限 `15s`。
- 每次重新连接都需要重新发送握手，收到成功响应后才能响应文件选择请求。
- 断线期间若仍收到代理消息（极端情况），客户端应忽略并在重连成功后继续工作。

## 5. 日志要求
- 建议使用 `logging.getLogger(__name__)`：
  - `INFO`：握手成功/断开/对话框结果摘要。
  - `WARNING`：握手失败、对话框取消、无可用窗口。
  - `ERROR`：发送消息失败、对话框抛出异常。
- 日志前缀应包含 `client_id` 以便追踪。

## 6. 验收标准
1. 启动 `python app.py --module pdf-home` 后，服务器日志可看到：
   - `client_register_request` → `client_register_response` → `module=pdf-home`。
2. 前端点击“添加 PDF”时，桌面应用弹出原生对话框并回传文件路径。
3. 选择成功的文件在 `logs/pdf-home.log` 中记录并能在 UI 列表看到。
4. 取消选择或弹框出错时，服务器返回 `status=success, summary.selected=0` 或 `status=error`，前端可显示提示。
5. 人为断开连接后客户端能自动重连，并再次完成文件选择。 
