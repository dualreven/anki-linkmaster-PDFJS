# Backend Launcher 使用说明（src/backend/launcher.py）

本说明文档描述 `src/backend/launcher.py` 的职责、命令、端口识别与进程管理策略，以及 `status` 输出约定。

## 职责概览
- 端口识别（pdfFile_server、ws_server）：
  - 端口来源优先级：命令行参数 > `logs/runtime-ports.json` > 代码导出函数（若有）> 默认值 > 端口可用性探测；
  - 对候选端口执行可用性检查（端口占用冲突避免）。
- 进程管理：
  - 启动：创建子进程（PDF 文件 HTTP 服务、WebSocket 服务）；
  - 追踪：记录 PID、端口、状态（`running|stopped`）到 `logs/backend-processes-info.json`；
  - 关闭：按 PID 尝试优雅终止，不行则强制。
- 提供命令：`start`、`stop`、`status`。

## 命令
- `start [--msgServer-port <number>] [--pdfFileServer-port <number>]`
  - 如果已有被追踪的同类后端进程，则先行停止；
  - 解析并验证端口后，分别启动 WS 与 PDF 文件服务；
  - 将 `{ service: 'ws'|'pdf', pid, port, status, updated_at }` 写入 `logs/backend-processes-info.json`（UTF-8，`\n`）。
- `stop`
  - 读取 `logs/backend-processes-info.json`，关闭其中记录的所有后端子进程；
  - 更新状态为 `stopped` 并写回文件。
- `status`
  - 输出当前服务的端口、PID、状态汇总；
  - 建议 JSON 结构：
    ```json
    {
      "ws_server": {"pid": 1234, "port": 8765, "status": "running"},
      "pdf_file_server": {"pid": 5678, "port": 8770, "status": "stopped"}
    }
    ```

## 端口识别策略
1. 命令行参数最高优先，例如：`--msgServer-port 8765 --pdfFileServer-port 8770`；
2. `logs/runtime-ports.json` 中的历史记录（若存在）；
3. 代码导出函数（例如集中端口分配器的 `get_default_ports()`）；
4. 默认值兜底（例如 WS=8765, PDF=8770）；
5. 可用性探测：若端口被占用，自动寻找相邻可用端口或报错退出（按实现策略选一）。

## 状态文件
- 路径：`logs/backend-processes-info.json`
- 编码与换行：UTF-8，`\n`
- 字段建议：
  - `service`: `"ws" | "pdf"`
  - `pid`: 进程 ID
  - `port`: 监听端口
  - `status`: `"running" | "stopped"`
  - `updated_at`: ISO8601 时间戳

## 示例
- 启动后端：
  - `python src/backend/launcher.py start --msgServer-port 8765 --pdfFileServer-port 8770`
- 停止后端：
  - `python src/backend/launcher.py stop`
- 查看后端状态：
  - `python src/backend/launcher.py status`

## 注意事项
- 所有文件读写请显式使用 UTF-8，并严格检查换行 `\n`；如在 Windows 环境避免 `\r`，可在测试中显式断言文件内容不含 `\r`。
- `status` 返回请覆盖服务端口、PID 与当前状态，以便与 `ai_launcher.py status` 套娃汇总输出配合。
- 日志与状态文件建议统一存放在 `logs/` 目录，保证目录存在与可写。

