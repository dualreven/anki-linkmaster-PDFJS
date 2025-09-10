AT003 验证脚本与步骤
==================

目的：
- 验证在后端启动时，应用实例的 websocket_server 会广播 open_pdf_viewer 事件，并将日志写入 logs/pdfjs-init.log 。

步骤：
1. 启动后端（推荐使用 ai-launcher）：
   - 在项目根目录运行（Windows PowerShell）：
     .\ai-launcher.ps1 start
   - 或按项目惯例启动后端主程序（例如运行 src/backend/main.py 或 app.py），如果使用 PyQt GUI，请按常规方式启动。

2. 观察后端启动日志输出（控制台）是否有启动成功信息：
   - 查找 "WebSocket服务器启动成功" 等信息。

3. 检查日志文件 logs/pdfjs-init.log：
   - 打开文件：logs/pdfjs-init.log
   - 查找包含文本：Sent open_pdf_viewer event to frontend
   - 如果存在，说明广播/日志写入成功。

4. 如果前端不可用（未连接客户端）：
   - 确认后端没有未捕获异常导致崩溃（检查控制台输出或后端日志）。
   - 即使没有前端连接，日志也应包含尝试发送或回退的记录（例如 Sent open_pdf_viewer (fallback) event ... 或 Failed to notify frontend: ... 的异常日志被捕获并记录）。

5. 手动验证（可选）：
   - 通过模拟 WebSocket 客户端连接到 ws://127.0.0.1:8765 并监听消息，确认在后端启动时收到包含 event=open_pdf_viewer 的消息。

示例命令（PowerShell）：
- 查看日志（实时跟踪）：
  Get-Content -Path .\logs\pdfjs-init.log -Wait -Tail 50

注意：
- 若日志文件不存在，请确认已完成 AT001（pdfjs_logger 实现）并且日志目录/文件可写。
- 若在运行时观察到异常信息，请将控制台输出和 logs/pdfjs-init.log 中的相关条目复制到此文件中，便于审计。