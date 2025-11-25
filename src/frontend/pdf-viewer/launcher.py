#!/usr/bin/env python3
"""
PDF-Viewer Standalone Launcher

Runs the pdf-viewer window on its own, without going through ai-launcher.
Assumes base services (Vite dev server and Standard WebSocket server) are
already running. The launcher auto-resolves ports from logs/runtime-ports.json
and logs/npm-dev.log where possible.

Usage:
  # 推荐用法 - 使用PDF ID（会自动在 data/pdfs/ 等目录查找）
  python src/frontend/pdf-viewer/launcher.py --pdf-id sample

  # 已过时 - 使用文件路径（不推荐）
  # python src/frontend/pdf-viewer/launcher.py --file-path path/to/file.pdf

  # 打开PDF并跳转到指定页码（第5页）
  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5

  # 打开PDF并跳转到指定页码的特定位置（第5页的50%位置）
  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5 --position 50

  # 携带锚点ID（用于前端 Anchor Feature，例如 DEV: pdfanchor-test 或正式: pdfanchor-xxxxxxxxxxxx）
  # 等价写法：--anchor-id 或 --pdfanchor
  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --anchor-id pdfanchor-test
  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --pdfanchor pdfanchor-test

  # 完整示例：指定所有参数
  python src/frontend/pdf-viewer/launcher.py \\
    --file-path data/pdfs/document.pdf \\
    --page-at 10 \\
    --position 75

URL Navigation Parameters:
  --pdf-id ID          PDF文件标识符（会自动解析为文件路径）
  --page-at PAGE       目标页码（从1开始）
  --position PERCENT   页面内垂直位置百分比（0-100）
  --anchor-id ID       锚点ID（DEV: pdfanchor-test / 正式: pdfanchor- + 12位hex）
  --pdfanchor ID       锚点ID（与 --anchor-id 等价的别名，便于记忆）

Note:
  URL导航参数会传递给前端的url-navigation Feature处理。
  前端会自动加载PDF并跳转到指定位置。
"""

from __future__ import annotations

import os
import json
import sys
import time
import logging
import argparse
from pathlib import Path
from typing import Optional

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.qt.compat import QApplication, QUrl, QWebChannel, QWebSocket
from src.frontend.common.launch_config import LaunchConfig
from src.launcher.ports import read_runtime_ports as _ports_read, write_runtime_ports as _ports_write

# Import modules from pyqt directory by absolute file path to avoid cwd/sys.path issues in Hosted mode
import importlib.util
pyqt_dir = Path(__file__).parent / "pyqt"

# MainWindow
mw_spec = importlib.util.spec_from_file_location("pdf_viewer_main_window", pyqt_dir / "main_window.py")
mw_module = importlib.util.module_from_spec(mw_spec)
assert mw_spec and mw_spec.loader, "Failed to load pyqt/main_window.py"
mw_spec.loader.exec_module(mw_module)  # type: ignore
MainWindow = mw_module.MainWindow

# Import PdfViewerBridge and JSConsoleLogger from pyqt directory
bridge_spec = importlib.util.spec_from_file_location("pdf_viewer_bridge", pyqt_dir / "pdf_viewer_bridge.py")
bridge_module = importlib.util.module_from_spec(bridge_spec)
bridge_spec.loader.exec_module(bridge_module)
PdfViewerBridge = bridge_module.PdfViewerBridge

# Import JS Console Logger
logger_spec = importlib.util.spec_from_file_location("js_console_logger_qt", pyqt_dir / "js_console_logger_qt.py")
logger_module = importlib.util.module_from_spec(logger_spec)
logger_spec.loader.exec_module(logger_module)
JSConsoleLogger = logger_module.JSConsoleLogger

# Import Screenshot Handler
screenshot_spec = importlib.util.spec_from_file_location("screenshot_handler", pyqt_dir / "screenshot_handler.py")
screenshot_module = importlib.util.module_from_spec(screenshot_spec)
screenshot_spec.loader.exec_module(screenshot_module)
ScreenshotHandler = screenshot_module.ScreenshotHandler

# Simplified get_vite_port function for standalone launcher

logger = logging.getLogger("pdf-viewer.launcher")

# 强制日志目录（参数传入；无回退）
_FORCED_LOGS_DIR: Optional[Path] = None
def _set_logs_dir(p: str | Path) -> None:
    global _FORCED_LOGS_DIR
    _FORCED_LOGS_DIR = Path(p).resolve()
    _FORCED_LOGS_DIR.mkdir(parents=True, exist_ok=True)
def _require_logs_dir() -> Path:
    if _FORCED_LOGS_DIR is None:
        raise RuntimeError("logs_dir 未指定：请在 --logs-dir 或 LaunchConfig.logs_dir 传入")
    return _FORCED_LOGS_DIR


def resolve_pdf_id_to_file_path(pdf_id: str) -> str | None:
    """将PDF ID解析为实际的PDF文件路径.

    Args:
        pdf_id: PDF标识符

    Returns:
        解析出的PDF文件路径，如果找不到则返回None
    """
    # 定义PDF文件查找目录
    pdf_dirs = [
        project_root / "data" / "pdfs",
        project_root / "public",
        project_root / "src" / "data" / "pdfs",
    ]

    # 常见的PDF文件名模式
    potential_filenames = [
        f"{pdf_id}.pdf",
        f"test.pdf" if pdf_id == "test" else None,
        f"{pdf_id}-file.pdf",
        f"test-file.pdf" if pdf_id == "test" else None,
    ]

    # 去除None值
    potential_filenames = [f for f in potential_filenames if f]

    # 在各个目录中查找文件
    for pdf_dir in pdf_dirs:
        if not pdf_dir.exists():
            continue

        for filename in potential_filenames:
            file_path = pdf_dir / filename
            if file_path.exists():
                logger.info(f"Found PDF file for id '{pdf_id}': {file_path}")
                return str(file_path)

    # 如果没有找到，尝试查找目录中的第一个PDF文件作为默认
    for pdf_dir in pdf_dirs:
        if not pdf_dir.exists():
            continue

        pdf_files = list(pdf_dir.glob("*.pdf"))
        if pdf_files:
            default_file = pdf_files[0]
            logger.info(f"Using default PDF file for id '{pdf_id}': {default_file}")
            return str(default_file)

    return None


