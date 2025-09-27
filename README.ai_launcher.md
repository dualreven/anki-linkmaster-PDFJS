# ai_launcher.py 使用说明

本说明文档描述 `ai_launcher.py` 的命令、参数、日志、执行流程与状态文件约定，帮助在开发与集成中快速启动/停止/巡检相关前后端服务。

## 功能概览
- 提供命令：`start`、`stop`、`status`
- 支持参数：`--vite-port <number>`、`--msgServer-port <number>`、`--pdfFileServer-port <number>`、`--module <name>`、`--pdf-id <string>`
- 记录日志到 `logs/ai-launcher.log`（UTF-8，换行 `\n`）
- 进程与端口状态持久化：
  - `logs/dev-process-info.json`（Vite/npm dev）
  - `logs/frontend-process-info.json`（前端模块：pdf-home / pdf-viewer）

## 参数说明
- `--vite-port`：指定 Vite 开发服务端口。端口获取优先级：命令行 > `logs/runtime-ports.json` > 代码导出函数 > 默认值（如 3000）> 可用性探测。
- `--msgServer-port`：后端消息（WebSocket）服务端口，传递给后端与前端模块。
- `--pdfFileServer-port`：后端 PDF 文件 HTTP 服务端口，传递给后端与前端模块。
- `--module`：指定要打开的前端模块（`pdf-home` 或 `pdf-viewer`）。
- `--pdf-id`：可选，传给 `pdf-viewer` 用于打开指定 PDF（实现可将其映射为 file-id/file-path）。

## 日志
- 文件：`logs/ai-launcher.log`
- 内容：启动/停止流程、参数解析、端口选择、子进程 PID、异常堆栈。
- 编码与换行：UTF-8，`\n`。

## start 执行流程（概要）
1. 若存在被追踪的 `pnpm run dev`（Vite）进程，先尝试关闭。
2. 获取 `vite` 端口（命令行 > `logs/runtime-ports.json` > 导出函数 > 默认值，包含可用性探测），并以该端口运行 `pnpm run dev -- --port <vite-port>`，将 PID、端口、`running|stopped` 写入 `logs/dev-process-info.json`。
3. 调用后端：`python src/backend/launcher.py start [--msgServer-port <n>] [--pdfFileServer-port <n>]`，由后端负责实际的 WS/PDF 文件服务启动与追踪。
4. 如提供 `--module`：
   - 当 `module == pdf-home`：执行 `python src/frontend/pdf-home/launcher.py --vite-port <n> [--msgServer-port <n>] [--pdfFileServer-port <n>]`；
   - 当 `module == pdf-viewer`：执行 `python src/frontend/pdf-viewer/launcher.py --vite-port <n> [--msgServer-port <n>] [--pdfFileServer-port <n>] [--pdf-id <id>]`；
   - 将前端 PID、端口与 `running|stopped` 写入 `logs/frontend-process-info.json`。

## stop 命令
- 读取 `logs/dev-process-info.json` 并尝试关闭其中记录的 Vite 进程。
- 读取 `logs/frontend-process-info.json` 并尝试关闭其中记录的前端模块进程。
- 执行 `python src/backend/launcher.py stop` 以停止后端相关服务。
- 将变更状态写回上述 JSON。

## status 命令
- 打印 `logs/dev-process-info.json` 与 `logs/frontend-process-info.json` 的内容（若存在）。
- 执行并转发 `python src/backend/launcher.py status` 的输出，便于统一巡检。

## 状态文件约定
- `logs/dev-process-info.json`：
  - 字段建议：`{ name: 'vite-dev', pid: <int>, port: <int>, status: 'running|stopped', updated_at: '<ISO8601>' }`
- `logs/frontend-process-info.json`：
  - 字段建议：`{ module: 'pdf-home|pdf-viewer', pid: <int>, ports: { vite?: <int>, ws?: <int>, pdf?: <int> }, status: 'running|stopped', updated_at: '<ISO8601>', pdf_id?: '<string>' }`

## 使用示例
- 启动 pdf-home：
  - `python ai_launcher.py start --module pdf-home --vite-port 3000 --msgServer-port 8765 --pdfFileServer-port 8770`
- 启动 pdf-viewer 并指定 pdf-id：
  - `python ai_launcher.py start --module pdf-viewer --vite-port 3001 --msgServer-port 8766 --pdfFileServer-port 8771 --pdf-id 12345`
- 停止全部：
  - `python ai_launcher.py stop`
- 查看状态：
  - `python ai_launcher.py status`

## 注意事项
- 强制使用 UTF-8 读写所有文件，并严格检查换行 `\n`。建议测试中显式校验文档与日志不包含 `\r` 字符。
- 端口解析应具备“命令行 > 配置文件 > 导出函数 > 默认值 > 可用性检测”的兜底链路。
- 日志与 JSON 文件路径位于 `logs/` 目录；请确保该目录可写且存在。

