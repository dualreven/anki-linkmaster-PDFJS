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

## Worktree 环境（Windows / PowerShell）
- Node 包管理：优先 `pnpm`，设置共享 store（示例 `C:\\pnpm-store`），在各 worktree 使用 `pnpm install --frozen-lockfile`；可选 Yarn Berry(PnP)。
- Node 版本：`nvm-windows` + `.nvmrc` 固定版本；结合 `direnv` 或终端集成自动切换。
- Python 虚拟环境：在仓库外集中创建 venv（如 `C:\\venvs\\anki-linkmaster-PDFJS`），按分支差异可创建多个；进入 worktree 时激活。
- 自动激活：可选 `direnv`/`posh-direnv` 实现进入目录即激活 Node/venv。
- Git worktree 配置：使用 `git config --worktree` 进行工作树本地化配置与 hooks 隔离。


## JS 控制台日志捕获（QtWebSocket 替代方案）
- 位置：`src/frontend/pdf-home/js_console_logger.py`
- 实现：通过 `QWebSocket` 连接 QtWebEngine DevTools 的 `webSocketDebuggerUrl`，监听 `textMessageReceived` 事件。
- 启动方式：在 `src/frontend/pdf-home/launcher.py` 中通过 `QTimer.singleShot(2000, ...)` 延迟初始化，确保运行在 Qt 主线程。
- 依赖：不再依赖第三方 `websocket-client`；仍使用 HTTP 请求读取 `http://localhost:<debugPort>/json` 获取目标。
- 日志：写入 `logs/pdf-home-js.log`，显式 UTF-8 编码，逐行写入并确保换行 `\n`。

## Babel/Vite 配置要点（2025-09-26）
- vite 使用 `vite-plugin-babel`，通过 `babelConfig.configFile = path.resolve(process.cwd(), 'babel.config.js')` 显式指定配置文件路径。
- `babel.config.js` 改为 ESM `import` 直接引入插件对象，避免字符串插件名在 Windows/虚拟路径解析失败。
- 顶层 devDependencies 必须包含：
  - `@babel/plugin-transform-private-methods`
  - `@babel/plugin-transform-class-properties`
  - `@babel/plugin-transform-optional-chaining`
  - `@babel/plugin-transform-nullish-coalescing-operator`
  - `@babel/plugin-syntax-dynamic-import`
- 验证脚本：
  - `node scripts/test-import-babel-plugin.mjs`
  - `node scripts/test-babel-transform.mjs`
## AI Launcher Vite 日志增强（2025-09-26）
- `ProcessManager.start(..., check_delay=0.5)`：默认在启动后短延迟检查子进程退出，若异常退出会清理 PID 并将尾部日志写入 `ai-launcher.process.<service>`。
- `ProcessManager.tail_log(lines=20)`：用于服务在失败时读取日志尾部摘要。
- `NpmDevServerService`
  - 日志文件固定为 `logs/npm-dev.log`（UTF-8）。
  - 失败时通过 logger `ai-launcher.service.npm-dev` 输出摘要，提示查看对应日志。
- 新增自动化测试 `tests/ai_launcher/test_process_manager.py` 验证上述逻辑。- npm-dev 服务改动（2025-09-26）
  - `ProcessManager.start` 新增 `env` 参数并在 Windows 下继续使用 UTF-8 日志；启动后若子进程快速退出会记录尾部输出。
  - `NpmDevServerService` 传入 `NO_COLOR=1`, `FORCE_COLOR=0`, `CLICOLOR{,_FORCE}=0`, `VITE_FORCE_COLOR=0`，并在启动后调用 ANSI 转义清理（`logs/npm-dev.log` 保持无色）。
  - 自动化覆盖见 `tests/ai_launcher/test_process_manager.py`。
## pdf-viewer 启动诊断同步 (2025-09-26)
- launcher.py 支持新的 CLI:
  - --diagnose-only：跳过 Qt 事件循环，输出 JSON 诊断。
  - --disable-webchannel / --disable-websocket / --disable-js-console / --disable-frontend-load：分别屏蔽组件。
- 诊断输出格式：components.<name> = { enabled, executed, note }。
- 配套测试：python ai-scripts/tests/test_pdf_viewer_launcher_diagnose.py。
- 推荐排查：先 --diagnose-only --disable-js-console 验证 JS 日志线程，再逐项恢复。
\n## ai_launcher 根 CLI 用法（2025-09-27）
- 命令：
  - `python ai_launcher.py start [--vite-port N] [--msgServer-port N] [--pdfFileServer-port N] [--module pdf-home|pdf-viewer] [--pdf-id STR]`
  - `python ai_launcher.py stop`
  - `python ai_launcher.py status`
- 行为：
  - start：优先级解析端口（CLI > runtime-ports.json > npm-dev-vite.log > 默认），启动 `pnpm run dev`（写入 `logs/dev-process-info.json`），启动后端 `src/backend/launcher.py start`，如指定 `--module` 再启动对应前端（写入 `logs/frontend-process-info.json`）。
  - stop：停止 vite、前端，并调用后端 `stop`。
  - status：打印 `logs/dev-process-info.json` 与 `logs/frontend-process-info.json`，以及后端 `status` 输出。
- 兼容性映射：
  - 前端启动器参数：`--msgServer-port` 映射为 `--ws-port`，`--pdfFileServer-port` 映射为 `--pdf-port`。
  - `--pdf-id` 仅记录到前端进程信息，实际前端启动器不接收该参数。
- 文件 I/O：所有 JSON/日志写入均 UTF-8 且换行 `\n`；关键输出：`logs/ai-launcher.log`。

## PDF.js 性能优化配置规范 (2025-09-27)
- **核心配置**：
  - `disableAutoFetch: true`：禁用自动获取，延迟加载页面内容
  - `disableStream: true`：禁用流式加载，配合Range请求使用
  - `disableRange: false`：启用HTTP Range请求支持
  - `maxImageSize: 16777216`：16MB图片大小限制，防止内存过载
  - `useSystemFonts: false`：禁用系统字体，提升兼容性
- **页面边界检测**：
  - 使用 `page.getViewport({ scale: 1 })` 获取MediaBox尺寸
  - 使用 `page.getCropBox()` 获取实际显示区域（如果存在）
  - 通过 `viewport.width` 和 `viewport.height` 计算页面边界
- **内存管理策略**：
  - 页面缓存：使用Map缓存已加载页面，避免重复加载
  - 智能清理：保留当前页前后3页，清理超出范围的页面缓存
  - 预加载范围：根据滚动位置动态预加载可视区域前后页面
- **HTTP Range请求支持**：
  - 服务器端：支持`Accept-Ranges: bytes`和`Content-Range`响应头
  - 客户端：通过`Range: bytes=start-end`请求指定字节范围
  - 兼容性：注意Chrome/Safari首次Range请求可能不缓存的问题
- **版本兼容性**：
  - 推荐版本：PDF.js 2.5.207（生产环境稳定版本）
  - 最新版本：3.11.174（可能存在Range请求回归bug，需充分测试）
  - 移动端：iPad等设备Canvas内存限制更严格，建议使用SVG渲染模式