def extract_pdf_id(file_path: str | None) -> str:
    """从文件路径中提取PDF ID，用于日志文件命名.

    Args:
        file_path: PDF文件路径

    Returns:
        str: 提取的PDF ID，如果没有文件路径则返回'empty'
    """
    if not file_path:
        return "empty"

    try:
        # 从文件路径中提取文件名（不含扩展名）
        pdf_path = Path(file_path)
        pdf_id = pdf_path.stem  # 获取文件名不含扩展名

        # 清理PDF ID，只保留字母数字和短横线，替换其他字符为短横线
        import re
        cleaned_id = re.sub(r'[^a-zA-Z0-9\-_]', '-', pdf_id)

        # 避免空字符串或过长的ID
        if not cleaned_id or cleaned_id == '-':
            return "unnamed"

        # 限制长度，避免文件名过长
        if len(cleaned_id) > 50:
            cleaned_id = cleaned_id[:50]

        return cleaned_id

    except Exception as exc:
        logger.warning("Failed to extract PDF ID from path %s: %s", file_path, exc)
        return "error"


def get_log_file_paths(pdf_id: str) -> tuple[str, str]:
    """获取PDF-Viewer的日志文件路径.

    Args:
        pdf_id: PDF标识符

    Returns:
        tuple[str, str]: (python日志文件路径, js日志文件路径)
    """
    logs_dir = _require_logs_dir()
    python_log = str(logs_dir / f'pdf-viewer-{pdf_id}.log')
    js_log = str(logs_dir / f'pdf-viewer-{pdf_id}-js.log')
    return python_log, js_log


def get_vite_port():
    """Get Vite port from runtime-ports.json.

    Returns the actual running Vite port as managed by ai_launcher.
    Do NOT parse log files - runtime-ports.json is the single source of truth.
    """
    try:
        ports_file = _require_logs_dir() / 'runtime-ports.json'
        if ports_file.exists():
            with open(ports_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            port = int(data['vite_port'] if 'vite_port' in data else data['npm_port'])
            logger.info("Found Vite port %d from runtime-ports.json", port)
            return port
    except Exception as e:
        logger.warning("Failed to read Vite port from runtime-ports.json: %s", e)

    raise RuntimeError("未能从 logs_dir/runtime-ports.json 解析 vite_port")


def _read_runtime_ports(cwd: Path | None = None) -> tuple[int, int, int, dict]:
    """读取 logs/runtime-ports.json（统一从 src.launcher.ports 调用）。"""
    try:
        base = _require_logs_dir()
        data = _ports_read(base) or {}
        def _pick_int(d: dict, keys: list[str]) -> int | None:
            for k in keys:
                if k in d and d[k] is not None:
                    try:
                        return int(d[k])
                    except Exception:
                        pass
            return None
        vite_port = _pick_int(data, ['vite_port', 'npm_port'])
        msgCenter_port = _pick_int(data, ['msgCenter_port', 'ws_port'])
        pdfFile_port = _pick_int(data, ['pdfFile_port', 'pdf_port'])
        extras = {k: v for k, v in data.items() if k not in ("vite_port", "npm_port", "msgCenter_port", "ws_port", "pdfFile_port", "pdf_port")}
        return vite_port, msgCenter_port, pdfFile_port, extras
    except Exception as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"读取 runtime-ports.json 失败：{exc}")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="pdf-viewer standalone launcher")
    parser.add_argument("--url-port", type=int, dest="url_port", help="前端资源获取端口（dev模式=vite_port, prod模式=pdfFile_port）")
    parser.add_argument("--vite-port", type=int, dest="vite_port", help="⚠️ 已废弃，请使用 --url-port")
    parser.add_argument("--msgCenter-port", type=int, dest="msgCenter_port", help="消息中心服务器端口")
    parser.add_argument("--pdfFile-port", type=int, dest="pdfFile_port", help="PDF文件服务器端口")
    parser.add_argument("--js-debug-port", type=int, dest="js_debug_port", help="Remote debugging port for PDF-Viewer JS (QTWEBENGINE)")
    parser.add_argument("--no-persist", action="store_true", help="Do not persist ports back to logs/runtime-ports.json")
    parser.add_argument("--file-path", type=str, dest="file_path", help="PDF file path to load automatically")
    parser.add_argument("--pdf-id", type=str, dest="pdf_id", help="PDF ID to resolve to file path")
    # URL 参数跳转已禁用，移除以下参数：page-at, position, anchor-id, pdfanchor, annotation-id, outline-item-id
    parser.add_argument("--diagnose-only", action="store_true", help="Run initialization diagnostics and exit before starting the Qt event loop")
    parser.add_argument("--disable-webchannel", action="store_true", help="Skip QWebChannel bridge setup")
    parser.add_argument("--disable-websocket", action="store_true", help="Skip QWebSocket bridge connection")
    parser.add_argument("--disable-js-console", action="store_true", help="Skip JavaScript console logger thread")
    parser.add_argument("--disable-frontend-load", action="store_true", help="Skip loading the front-end URL into the WebEngine view")
    parser.add_argument("--prod", action="store_true", help="以生产模式运行，直接从 dist 静态文件加载页面")
    parser.add_argument("--keep-backend", action="store_true", help="窗口关闭时保持后端服务运行（不停止）")
    parser.add_argument("--logs-dir", type=str, dest="logs_dir", help="显式日志目录（必填）", required=True)
    ns = parser.parse_args(argv)
    # URL 参数跳转已禁用，移除 pdfanchor 别名规范化
    return ns


def _setup_logging(pdf_id: str = "empty") -> None:
    """设置日志系统，支持动态PDF ID命名.

    Args:
        pdf_id: PDF标识符，用于生成日志文件名
    """
    # 使用显式 logs_dir
    logs_dir = _require_logs_dir()
    os.makedirs(logs_dir, exist_ok=True)

    python_log, _ = get_log_file_paths(pdf_id)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.FileHandler(python_log, encoding='utf-8', mode='w'),
            logging.StreamHandler(sys.stdout),
        ],
    )


