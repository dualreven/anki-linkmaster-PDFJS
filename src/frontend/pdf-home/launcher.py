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

def _resolve_logs_dir(base: Path) -> Path:
    """解析日志目录，支持通过 logs/gui-launcher-config.json 覆盖（与后端一致）。"""
    try:
        cfg = base / 'logs' / 'gui-launcher-config.json'
        if cfg.exists():
            data = json.loads(cfg.read_text(encoding='utf-8') or '{}')
            logs_dir_decl = ((data.get('paths') or {}).get('logs_dir') or '').strip()
            if logs_dir_decl and logs_dir_decl.lower() not in ('none', 'null', 'undefined'):
                p = Path(logs_dir_decl).expanduser()
                p.mkdir(parents=True, exist_ok=True)
                return p
    except Exception:
        pass
    d = base / 'logs'
    d.mkdir(parents=True, exist_ok=True)
    return d




def _get_js_log_path() -> Path:
    return _resolve_logs_dir(project_root) / 'pdf-home-js.log'


def _ensure_pdf_home_file_logger() -> None:
    """为 pdf-home 系列 logger 增加独立文件输出，避免 Hosted 模式下 basicConfig 被忽略。

    - 日志文件: logs/pdf-home.log（UTF-8）
    - 作用范围: `pdf-home` 及其子 logger（launcher/main_window 等）
    - 不依赖 root logger，防止被后端的 logging.basicConfig 覆盖
    """
    try:
        logs_dir = _resolve_logs_dir(project_root)
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
                fh = logging.FileHandler(log_path, mode='a', encoding='utf-8')
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
        ports_file = Path(__file__).parent.parent.parent.parent / 'logs' / 'runtime-ports.json'
        if ports_file.exists():
            with open(ports_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            port = int(data.get('vite_port') or data.get('npm_port') or 3000)
            logger.info("Found Vite port %d from runtime-ports.json", port)
            return port
    except Exception as e:
        logger.warning("Failed to read Vite port from runtime-ports.json: %s", e)

    # Fallback to default
    logger.info("Using default Vite port 3000")
    return 3000


def _read_runtime_ports(cwd: Path | None = None) -> tuple[int, int, int, dict]:
    """Read logs/runtime-ports.json and return (vite_port, msgCenter_port, pdfFile_port, extras).
    Fallback to (8765, 8080) if missing or malformed.
    """
    try:
        base = Path(cwd) if cwd else Path(os.getcwd())
        cfg_path = base / 'logs' / 'runtime-ports.json'
        if cfg_path.exists():
            data = json.loads(cfg_path.read_text(encoding='utf-8') or '{}')
            vite_port = int(data.get('vite_port') or data.get('npm_port') or 3000)
            msgCenter_port = int(data.get('msgCenter_port') or data.get('ws_port') or 8765)
            pdfFile_port = int(data.get('pdfFile_port') or data.get('pdf_port') or 8080)
            extras = {k: v for k, v in data.items() if k not in ("vite_port", "npm_port", "msgCenter_port", "ws_port", "pdfFile_port", "pdf_port")}
            return vite_port, msgCenter_port, pdfFile_port, extras
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed reading runtime-ports.json: %s", exc)
    return 3000, 8765, 8080, {}


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="pdf-home standalone launcher")
    parser.add_argument("--vite-port", type=int, dest="vite_port", help="Vite dev server port")
    parser.add_argument("--msgCenter-port", type=int, dest="msgCenter_port", help="消息中心服务器端口")
    parser.add_argument("--pdfFile-port", type=int, dest="pdfFile_port", help="PDF文件服务器端口")
    parser.add_argument("--js-debug-port", type=int, dest="js_debug_port", help="Remote debugging port for PDF-Home JS (QTWEBENGINE)")
    parser.add_argument("--no-persist", action="store_true", help="Do not persist ports back to logs/runtime-ports.json")
    parser.add_argument("--prod", action="store_true", help="以生产模式运行，直接从 dist 静态文件加载页面")
    parser.add_argument("--keep-backend", action="store_true", help="窗口关闭时保持后端服务运行（不停止）")
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
        _setup_logging()
        logger.info(f"Launching pdf-home ({self.mode} mode)")

        # 步骤 1: 创建或使用 QApplication
        if self.mode == "subprocess":
            self.app = QApplication(sys.argv)
            logger.info("✅ Created QApplication (subprocess mode)")
        else:
            self.app = self.parent_app
            logger.info("✅ Using parent QApplication (hosted mode)")

        # 步骤 2: 解析端口配置
        vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports(project_root)

        vite_port = self.config.vite_port or vite_json
        if not self.config.vite_port:
            try:
                vite_port = get_vite_port() or vite_port
            except Exception:
                pass

        msgCenter_port = self.config.msgCenter_port or msgCenter_json
        pdfFile_port = self.config.pdfFile_port or pdfFile_json
        js_debug_port = self.config.js_debug_port or int(extras.get("pdf-home-js", 9222))

        logger.info(f"Resolved ports: vite={vite_port} msgCenter={msgCenter_port} pdfFile={pdfFile_port}")
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
            self._persist_ports(vite_port, msgCenter_port, pdfFile_port, extras)

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
        url = self._build_frontend_url(vite_port, msgCenter_port, pdfFile_port)
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

    def _build_frontend_url(self, vite_port: int, msgCenter_port: int, pdfFile_port: int) -> str:
        """构建前端 URL"""
        if self.config.is_prod:
            # 生产模式：通过 pdfFile_server 提供静态资源
            import time
            cache_buster = int(time.time() * 1000)
            # 注意：静态资源位于 root/static/pdf-home/index.html
            # 这里的 URL 只应包含一次 "/pdf-home/" 前缀，否则会导致 404
            return f"http://127.0.0.1:{pdfFile_port}/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}&_={cache_buster}"
        else:
            # 开发模式：使用 Vite dev server
            return f"http://localhost:{vite_port}/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"

    def _persist_ports(self, vite_port, msgCenter_port, pdfFile_port, extras):
        try:
            logs_dir = project_root / 'logs'
            logs_dir.mkdir(parents=True, exist_ok=True)
            cfg_path = logs_dir / 'runtime-ports.json'
            payload = {"vite_port": vite_port, "msgCenter_port": msgCenter_port, "pdfFile_port": pdfFile_port, **(extras or {})}
            cfg_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
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
            self.pyqt_bridge = PyQtBridge(self.window, is_prod=self.config.is_prod)
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
        if self.ws_client:
            try:
                self.ws_client.close()
            except Exception:
                pass
        if self.js_console_logger:
            try:
                self.js_console_logger.stop()
            except Exception:
                pass
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
