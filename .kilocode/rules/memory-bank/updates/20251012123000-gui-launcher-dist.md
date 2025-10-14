# 新任务记录（20251012123000）

主题：新增 dist 版 GUI 启动器 gui_launcher_dist.py（生产产物启动）

背景与动机：
- 现有 `gui_launcher.py` 面向开发态（src 目录），而已构建的产物位于 `dist/latest`。
- 需要一个面向 dist 的 GUI 启动器，便于测试生产模式页面与后端服务，不依赖 Vite。

涉及模块与路径：
- 后端启动器：`dist/latest/src/backend/launcher.py`（命令：start/stop/status，参数：`--msgCenter-port`、`--pdfFileServer-port`）
- PDF-Home 启动器：`dist/latest/src/frontend/pdf-home/launcher.py`（参数：`--prod`、`--keep-backend`）
- PDF-Viewer 启动器：`dist/latest/src/frontend/pdf-viewer/launcher.py`（参数：`--prod`、`--keep-backend`、`--pdf-id`、`--page-at`、`--position` 等）

执行步骤（原子任务）：
1) 读取最近 8 条 AI 工作日志与 memory-bank 上下文
2) 新建 AItemp 工作日志（已完成，见 AItemp/20251012123000-AI-Working-log.md）
3) 编写测试 `__tests__/test_gui_launcher_dist.py`（仅校验命令构造与路径）
4) 实现 `gui_launcher_dist.py`（PyQt6 界面 + 子进程）
5) 运行并修复测试（使用 `python -m unittest -q` 指定到本文件）
6) 更新 architecture/tech（若锚点冲突，将在 updates 目录记录）
7) 更新 AItemp 工作日志并通知完成

注意事项：
- 全部子进程命令需包含 `-X utf8`，保证 UTF-8 环境。
- 日志与文件写入统一 `encoding='utf-8'`，换行 `\n`。
- 运行端口的来源优先交由各 launcher 自行解析（runtime-ports.json），GUI 仅在必要时传参。