class PdfViewerApp:
    """
    PDF-Viewer Application Launcher

    支持两种运行模式：
    1. 子进程模式（parent_app=None）：独立运行，自己创建 QApplication
    2. 寄宿模式（parent_app=QApplication）：使用外部 QApplication（如 Anki）

    示例：
        # 子进程模式（CLI）
        config = LaunchConfig(pdf_id="sample", page_at=5)
        app = PdfViewerApp(config)
        sys.exit(app.run())

        # 寄宿模式（Anki集成）
        from aqt import mw
        config = LaunchConfig(pdf_id="sample", is_prod=True, source="anki")
        app = PdfViewerApp(config, parent_app=mw.app)
        app.run()
    """

    def __init__(self, config: LaunchConfig, parent_app: Optional[QApplication] = None):
        """
        初始化 PDF-Viewer 应用

        Args:
            config: 启动配置对象
            parent_app: 父 QApplication（None = 子进程模式）
        """
        self.config = config
        self.parent_app = parent_app
        self.mode = "hosted" if parent_app else "subprocess"

        # QApplication 实例
        self.app: Optional[QApplication] = None

        # 组件实例
        self.window = None
        self.ws_client = None
        self.js_console_logger = None
        self.bridge = None
        self.screenshot_handler = None

        # PDF 信息
        self.file_path: Optional[str] = None
        self.pdf_id: str = "empty"
        self._cleaned: bool = False  # 防重复清理

        logger.info(f"PdfViewerApp initialized in {self.mode} mode")
        logger.info(f"Config: {self.config}")

    def run(self) -> int:
        """
        运行应用

        Returns:
            退出码（子进程模式）或 0（寄宿模式）
        """
        # 要求 logs_dir 存在（由参数传入）
        if not getattr(self.config, 'logs_dir', None):
            raise RuntimeError("缺少 logs_dir：请在 LaunchConfig.logs_dir 指定或通过 CLI --logs-dir 传入")
        _set_logs_dir(self.config.logs_dir)

        # 步骤 1: 解析 PDF ID
        self.file_path = self.config.file_path
        if self.config.pdf_id and not self.file_path:
            self.file_path = resolve_pdf_id_to_file_path(self.config.pdf_id)
            if self.file_path:
                logger.info(f"Resolved PDF ID '{self.config.pdf_id}' to file path: {self.file_path}")
            else:
                logger.warning(f"Could not resolve PDF ID '{self.config.pdf_id}' to a valid file path")

        self.pdf_id = extract_pdf_id(self.file_path) if self.file_path else (self.config.pdf_id or "empty")
        python_log, js_log = get_log_file_paths(self.pdf_id)

        # 步骤 2: 设置日志
        _setup_logging(self.pdf_id)
        logger.info(f"Launching pdf-viewer ({self.mode} mode, pdf_id: {self.pdf_id})")

        # 步骤 3: 创建或使用 QApplication
        if self.mode == "subprocess":
            self.app = QApplication(sys.argv)
            logger.info("✅ Created QApplication (subprocess mode)")
        else:
            self.app = self.parent_app
            logger.info("✅ Using parent QApplication (hosted mode)")

        # 步骤 4: 解析端口配置（严格校验，禁止兜底）
        vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports()

        # ✅ 优先使用传入参数（GUI Hosted 模式），仅在未指定时才读取 runtime-ports.json（CLI 模式兼容）
        url_port_json = extras.get("url_port")
        url_port = self.config.url_port if self.config.url_port is not None else (url_port_json or self.config.vite_port or vite_json)
        msgCenter_port = self.config.msgCenter_port if self.config.msgCenter_port is not None else msgCenter_json
        pdfFile_port = self.config.pdfFile_port if self.config.pdfFile_port is not None else pdfFile_json
        js_debug_port = self.config.js_debug_port or int(extras.get("pdf-viewer-js", 9223))

        # ✅ 严格校验：url_port, msgCenter_port, pdfFile_port 不能为 None
        missing = []
        if url_port is None:
            missing.append("url_port (或 vite_port)")
        if msgCenter_port is None:
            missing.append("msgCenter_port")
        if pdfFile_port is None:
            missing.append("pdfFile_port")

        if missing:
            logs_dir = getattr(self.config, 'logs_dir', None)
            where = f"{logs_dir}/runtime-ports.json" if logs_dir else "runtime-ports.json"
            runtime_data = {"vite": vite_json, "msgCenter": msgCenter_json, "pdfFile": pdfFile_json, "url": url_port_json}
            raise RuntimeError(
                f"启动 pdf-viewer 失败，端口缺失：{', '.join(missing)}\n"
                f"runtime-ports.json: {runtime_data}\n"
                f"解决方案：\n"
                f"1. 通过 GUI 启动后端（自动写入端口配置）\n"
                f"2. 或显式传入 CLI 参数：--url-port, --msgCenter-port, --pdfFile-port"
            )

        logger.info(f"Mode: is_prod={self.config.is_prod} keep_backend={self.config.keep_backend}")
        logger.info(f"Resolved ports: url={url_port} msgCenter={msgCenter_port} pdfFile={pdfFile_port} (pdf_id: {self.pdf_id})")
        logger.info(f"JS remote debug port: {js_debug_port}")

        # 步骤 5: 持久化端口配置
        extras["pdf-viewer-js"] = js_debug_port
        if not self.config.no_persist:
            self._persist_ports(url_port, msgCenter_port, pdfFile_port, extras)

        # 步骤 6: 创建 JS Console Logger
        if not self.config.disable_js_console:
            self._create_js_logger(js_debug_port, js_log)

        # 步骤 7: 创建主窗口
        stop_backend_on_close = not self.config.keep_backend
        self.window = MainWindow(
            self.app,
            remote_debug_port=js_debug_port,
            js_log_file=js_log,
            js_logger=self.js_console_logger,
            pdf_id=self.pdf_id,
            stop_backend_on_close=stop_backend_on_close
        )
        logger.info("✅ MainWindow created")

        # 🔥 连接窗口关闭信号到 cleanup 方法（修复资源泄漏）
        # 确保窗口关闭时始终调用 cleanup，无论是子进程模式还是寄宿模式
        self.window.window_closing.connect(self.cleanup)
        logger.info("✅ Connected window_closing signal to cleanup()")

        # 步骤 8: 创建 WebSocket 客户端（设置父对象为窗口，便于随窗口生命周期销毁）
        try:
            self.ws_client = QWebSocket(self.window)  # 使 Qt 对象层级一致，减少悬挂对象
        except Exception:
            self.ws_client = QWebSocket()

        # 步骤 9: 设置 QWebChannel 桥接
        if not self.config.disable_webchannel:
            self._setup_qwebchannel()

        # 步骤 10: 设置 WebSocket 连接
        if not self.config.disable_websocket:
            self._setup_websocket(msgCenter_port)

        # 步骤 11: 加载前端
        if not self.config.disable_frontend_load:
            url = self._build_frontend_url(url_port, msgCenter_port, pdfFile_port)  # ✅ 使用 url_port
            logger.info(f"Front-end URL built: {url}")
            logger.info(f"Loading front-end: {url}")

            if not self.config.diagnose_only:
                self.window.load_frontend(url)
                self.window.show()

        # 步骤 12: 诊断模式检查
        if self.config.diagnose_only:
            logger.info("Diagnostic mode complete - skipping Qt event loop")
            self.ws_client.close()
            return 0

        # 步骤 13: 运行事件循环（仅子进程模式）
        if self.mode == "subprocess":
            rc = self.app.exec()
            logger.info(f"pdf-viewer window exited with code {rc} (pdf_id: {self.pdf_id})")
            # closeEvent 中已触发 cleanup，这里增加保护避免重复重重清理
            try:
                self.cleanup()
            except Exception:
                pass
            return rc
        else:
            logger.info("pdf-viewer window started (hosted mode, no event loop)")
            return 0

    def _build_frontend_url(self, url_port: int, msgCenter_port: int, pdfFile_port: int) -> str:
        """
        构建前端 URL

        Args:
            url_port: 前端资源获取端口（dev模式=vite_port, prod模式=pdfFile_port）
            msgCenter_port: WebSocket 端口
            pdfFile_port: HTTP 文件服务器端口
        """
        # ✅ 统一使用 url_port 构建基础 URL（不再判断 is_prod）
        # 使用 localhost 而不是 127.0.0.1，兼容 IPv4 和 IPv6
        url = f"http://localhost:{url_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"

        # 添加 file 参数（优先级：file_path > pdf_id）
        if self.file_path:
            import urllib.parse
            file_param = urllib.parse.quote(self.file_path)
            url += f"&file={file_param}"
        elif self.config.pdf_id:
            try:
                from urllib.parse import quote
                file_param = quote(f"/pdfs/{self.config.pdf_id}.pdf")
                url += f"&file={file_param}"
            except Exception:
                pass

        # 添加 URL 参数：pdf-id（供前端识别文档）
        # URL 参数跳转已禁用，不再添加 page-at, position, anchor-id, annotation-id, outline-item-id
        if self.config.pdf_id:
            url += f"&pdf-id={self.config.pdf_id}"

        # 保留 debug 开关
        try:
            extra = getattr(self.config, 'extra_params', {}) or {}
            if extra.get('debug') in (True, '1', 'true', 'yes', 'on', 1):
                url += f"&debug=1"
        except Exception:
            pass

        return url

    def _persist_ports(self, url_port: int, msgCenter_port: int, pdfFile_port: int, extras: dict):
        """持久化端口配置

        Args:
            url_port: 前端资源获取端口（开发模式=vite_port, 生产模式=pdfFile_port）
            msgCenter_port: WebSocket 端口
            pdfFile_port: HTTP 文件服务器端口
            extras: 其他配置

        Note:
            为向后兼容，JSON 中同时写入 vite_port 和 url_port 字段。
        """
        try:
            logs_dir = _require_logs_dir()
            logs_dir.mkdir(parents=True, exist_ok=True)
            payload = {
                "vite_port": url_port,       # 向后兼容旧代码
                "url_port": url_port,        # 新标准字段
                "msgCenter_port": msgCenter_port,
                "pdfFile_port": pdfFile_port
            }
            payload.update(extras or {})
            _ports_write(logs_dir, payload)
        except Exception as exc:
            logger.warning(f"Failed persisting runtime-ports.json: {exc}")

    def _create_js_logger(self, js_debug_port: int, log_file: str):
        """创建 JS 控制台日志记录器"""
        try:
            self.js_console_logger = JSConsoleLogger(
                debug_port=js_debug_port,
                log_file=log_file,
                pdf_id=self.pdf_id
            )
            if self.js_console_logger.start():
                logger.info(f"✅ JS console logger started for pdf_id: {self.pdf_id} on port {js_debug_port}")
            else:
                logger.warning("Failed to start JS console logger")
        except Exception as exc:
            logger.warning(f"Failed to initialize JS console logger: {exc}")
            self.js_console_logger = None

    def _setup_qwebchannel(self):
        """设置 QWebChannel 桥接"""
        try:
            self.channel = QWebChannel(self.window)  # 持有引用，避免被GC
            self.bridge = PdfViewerBridge(self.ws_client, self.window, self.file_path)
            self.screenshot_handler = ScreenshotHandler(self.window, project_root)
            self.channel.registerObject('pdfViewerBridge', self.bridge)
            self.channel.registerObject('screenshotHandler', self.screenshot_handler)
            if self.window.web_page:
                self.window.web_page.setWebChannel(self.channel)
            logger.info("✅ QWebChannel initialized: pdfViewerBridge and screenshotHandler registered")
        except Exception as exc:
            logger.warning(f"Failed to initialize QWebChannel bridge: {exc}")

    def _setup_websocket(self, msgCenter_port: int):
        """设置 WebSocket 连接"""
        ws_url = QUrl(f"ws://127.0.0.1:{msgCenter_port}")

        # ✅ 客户端注册状态
        registration_completed = False

        def on_connected():
            logger.info(f"WebSocket connected to {ws_url.toString()}")
            # 先发送客户端注册请求（保持旧协议语义，避免与 HTML WSClient 抢占同一 client_id）
            client_name = f"pdf-viewer-{self.pdf_id}"
            register_msg = {
                "type": "client:register:requested",
                "data": {
                    "client_name": client_name,
                    "client_id": self.pdf_id,
                    "module": "pdf-viewer",
                    "version": "1.0.0"
                },
                "timestamp": int(time.time() * 1000)
            }
            self.ws_client.sendTextMessage(json.dumps(register_msg, ensure_ascii=False))
            logger.info(f"Client registration request sent (client_name={client_name})")

        def on_text_message(message: str):
            """处理来自后端的文本消息"""
            nonlocal registration_completed
            try:
                msg = json.loads(message)
                msg_type = msg.get("type", "")

                # ✅ 等待注册完成
                if msg_type == "client:register:completed":
                    registration_completed = True
                    logger.info("Client registration completed")
                    # 注册完成后，加载PDF文件
                    if self.bridge and self.file_path:
                        self.bridge.loadPdfFile(self.file_path)
                elif msg_type == "client:register:failed":
                    logger.error(f"Client registration failed: {msg.get('error', {}).get('message', 'Unknown error')}")
            except Exception as e:
                logger.error(f"Failed to process WebSocket message: {e}")

        def on_disconnected():
            logger.info(f"WebSocket disconnected from {ws_url.toString()}")

        def on_error(error):
            logger.warning(f"WebSocket error: {error}")

        try:
            self.ws_client.connected.connect(on_connected)
        except Exception:
            pass
        try:
            self.ws_client.disconnected.connect(on_disconnected)
        except Exception:
            pass
        # 兼容 PyQt6: errorOccurred；兼容旧名 error
        try:
            if hasattr(self.ws_client, 'errorOccurred'):
                self.ws_client.errorOccurred.connect(on_error)  # type: ignore[attr-defined]
            else:
                self.ws_client.error.connect(on_error)  # type: ignore[attr-defined]
        except Exception:
            pass
        # ✅ 连接文本消息接收器
        try:
            self.ws_client.textMessageReceived.connect(on_text_message)  # type: ignore[attr-defined]
        except Exception:
            pass

        if not self.config.diagnose_only:
            self.ws_client.open(ws_url)
            logger.info(f"WebSocket connection initiated to {ws_url.toString()}")

    def cleanup(self):
        """清理资源（稳态、可重复调用）"""
        if getattr(self, "_cleaned", False):
            return
        logger.info("开始清理资源...")

        # 1) 优先断开 WebSocket 信号，避免销毁期间回调触发
        if self.ws_client:
            try:
                try:
                    # 尝试断开已连接的槽函数
                    self.ws_client.connected.disconnect()
                except Exception:
                    pass
                try:
                    self.ws_client.disconnected.disconnect()
                except Exception:
                    pass
                try:
                    self.ws_client.error.disconnect()
                except Exception:
                    pass
                try:
                    self.ws_client.textMessageReceived.disconnect()  # type: ignore[attr-defined]
                except Exception:
                    pass
            except Exception:
                pass

        # 2) 关闭 WebSocket（优先 close，必要时 abort），并安排销毁
        if self.ws_client:
            try:
                try:
                    # 优先走优雅关闭，通常是异步、不会阻塞UI
                    self.ws_client.close()
                except Exception:
                    pass
                try:
                    # 如仍存在活动套接字，尝试强制中止
                    if hasattr(self.ws_client, 'abort'):
                        self.ws_client.abort()  # type: ignore[attr-defined]
                except Exception:
                    pass
            except Exception:
                pass
            try:
                self.ws_client.deleteLater()
            except Exception:
                pass
            self.ws_client = None

        # 3) 拆除 QWebChannel 桥接，释放引用
        try:
            if self.window and hasattr(self.window, "web_page") and self.window.web_page:
                try:
                    # 解除页面上的 channel 引用，避免悬挂对象
                    self.window.web_page.setWebChannel(None)
                except Exception:
                    pass
        except Exception:
            pass
        try:
            self.channel = None
        except Exception:
            pass
        self.bridge = None
        self.screenshot_handler = None

        # 4) 停止 JS 控制台日志
        if self.js_console_logger:
            try:
                self.js_console_logger.stop()
                logger.info(f"JS console logger stopped for pdf_id: {self.pdf_id}")
            except Exception:
                pass
            self.js_console_logger = None

        # 5) 后端生命周期：GUI 模式下通常保持后端不动；仅在明确未指定 keep_backend 时尝试后台清理
        try:
            # 无论是否 keep_backend，均先移除前端进程信息
            _remove_viewer_from_frontend_info(project_root, self.pdf_id, logger)
            # 仅在未指定 keep_backend 时尝试后台清理（停止后端）
            if not getattr(self.config, "keep_backend", False):
                _stop_backend_services(project_root, logger)
        except Exception:
            pass

        # 6) 主视图资源释放（交给 Qt 管理，但尽量在此安排异步销毁）
        try:
            if self.window and hasattr(self.window, 'web_view') and self.window.web_view:
                try:
                    # 请求页面与视图异步销毁，减少关闭过程中的风险
                    if hasattr(self.window, 'web_page') and self.window.web_page:
                        self.window.web_page.deleteLater()
                except Exception:
                    pass
                try:
                    self.window.web_view.deleteLater()
                except Exception:
                    pass
        except Exception:
            pass

        # 7) 显式关闭窗口（关闭整个 PyQt 窗口框架）
        try:
            if self.window:
                self.window.close()
                logger.info("窗口已关闭")
        except Exception as e:
            logger.warning(f"关闭窗口时发生异常: {e}")

        self._cleaned = True


