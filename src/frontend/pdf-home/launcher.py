#!/usr/bin/env python3
"""
PDF-Home Standalone Launcher

Runs the pdf-home window on its own, without going through ai-launcher.
Assumes base services (Vite dev server and Standard WebSocket server) are
already running. The launcher auto-resolves ports from logs/runtime-ports.json
and logs/npm-dev.log where possible.

Usage:
  python src/frontend/pdf-home/launcher.py
"""

from __future__ import annotations

import os
import json
import sys
import logging
import argparse
from pathlib import Path
from typing import Optional

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.qt.compat import QApplication, QUrl, QWebSocket, QWebChannel
from src.frontend.common.launch_config import LaunchConfig
from src.launcher.ports import read_runtime_ports as _ports_read, write_runtime_ports as _ports_write
from src.frontend.common.pyqt.qt_app_runner import init_qapplication  # 统一 QApplication 启动模式
from src.frontend.common.pyqt.ports_utils import resolve_frontend_ports

# Import PyQtBridge and JSConsoleLogger from current directory
import importlib.util
current_dir = Path(__file__).parent

# 延迟导入 MainWindow（避免在 QApplication 之前初始化 QtWebEngine）
def _load_main_window_class():
    spec = importlib.util.spec_from_file_location("main_window", current_dir / "main_window.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader, "Failed to load main_window module spec"
    spec.loader.exec_module(module)  # type: ignore
    return module.MainWindow

# Import PyQtBridge
bridge_spec = importlib.util.spec_from_file_location("pyqt_bridge", current_dir / "pyqt-bridge.py")
bridge_module = importlib.util.module_from_spec(bridge_spec)
bridge_spec.loader.exec_module(bridge_module)
PyQtBridge = bridge_module.PyQtBridge

# Import JSConsoleLogger
logger_spec = importlib.util.spec_from_file_location("js_console_logger", current_dir / "js_console_logger.py")
logger_module = importlib.util.module_from_spec(logger_spec)
logger_spec.loader.exec_module(logger_module)
JSConsoleLogger = logger_module.JSConsoleLogger

# Simplified get_vite_port function for standalone launcher


logger = logging.getLogger("pdf-home.launcher")

# 强制日志目录（由参数传入；不允许回退）
_FORCED_LOGS_DIR: Optional[Path] = None

def _set_logs_dir(p: str | Path) -> None:
    global _FORCED_LOGS_DIR
    _FORCED_LOGS_DIR = Path(p).resolve()
    _FORCED_LOGS_DIR.mkdir(parents=True, exist_ok=True)

def _require_logs_dir() -> Path:
    if _FORCED_LOGS_DIR is None:
        raise RuntimeError("logs_dir 未指定，请通过参数 --logs-dir 传入或在 LaunchConfig.logs_dir 指定")
    return _FORCED_LOGS_DIR

def _get_js_log_path() -> Path:
    return _require_logs_dir() / 'pdf-home-js.log'


def _ensure_pdf_home_file_logger() -> None:
    """为 pdf-home 系列 logger 增加独立文件输出，避免 Hosted 模式下 basicConfig 被忽略。

    - 日志文件: logs/pdf-home.log（UTF-8）
    - 作用范围: `pdf-home` 及其子 logger（launcher/main_window 等）
    - 不依赖 root logger，防止被后端的 logging.basicConfig 覆盖
    """
    try:
        logs_dir = _require_logs_dir()
        log_path = logs_dir / 'pdf-home.log'

        fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')

        def attach(handler_logger_name: str) -> None:
            lg = logging.getLogger(handler_logger_name)
            # 避免重复添加相同文件处理器
            already = False
            for h in lg.handlers:
                try:
                    if getattr(h, 'baseFilename', None) and str(getattr(h, 'baseFilename')) == str(log_path):
                        already = True
                        break
                except Exception:
                    continue
            if not already:
                # 回滚为覆盖写入：每次启动清空旧日志（UTF-8）
                fh = logging.FileHandler(log_path, mode='w', encoding='utf-8')
                fh.setFormatter(fmt)
                lg.addHandler(fh)
            # 允许日志同时冒泡到其他 handler（如 GUI/后端日志）
            lg.propagate = True
            # 直接设置为 INFO，避免受 root logger 影响
            lg.setLevel(logging.INFO)

        # 顶层域与常见子域
        for name in ("pdf-home", "pdf-home.launcher", "pdf-home.main_window"):
            attach(name)
    except Exception:
        # 诊断日志初始化失败不应阻断主流程
        pass

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
            port = int(data.get('vite_port') or data.get('npm_port') or 3000)
            logger.info("Found Vite port %d from runtime-ports.json", port)
            return port
    except Exception as e:
        logger.warning("Failed to read Vite port from runtime-ports.json: %s", e)

    raise RuntimeError("未能从 logs_dir/runtime-ports.json 解析到 vite_port；请确保 --logs-dir 正确且文件存在")


def _read_runtime_ports(cwd: Path | None = None) -> tuple[int, int, int, dict]:
    """读取 logs/runtime-ports.json（统一从 resolve_frontend_ports 调用）。"""
    # 这里保持签名以兼容既有调用，但具体解析逻辑委托给前端公共工具。
    cfg = LaunchConfig(is_prod=False)
    cfg.logs_dir = str(_require_logs_dir())
    url_port, msgCenter_port, pdfFile_port, extras = resolve_frontend_ports(cfg)
    return url_port, msgCenter_port, pdfFile_port, extras


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="pdf-home standalone launcher")
    parser.add_argument("--url-port", type=int, dest="url_port", help="前端资源获取端口（dev模式=vite_port, prod模式=pdfFile_port）")
    parser.add_argument("--vite-port", type=int, dest="vite_port", help="⚠️ 已废弃，请使用 --url-port")
    parser.add_argument("--msgCenter-port", type=int, dest="msgCenter_port", help="消息中心服务器端口")
    parser.add_argument("--pdfFile-port", type=int, dest="pdfFile_port", help="PDF文件服务器端口")
    parser.add_argument("--js-debug-port", type=int, dest="js_debug_port", help="Remote debugging port for PDF-Home JS (QTWEBENGINE)")
    parser.add_argument("--no-persist", action="store_true", help="Do not persist ports back to logs/runtime-ports.json")
    parser.add_argument("--prod", action="store_true", help="以生产模式运行，直接从 dist 静态文件加载页面")
    parser.add_argument("--keep-backend", action="store_true", help="窗口关闭时保持后端服务运行（不停止）")
    parser.add_argument("--logs-dir", type=str, dest="logs_dir", help="显式日志目录（必填）", required=True)
    return parser.parse_args(argv)


def _setup_logging() -> None:
    # 始终保证专属日志文件可写
    _ensure_pdf_home_file_logger()
    # 同时确保 stdout 也有输出，便于调试
    try:
        fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(fmt)
        lg = logging.getLogger("pdf-home")
        # 避免重复添加
        if not any(isinstance(h, logging.StreamHandler) for h in lg.handlers):
            lg.addHandler(sh)
        if lg.level > logging.INFO:
            lg.setLevel(logging.INFO)
    except Exception:
        pass


class PdfHomeApp:
    """
    PDF-Home Application Launcher

    支持两种运行模式：
    1. 子进程模式（parent_app=None）：独立运行，自己创建 QApplication
    2. 寄宿模式（parent_app=QApplication）：使用外部 QApplication（如 Anki）

    示例：
        # 子进程模式（CLI）
        config = LaunchConfig(is_prod=False)
        app = PdfHomeApp(config)
        sys.exit(app.run())

        # 寄宿模式（Anki集成）
        from aqt import mw
        config = LaunchConfig(is_prod=True, source="anki")
        app = PdfHomeApp(config, parent_app=mw.app)
        app.run()
    """

    def __init__(self, config: LaunchConfig, parent_app: Optional[QApplication] = None):
        """
        初始化 PDF-Home 应用

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
        self.pyqt_bridge = None

        logger.info(f"PdfHomeApp initialized in {self.mode} mode")
        logger.info(f"Config: {self.config}")

    def run(self) -> int:
        """
        运行应用

        Returns:
            退出码（子进程模式）或 0（寄宿模式）
        """
        # 要求 logs_dir 已设置
        if not self.config.logs_dir:
            raise RuntimeError("缺少 logs_dir：请在 LaunchConfig.logs_dir 指定或 CLI 传入 --logs-dir")
        _set_logs_dir(self.config.logs_dir)
        _setup_logging()
        logger.info(f"Launching pdf-home ({self.mode} mode)")

        # 步骤 1: 解析端口配置（严格校验，禁止兜底）
        # NOTE: 端口缺失应在 Qt 初始化前直接 fail-fast；避免在无 PyQt 环境的单测中先触发 Qt 相关异常。
        vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports(project_root)

        def _to_int_or_none(v):
            try:
                return int(v) if v is not None else None
            except Exception:
                return None

        # ✅ 优先使用传入参数（GUI Hosted 模式），仅在未指定时才读取 runtime-ports.json（CLI 模式兼容）
        url_port_json = extras.get("url_port")  # runtime-ports.json 中的 url_port
        url_port = _to_int_or_none(
            self.config.url_port if self.config.url_port is not None else (url_port_json or self.config.vite_port or vite_json)
        )
        msgCenter_port = _to_int_or_none(self.config.msgCenter_port if self.config.msgCenter_port is not None else msgCenter_json)
        pdfFile_port = _to_int_or_none(self.config.pdfFile_port if self.config.pdfFile_port is not None else pdfFile_json)
        js_debug_port = _to_int_or_none(self.config.js_debug_port or extras.get("pdf-home-js")) or 9222

        # 严格校验：url_port, msgCenter_port, pdfFile_port 不能为 None
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
                f"启动 pdf-home 失败，端口缺失：{', '.join(missing)}\n"
                f"runtime-ports.json: {runtime_data}\n"
                f"解决方案：\n"
                f"1. 通过 GUI 启动后端（自动写入端口配置）\n"
                f"2. 或显式传入 CLI 参数：--url-port, --msgCenter-port, --pdfFile-port"
            )

        # 步骤 2: 创建或使用 QApplication（通过公共辅助函数）
        self.app, self.mode = init_qapplication(self.parent_app, logger, "pdf-home")

        logger.info(f"Mode: is_prod={self.config.is_prod} keep_backend={self.config.keep_backend}")
        logger.info(f"Resolved ports: url={url_port} msgCenter={msgCenter_port} pdfFile={pdfFile_port}")
        logger.info(f"JS remote debug port: {js_debug_port}")
        # 在记录 compat 之前，尝试加载/重试 QtWebEngine
        try:
            import importlib as _il
            _compat = _il.import_module('src.qt.compat')
            if getattr(_compat, 'QWebEngineView', None) is None and hasattr(_compat, 'ensure_webengine_loaded'):
                try:
                    _compat.ensure_webengine_loaded()
                except Exception:
                    pass
            logger.info("compat: QWebEngineView=%s QWebEnginePage=%s QWebEngineSettings=%s",
                        getattr(_compat, 'QWebEngineView', None),
                        getattr(_compat, 'QWebEnginePage', None),
                        getattr(_compat, 'QWebEngineSettings', None))
        except Exception as _e:
            logger.warning("compat import failed: %s", _e)

        # 步骤 3: 持久化端口配置
        extras["pdf-home-js"] = js_debug_port
        if not self.config.no_persist:
            self._persist_ports(url_port, msgCenter_port, pdfFile_port, extras)

        # 步骤 4: 创建 JS Logger
        js_log_file = str(_get_js_log_path())
        self._create_js_logger(js_debug_port, js_log_file)

        # 步骤 5: 再次确保 QtWebEngine 加载（A QApplication 已就绪），然后创建主窗口（延迟导入）
        try:
            import importlib as _il
            _compat = _il.import_module('src.qt.compat')
            if hasattr(_compat, 'ensure_webengine_loaded'):
                try:
                    _compat.ensure_webengine_loaded()
                except Exception:
                    pass
        except Exception:
            pass

        MainWindow = _load_main_window_class()
        stop_backend = not self.config.keep_backend
        self.window = MainWindow(
            self.app,
            remote_debug_port=js_debug_port,
            js_log_file=js_log_file,
            js_logger=self.js_console_logger,
            stop_backend_on_close=stop_backend
        )
        logger.info("✅ MainWindow created")

        # 步骤 6: 创建 WebSocket 客户端
        self.ws_client = QWebSocket()
        self._setup_websocket(msgCenter_port)

        # 步骤 7: 设置 QWebChannel 桥接
        self._setup_qwebchannel()

        # 步骤 8: 加载前端（若无 QtWebEngine，回退为外部浏览器）
        url = self._build_frontend_url(url_port, msgCenter_port, pdfFile_port)  # ✅ 使用 url_port
        logger.info(f"Front-end URL built: {url}")
        logger.info(f"Loading front-end: {url}")

        try:
            has_webview = bool(getattr(self.window, 'web_view', None))
        except Exception:
            has_webview = False

        if has_webview:
            # 常规：嵌入式 WebEngine 视图
            self.window.load_frontend(url)
        else:
            # 回退：未安装/不可用 QtWebEngine 时，改用系统默认浏览器打开
            logger.warning("QWebEngineView is not available. Falling back to external browser mode.")
            try:
                import webbrowser
                opened = webbrowser.open(url)
                logger.info("Opened external browser for pdf-home: %s (opened=%s)", url, opened)
            except Exception as e:
                logger.error("Failed to open external browser: %s", e, exc_info=True)
            try:
                # 在状态栏提示当前回退模式
                if getattr(self.window, 'status_bar', None):
                    self.window.status_bar.showMessage(f"未检测到 QtWebEngine，已在默认浏览器打开：{url}")
            except Exception:
                pass

        self.window.show()

        # 步骤 9: 运行事件循环（仅子进程模式）
        if self.mode == "subprocess":
            rc = self.app.exec()
            logger.info(f"pdf-home window exited with code {rc}")
            self.cleanup()
            return rc
        else:
            logger.info("pdf-home window started (hosted mode, no event loop)")
            return 0

    def _build_frontend_url(self, url_port: int, msgCenter_port: int, pdfFile_port: int) -> str:
        """
        构建前端 URL

        Args:
            url_port: 前端资源获取端口（dev模式=vite_port, prod模式=pdfFile_port）
            msgCenter_port: WebSocket 端口
            pdfFile_port: HTTP 文件服务器端口
        """
        import time
        cache_buster = int(time.time() * 1000)

        # ✅ 统一使用 url_port 构建 URL（不再判断 is_prod）
        # 生产模式：url_port = pdfFile_port，从静态资源服务器加载
        # 开发模式：url_port = vite_port，从 Vite 开发服务器加载
        # 使用 localhost 而不是 127.0.0.1，兼容 IPv4 和 IPv6
        return f"http://localhost:{url_port}/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}&_={cache_buster}"

    def _persist_ports(self, url_port, msgCenter_port, pdfFile_port, extras):
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
                "pdfFile_port": pdfFile_port,
                **(extras or {})
            }
            _ports_write(logs_dir, payload)
        except Exception as exc:
            logger.warning("Failed persisting runtime-ports.json: %s", exc)

    def _setup_websocket(self, msgCenter_port: int):
        """设置 WebSocket 连接（不使用 QWebChannel）。"""
        try:
            logger.info("开始初始化WebSocket连接...")
            ws_url = QUrl(f"ws://127.0.0.1:{msgCenter_port}")

            # 事件处理
            self.ws_client.connected.connect(lambda: logger.info(f"WebSocket连接成功到: {ws_url.toString()}"))
            self.ws_client.disconnected.connect(lambda: logger.info(f"WebSocket断开连接从: {ws_url.toString()}"))
            try:
                self.ws_client.error.connect(lambda error: logger.warning(f"WebSocket发生错误: {error}"))
            except Exception:
                pass

            self.ws_client.open(ws_url)
            logger.info(f"WebSocket连接已启动到: {ws_url.toString()}")

        except Exception as exc:
            logger.error("WebSocket初始化失败: %s", exc, exc_info=True)
            raise

    def _setup_qwebchannel(self):
        """设置 QWebChannel 桥接。"""
        try:
            logger.info("[QWebChannel] 开始初始化 QWebChannel...")
            channel = QWebChannel(self.window)
            self.pyqt_bridge = PyQtBridge(self.window, is_prod=self.config.is_prod, logs_dir=self.config.logs_dir)
            channel.registerObject('pyqtBridge', self.pyqt_bridge)

            if self.window.web_page:
                self.window.web_page.setWebChannel(channel)
                logger.info("[QWebChannel] QWebChannel 设置到 WebPage 成功")
            else:
                logger.warning("[QWebChannel] window.web_page 不存在，无法设置 QWebChannel")

        except Exception as exc:
            logger.error("[QWebChannel] 初始化失败: %s", exc, exc_info=True)
            raise

    def _create_js_logger(self, js_debug_port: int, log_file: str):
        """创建 JS 控制台日志记录器实例（基于 Qt javaScriptConsoleMessage）。"""
        try:
            self.js_console_logger = JSConsoleLogger(debug_port=js_debug_port, log_file=log_file)
            if self.js_console_logger.start():
                logger.info(f"✅ JS控制台日志记录器创建成功 (端口: {js_debug_port})")
            else:
                logger.warning("⚠️ JS控制台日志记录器启动失败")
        except Exception as exc:
            logger.error("❌ 创建JS控制台日志记录器失败: %s", exc)
            self.js_console_logger = None

    def cleanup(self):
        """清理资源与日志处理器。"""
        logger.info("开始清理资源...")

        # ✅ 1. 先关闭 WebSocket（让后端注销客户端）
        if self.ws_client:
            try:
                logger.info("正在关闭 WebSocket 连接...")
                self.ws_client.close()
                logger.info("WebSocket 已关闭")
            except Exception as e:
                logger.error(f"关闭 WebSocket 失败: {e}")

        # ✅ 2. 再关闭窗口（避免应用提前退出）
        if self.window:
            try:
                logger.info("正在关闭窗口...")
                self.window.close()
                logger.info("窗口已关闭")
            except Exception as e:
                logger.error(f"关闭窗口失败: {e}")

        # 清理 JS 控制台日志记录器
        if self.js_console_logger:
            try:
                self.js_console_logger.stop()
            except Exception:
                pass

        # 刷新并关闭所有日志处理器
        try:
            for handler in logging.getLogger().handlers:
                if hasattr(handler, 'flush'):
                    handler.flush()
            logging.shutdown()
        except Exception:
            pass


def resolve_production_index(base: Path) -> Path | None:
    """解析生产模式下的入口 index.html 路径。

    按以下优先级查找：
    1) base/pdf-home/index.html（适用于 dist/latest 作为 base）
    2) base/dist/latest/pdf-home/index.html（适用于在仓库根以 --prod 启动）
    3) base/dist/pdf-home/index.html
    4) base/pdf-home.html（扁平化单文件备选）
    5) base/dist/latest/pdf-home.html
    6) base/dist/pdf-home.html
    找到则返回路径，否则返回 None。
    """
    candidates = [
        base / 'pdf-home' / 'index.html',
        base / 'dist' / 'latest' / 'pdf-home' / 'index.html',
        base / 'dist' / 'pdf-home' / 'index.html',
        base / 'pdf-home.html',
        base / 'dist' / 'latest' / 'pdf-home.html',
        base / 'dist' / 'pdf-home.html',
    ]
    for p in candidates:
        try:
            if p.exists():
                return p
        except Exception:
            continue
    return None


    def _setup_websocket(self, msgCenter_port: int):
        """设置WebSocket连接（不使用QWebChannel）"""
        try:
            logger.info("开始初始化WebSocket连接...")
            ws_url = QUrl(f"ws://127.0.0.1:{msgCenter_port}")

            # 设置WebSocket事件处理器
            self.ws_client.connected.connect(lambda: logger.info(f"WebSocket连接成功到: {ws_url.toString()}"))
            self.ws_client.disconnected.connect(lambda: logger.info(f"WebSocket断开连接从: {ws_url.toString()}"))
            self.ws_client.error.connect(lambda error: logger.warning(f"WebSocket发生错误: {error}"))

            # 开始WebSocket连接
            self.ws_client.open(ws_url)
            logger.info(f"WebSocket连接已启动到: {ws_url.toString()}")

        except Exception as exc:
            logger.error("WebSocket初始化失败: %s", exc, exc_info=True)
            raise

    def _setup_qwebchannel(self):
        """设置 QWebChannel 桥接"""
        try:
            logger.info("[QWebChannel] 开始初始化 QWebChannel...")

            # 创建 QWebChannel 实例
            channel = QWebChannel(self.window)
            logger.info("[QWebChannel] QWebChannel 创建成功")

            # 创建 PyQtBridge 实例
            self.pyqt_bridge = PyQtBridge(self.window, is_prod=self.config.is_prod)
            logger.info("[QWebChannel] PyQtBridge 创建成功")

            # 注册 PyQtBridge 到 QWebChannel
            channel.registerObject('pyqtBridge', self.pyqt_bridge)
            logger.info("[QWebChannel] PyQtBridge 注册到 QWebChannel 成功")

            # 设置 WebChannel 到 WebPage
            if self.window.web_page:
                self.window.web_page.setWebChannel(channel)
                logger.info("[QWebChannel] QWebChannel 设置到 WebPage 成功")
            else:
                logger.warning("[QWebChannel] window.web_page 不存在，无法设置 QWebChannel")

            logger.info("[QWebChannel] QWebChannel 初始化完成")

        except Exception as exc:
            logger.error("[QWebChannel] 初始化失败: %s", exc, exc_info=True)
            logger.error("[QWebChannel] 错误类型: %s", type(exc).__name__)
            logger.error("[QWebChannel] 错误详情: %s", str(exc))
            raise

    def _create_js_logger(self, js_debug_port: int, log_file: str):
        """创建JS控制台日志记录器实例."""
        logger.info("创建JS控制台日志记录器...")

        try:
            self.js_console_logger = JSConsoleLogger(
                debug_port=js_debug_port,
                log_file=log_file
            )

            if self.js_console_logger.start():
                logger.info(f"✅ JS控制台日志记录器创建成功 (兼容端口: {js_debug_port})")
                logger.info("📝 JavaScript控制台输出将通过Qt javaScriptConsoleMessage捕获")
            else:
                logger.warning("⚠️  JS控制台日志记录器启动失败")

        except Exception as exc:
            logger.error(f"❌ 创建JS控制台日志记录器失败: {exc}")
            self.js_console_logger = None

    def cleanup(self):
        """Clean up resources and ensure all logging handlers are flushed."""
        logger.info("开始清理资源...")

        # 关闭WebSocket连接
        if self.ws_client:
            try:
                self.ws_client.close()
                logger.info("WebSocket连接已关闭")
            except Exception as exc:
                logger.error("关闭WebSocket连接失败: %s", exc, exc_info=True)

        # 停止JS日志记录器
        if self.js_console_logger:
            try:
                self.js_console_logger.stop()
                logger.info("JS控制台日志记录器已停止")
            except Exception as exc:
                logger.error("停止JS控制台日志记录器失败: %s", exc, exc_info=True)

        # 强制刷新并关闭日志处理器
        try:
            # 确保所有日志都被写入文件
            for handler in logging.getLogger().handlers:
                if hasattr(handler, 'flush'):
                    handler.flush()
            logger.info("日志处理器已刷新")

            # logging.shutdown() closes all handlers registered with the root logger
            # It should be sufficient to ensure pdf-home.log is written.
            logging.shutdown()

        except Exception as exc:
            # 这里不能使用logger，因为可能已经关闭
            print(f"清理日志系统失败: {exc}")
            import traceback
            traceback.print_exc()

        print("资源清理完成")


def main() -> int:
    """
    CLI 入口函数（向后兼容）

    从命令行参数创建配置并启动 pdf-home（子进程模式）
    """
    # 解析命令行参数
    args = _parse_args(sys.argv[1:])

    # 构造配置对象
    config = LaunchConfig.from_args(args)

    # 创建并运行应用（子进程模式）
    app_instance = PdfHomeApp(config, parent_app=None)
    return app_instance.run()


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