def _remove_viewer_from_frontend_info(project_root: Path, pdf_id: str, logger) -> None:
    """从 frontend-process-info.json 中移除本窗口记录（原子写）。"""
    import json
    from pathlib import Path as _Path
    try:
        frontend_info_path = project_root / 'logs' / 'frontend-process-info.json'
        if not frontend_info_path.exists():
            return
        with open(frontend_info_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'frontend' in data and isinstance(data['frontend'], dict):
            keys_to_remove = [k for k in list(data['frontend'].keys()) if k.startswith('pdf-viewer') and pdf_id in k]
            for k in keys_to_remove:
                del data['frontend'][k]
        tmp = _Path(str(frontend_info_path) + '.tmp')
        payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(payload)
        tmp.replace(frontend_info_path)
        logger.info("✓ 已从 frontend-process-info.json 移除本窗口记录")
    except Exception as exc:
        logger.warning(f"✗ 移除前端进程信息失败: {exc}")


def _stop_backend_services(project_root: Path, logger) -> None:
    """调用 ai_launcher.py stop 停止后端服务。"""
    import subprocess
    import sys as _sys
    ai_launcher_path = project_root / 'ai_launcher.py'
    if not ai_launcher_path.exists():
        logger.warning(f"✗ 未找到 ai_launcher.py: {ai_launcher_path}")
        return
    try:
        logger.info("正在停止后端服务...")
        result = subprocess.run([
            _sys.executable, str(ai_launcher_path), 'stop'
        ], cwd=str(project_root), capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=10)
        if result.returncode == 0:
            logger.info("✓ 后端服务已停止")
        else:
            logger.warning(f"✗ 停止后端服务失败 (code={result.returncode})")
    except subprocess.TimeoutExpired:
        logger.error("✗ 停止服务超时")
    except Exception as exc:
        logger.error(f"✗ 停止后端服务异常: {exc}")


def main() -> int:
    """
    CLI 入口函数（向后兼容）

    从命令行参数创建配置并启动 pdf-viewer（子进程模式）
    """
    # 解析命令行参数
    args = _parse_args(sys.argv[1:])

    # 构造配置对象
    config = LaunchConfig.from_args(args)

    # 创建并运行应用（子进程模式）
    app_instance = PdfViewerApp(config, parent_app=None)
    return app_instance.run()


def main_legacy() -> int:
    """
    Legacy CLI 入口函数（保留原有逻辑，仅用于调试）

    ⚠️ 已废弃：请使用 main() 函数
    """
    # Parse args first to get file path for PDF ID extraction
    args = _parse_args(sys.argv[1:])

    # Handle PDF ID resolution: if pdf-id is provided, resolve it to file path
    file_path = args.file_path
    if args.pdf_id and not file_path:
        file_path = resolve_pdf_id_to_file_path(args.pdf_id)
        if file_path:
            logger.info(f"Resolved PDF ID '{args.pdf_id}' to file path: {file_path}")
        else:
            logger.warning(f"Could not resolve PDF ID '{args.pdf_id}' to a valid file path")

    # Extract PDF ID from file path for dynamic log naming
    pdf_id = extract_pdf_id(file_path) if file_path else (args.pdf_id or "empty")
    python_log, js_log = get_log_file_paths(pdf_id)

    # Setup logging with dynamic PDF ID
    _setup_logging(pdf_id)
    logger.info(f"Launching pdf-viewer standalone window (pdf_id: {pdf_id})")

    # Create Qt app
    app = QApplication(sys.argv)

    # Ports resolution (CLI > runtime-ports.json > logs/defaults) - do this BEFORE creating window
    vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports()

    vite_port = args.vite_port if args.vite_port else vite_json
    if args.vite_port is None:
        try:
            vite_port = get_vite_port() or vite_port
        except Exception:
            pass

    msgCenter_port = args.msgCenter_port if args.msgCenter_port else msgCenter_json
    pdfFile_port = args.pdfFile_port if args.pdfFile_port else pdfFile_json
    # JS remote debug port: CLI or extras key "pdf-viewer-js"; default 9223 (different from pdf-home)
    js_debug_port = int(args.js_debug_port) if args.js_debug_port else int(extras.get("pdf-viewer-js", 9223))

    diagnostic_report: dict[str, object] = {
        "diagnostic_mode": bool(args.diagnose_only),
        "ports": {
            "vite": vite_port,
            "msgCenter": msgCenter_port,
            "pdfFile": pdfFile_port,
            "js_debug": js_debug_port,
        },
        "components": {},
    }

    def record_component(name: str, enabled: bool, executed: bool, note: str | None = None) -> None:
        entry: dict[str, object] = {
            "enabled": bool(enabled),
            "executed": bool(executed),
        }
        if note:
            entry["note"] = note
        diagnostic_report["components"][name] = entry

    # Create JS Console Logger first (before MainWindow)
    js_console_logger = None
    if not args.disable_js_console:
        try:
            js_console_logger = JSConsoleLogger(
                debug_port=js_debug_port,
                log_file=js_log,
                pdf_id=pdf_id
            )
            if js_console_logger.start():
                logger.info(f"JS console logger started for pdf_id: {pdf_id} on port {js_debug_port}")
            else:
                logger.warning("Failed to start JS console logger")
        except Exception as exc:
            logger.warning("Failed to initialize JS console logger: %s", exc)

    # Host window (pass JS remote debug port and logger)
    # 如果使用 --keep-backend 参数，则设置 stop_backend_on_close=False（不停止后端）
    stop_backend_on_close = not args.keep_backend  # 默认True，使用--keep-backend时为False
    window = MainWindow(
        app,
        remote_debug_port=js_debug_port,
        js_log_file=js_log,
        js_logger=js_console_logger,
        pdf_id=pdf_id,
        stop_backend_on_close=stop_backend_on_close
    )
    extras["pdf-viewer-js"] = js_debug_port
    logger.info("Resolved ports: vite=%s msgCenter=%s pdfFile=%s (pdf_id: %s)", vite_port, msgCenter_port, pdfFile_port, pdf_id)
    logger.info("JS remote debug port: %s", js_debug_port)

    # Persist runtime ports (including extras) unless disabled
    if not args.no_persist:
        try:
            logs_dir = project_root / 'logs'
            logs_dir.mkdir(parents=True, exist_ok=True)
            cfg_path = logs_dir / 'runtime-ports.json'
            payload = {"vite_port": vite_port, "msgCenter_port": msgCenter_port, "pdfFile_port": pdfFile_port}
            payload.update(extras or {})
            cfg_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        except Exception as exc:
            logger.warning("Failed persisting runtime-ports.json: %s", exc)

    # Simple WebSocket client for the bridge to send messages to the backend
    ws_client = QWebSocket()

    # QWebChannel bridge for local JS-Python interaction
    channel = None
    bridge = None
    screenshot_handler = None
    webchannel_enabled = not args.disable_webchannel
    webchannel_executed = False
    webchannel_note: str | None = None
    if webchannel_enabled:
        try:
            channel = QWebChannel(window)
            bridge = PdfViewerBridge(ws_client, window, file_path)
            screenshot_handler = ScreenshotHandler(window, project_root)
            channel.registerObject('pdfViewerBridge', bridge)
            channel.registerObject('screenshotHandler', screenshot_handler)
            if window.web_page:
                window.web_page.setWebChannel(channel)
            logger.info("QWebChannel initialized: pdfViewerBridge and screenshotHandler registered")
            webchannel_executed = True
        except Exception as exc:
            webchannel_note = f"Initialization failed: {exc}"
            logger.warning("Failed to initialize QWebChannel bridge: %s", exc)
    else:
        webchannel_note = "Disabled via --disable-webchannel"
        logger.info("QWebChannel initialization skipped via CLI flag")
    record_component("webchannel", webchannel_enabled, webchannel_executed, webchannel_note)

    # Connect to WebSocket after bridge is set up (non-blocking)
    websocket_enabled = not args.disable_websocket
    websocket_executed = False
    websocket_note: str | None = None
    if websocket_enabled:
        ws_url = QUrl(f"ws://127.0.0.1:{msgCenter_port}")

        # ✅ 客户端注册状态
        registration_completed = [False]  # 使用列表以便在闭包中修改

        def on_connected():
            logger.info("WebSocket connected to %s", ws_url.toString())
            # ✅ 先发送客户端注册请求
            register_msg = {
                "type": "client:register:requested",
                "data": {
                    "module": "pdf-viewer-launcher",
                    "version": "1.0.0"
                },
                "timestamp": int(time.time() * 1000)
            }
            ws_client.sendTextMessage(json.dumps(register_msg, ensure_ascii=False))
            logger.info("Client registration request sent")

        def on_text_message(message: str):
            """处理来自后端的文本消息"""
            try:
                msg = json.loads(message)
                msg_type = msg.get("type", "")

                # ✅ 等待注册完成
                if msg_type == "client:register:completed":
                    registration_completed[0] = True
                    logger.info("Client registration completed")
                    # 注册完成后，加载PDF文件
                    if bridge and file_path:
                        bridge.loadPdfFile(file_path)
                elif msg_type == "client:register:failed":
                    logger.error(f"Client registration failed: {msg.get('error', {}).get('message', 'Unknown error')}")
            except Exception as e:
                logger.error(f"Failed to process WebSocket message: {e}")

        def on_disconnected():
            logger.info("WebSocket disconnected from %s", ws_url.toString())

        def on_error(error):
            logger.warning("WebSocket error: %s", error)

        ws_client.connected.connect(on_connected)
        ws_client.disconnected.connect(on_disconnected)
        ws_client.error.connect(on_error)
        ws_client.textMessageReceived.connect(on_text_message)  # ✅ 连接消息接收器

        if args.diagnose_only:
            websocket_note = "Skipped connect in diagnostic mode"
            logger.info("Diagnostic mode: skipping WebSocket connection to %s", ws_url.toString())
        else:
            ws_client.open(ws_url)
            logger.info("WebSocket connection initiated to %s", ws_url.toString())
            websocket_executed = True
    else:
        websocket_note = "Disabled via --disable-websocket"
        logger.info("WebSocket client disabled via CLI flag")
    record_component("websocket", websocket_enabled, websocket_executed, websocket_note)

    # Record JS console logger component (already created before MainWindow)
    js_console_enabled = not args.disable_js_console
    js_console_executed = js_console_logger is not None and js_console_logger.is_connected()
    js_console_note = None

    if not js_console_enabled:
        js_console_note = "Disabled via --disable-js-console"
        logger.info("JS console logger disabled via CLI flag")
    elif args.diagnose_only:
        js_console_note = "Skipped in diagnostic mode"
        logger.info("Diagnostic mode: JS console logger not started")
    elif not js_console_executed:
        js_console_note = "Failed to start or initialize"

    record_component("js_console", js_console_enabled, js_console_executed, js_console_note)

    # Prepare front-end URL (dev vs prod)
    is_prod = bool(
        os.environ.get("APP_ENV") == "production"
        or os.environ.get("PDFJS_ENV") == "production"
        or os.environ.get("ENV") == "production"
        or args.prod
    )

    if is_prod:
        # 生产模式：通过 pdfFile_server 提供静态资源
        url = f"http://127.0.0.1:{pdfFile_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
        logger.info("Production mode: loading from static files")
    else:
        # 开发模式：使用 Vite dev server
        url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
        if file_path:
            import urllib.parse
            file_param = urllib.parse.quote(file_path)
            url += f"&file={file_param}"

    # Add URL navigation parameters (for url-navigation Feature)
    if args.pdf_id:
        # 始终附带 pdf-id 供 Outline 识别文档；是否执行导航由互斥策略控制
        url += f"&pdf-id={args.pdf_id}"

    if args.page_at is not None:
        # 添加目标页码参数
        url += f"&page-at={args.page_at}"
        logger.info(f"URL navigation: target page = {args.page_at}")

    if args.position is not None:
        # 添加页面内位置百分比参数
        # 限制在0-100范围内
        position = max(0.0, min(100.0, args.position))
        url += f"&position={position}"
        logger.info(f"URL navigation: target position = {position}%")

    # 追加 anchor-id（可选）
    if args.anchor_id:
        url += f"&anchor-id={args.anchor_id}"
        logger.info(f"URL navigation: anchor-id = {args.anchor_id}")

    # 追加 annotation-id（可选）
    if getattr(args, 'annotation_id', None):
        url += f"&annotation-id={args.annotation_id}"
        logger.info(f"URL navigation: annotation-id = {args.annotation_id}")

    # 追加 outline-item-id（可选）
    if getattr(args, 'outline_item_id', None):
        url += f"&outline-item-id={args.outline_item_id}"
        logger.info(f"URL navigation: outline-item-id = {args.outline_item_id}")

    # 在加载前，确保为本 viewer 配置独立的 Python 日志文件，避免 dist/latest/pdf-viewer-<id>.log 为空
    try:
        # 计算本次 pdf_id（优先命令行，其次从 file_path 提取）
        _pdf_id_for_log = None
        if args.pdf_id:
            _pdf_id_for_log = args.pdf_id
        elif file_path:
            _pdf_id_for_log = extract_pdf_id(file_path)
        else:
            _pdf_id_for_log = 'empty'

        py_log, _ = get_log_file_paths(_pdf_id_for_log)
        # 避免重复添加 FileHandler
        need_attach = True
        for h in logger.handlers:
            try:
                if getattr(h, 'baseFilename', '').endswith(f"pdf-viewer-{_pdf_id_for_log}.log"):
                    need_attach = False
                    break
            except Exception:
                pass
        if need_attach:
            from logging import FileHandler, Formatter
            Path(py_log).parent.mkdir(parents=True, exist_ok=True)
            fh = FileHandler(py_log, encoding='utf-8')
            fh.setFormatter(Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            logger.addHandler(fh)
            # 不改变现有 root logger 行为，允许同时写入 backend-launcher.log
            logger.propagate = True
            logger.info(f"Per-viewer python log attached: {py_log}")
    except Exception as _e:
        try:
            logger.warning(f"Failed to attach per-viewer log file: {_e}")
        except Exception:
            pass

    frontend_enabled = not args.disable_frontend_load
    frontend_executed = False
    frontend_note: str | None = None
    if frontend_enabled:
        logger.info("Loading front-end: %s", url)
        if args.diagnose_only:
            frontend_note = "Skipped in diagnostic mode"
            logger.info("Diagnostic mode: skipping load_frontend/show")
        else:
            window.load_frontend(url)
            window.show()
            frontend_executed = True
    else:
        frontend_note = "Disabled via --disable-frontend-load"
        logger.info("Front-end loading disabled via CLI flag")
    record_component("frontend_load", frontend_enabled, frontend_executed, frontend_note)

    if args.diagnose_only:
        logger.info("Diagnostic mode complete - skipping Qt event loop")
        print(json.dumps(diagnostic_report, ensure_ascii=False))
        ws_client.close()
        return 0

    rc = app.exec()
    logger.info("pdf-viewer window exited with code %s", rc)

    # Clean up resources
    ws_client.close()
    if js_console_logger:
        js_console_logger.stop()
        logger.info(f"JS console logger stopped for pdf_id: {pdf_id}")

    # 停止后台服务（复制closeEvent中的逻辑）
    _cleanup_backend_services(pdf_id, logger)

    logger.info(f"pdf-viewer window exited with code {rc} (pdf_id: {pdf_id})")
    return int(rc)


def _cleanup_backend_services(pdf_id: str, logger) -> None:
    """清理后台服务 - 当窗口关闭时调用"""
    import subprocess
    import json
    from pathlib import Path

    try:
        # 修正路径：launcher.py -> pdf-viewer -> frontend -> src -> 项目根目录
        project_root = Path(__file__).parent.parent.parent.parent
        logger.info(f"开始清理后台服务 (pdf_id: {pdf_id})")
        logger.info(f"项目根目录: {project_root}")

        # 第一步：从 frontend-process-info.json 中移除窗口记录
        try:
            frontend_info_path = project_root / 'logs' / 'frontend-process-info.json'
            if frontend_info_path.exists():
                with open(frontend_info_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                if 'frontend' in data and isinstance(data['frontend'], dict):
                    keys_to_remove = [
                        key for key in data['frontend'].keys()
                        if key.startswith('pdf-viewer') and pdf_id in key
                    ]
                    for key in keys_to_remove:
                        del data['frontend'][key]
                        logger.info(f"已从跟踪列表中移除窗口: {key}")

                with open(frontend_info_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                logger.info("✓ 清理前端进程信息成功")
        except Exception as e:
            logger.warning(f"✗ 清理前端进程信息失败: {e}")

        # 第二步：调用 ai_launcher.py stop 停止后端服务
        ai_launcher_path = project_root / 'ai_launcher.py'
        if ai_launcher_path.exists():
            logger.info("正在停止后端服务...")
            result = subprocess.run(
                [sys.executable, str(ai_launcher_path), 'stop'],
                cwd=str(project_root),
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=10
            )

            if result.returncode == 0:
                logger.info("✓ 后端服务已停止")
            else:
                logger.warning(f"✗ 停止后端服务失败 (code={result.returncode})")
        else:
            logger.warning(f"✗ 未找到 ai_launcher.py: {ai_launcher_path}")

    except subprocess.TimeoutExpired:
        logger.error("✗ 停止服务超时")
    except Exception as e:
        logger.error(f"✗ 清理后台服务时发生错误: {e}")
        import traceback
        logger.error(traceback.format_exc())


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ImportError as e:
        # 捕获导入错误（如缺少QSizePolicy等）
        error_msg = f"导入错误: {e}\n\n"
        error_msg += "可能的原因:\n"
        error_msg += "1. 缺少必要的Qt组件 (如QSizePolicy)\n"
        error_msg += "2. PyQt6或相关依赖未正确安装\n"
        error_msg += "3. src/qt/compat.py 中缺少必要的导出\n\n"
        error_msg += f"详细信息: {str(e)}"
        print(error_msg, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # 捕获其他所有异常
        error_msg = f"启动失败: {type(e).__name__}: {e}\n"
        print(error_msg, file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


