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

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.qt.compat import QApplication, QUrl, QWebSocket, QWebChannel
# 使用本地MainWindow模块
from main_window import MainWindow

# Import PyQtBridge and JSConsoleLogger from current directory
import importlib.util
current_dir = Path(__file__).parent

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




def _get_js_log_path() -> Path:
    return project_root / 'logs' / 'pdf-home-js.log'

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
    # Use project root for logs directory
    logs_dir = project_root / 'logs'
    os.makedirs(logs_dir, exist_ok=True)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.FileHandler(logs_dir / 'pdf-home.log', encoding='utf-8', mode='w'),
            logging.StreamHandler(sys.stdout),
        ],
    )


class PdfHomeApp:
    """Encapsulates the pdf-home application logic."""

    def __init__(self, argv: list[str] | None = None):
        self.argv = argv if argv is not None else sys.argv
        self.app = QApplication(self.argv)
        self.window = None
        self.ws_client = None
        self.js_console_logger = None
        self.pyqt_bridge = None

    def run(self) -> int:
        """Initializes and runs the application."""
        _setup_logging()
        logger.info("Launching pdf-home standalone window")

        # Ports resolution
        args = _parse_args(self.argv[1:])
        vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports(project_root)

        vite_port = args.vite_port or vite_json
        if not args.vite_port:
            try:
                vite_port = get_vite_port() or vite_port
            except Exception:
                pass

        msgCenter_port = args.msgCenter_port or msgCenter_json
        pdfFile_port = args.pdfFile_port or pdfFile_json
        js_debug_port = args.js_debug_port or int(extras.get("pdf-home-js", 9222))

        logger.info("Resolved ports: vite=%s msgCenter=%s pdfFile=%s", vite_port, msgCenter_port, pdfFile_port)
        logger.info("JS remote debug port: %s", js_debug_port)

        # Persist ports
        extras["pdf-home-js"] = js_debug_port
        if not args.no_persist:
            self._persist_ports(vite_port, msgCenter_port, pdfFile_port, extras)

        # Setup main window and bridges
        js_log_file = str(_get_js_log_path())

        # 先创建JS Logger
        self._create_js_logger(js_debug_port, js_log_file)

        # 创建MainWindow，传入logger实例和后端停止开关
        # 如果使用 --keep-backend 参数，则设置 stop_backend_on_close=False
        stop_backend = not args.keep_backend  # 默认True，使用--keep-backend时为False
        self.window = MainWindow(
            self.app,
            remote_debug_port=js_debug_port,
            js_log_file=js_log_file,
            js_logger=self.js_console_logger,
            stop_backend_on_close=stop_backend
        )

        # 创建WebSocket客户端（不使用QWebChannel，直接用于前后端通信）
        self.ws_client = QWebSocket()
        self._setup_websocket(msgCenter_port)

        # 设置 QWebChannel（用于 PyQt 和 JS 之间的桥接）
        self._setup_qwebchannel()

        # Load frontend (dev vs prod)
        is_prod = bool(os.environ.get("APP_ENV") == "production" or os.environ.get("PDFJS_ENV") == "production" or os.environ.get("ENV") == "production" or args.prod)

        if is_prod:
            # 生产模式：通过 pdfFile_server 提供静态资源
            # ⚠️ 必须添加查询参数，让前端能正确解析 WebSocket 端口
            # ⚠️ 添加时间戳参数以破坏 PyQt WebView 缓存
            import time
            cache_buster = int(time.time() * 1000)  # 毫秒级时间戳
            # 为避免生产构建下可能存在的多入口产物（嵌套 index.html）被顶层 index 覆盖的问题
            # 直接指向嵌套入口 /pdf-home/pdf-home/ ，确保引用到与本模块对应的最新 assets
            http_url = f"http://127.0.0.1:{pdfFile_port}/pdf-home/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}&_={cache_buster}"
            logger.info("Loading front-end (prod http): %s", http_url)
            self.window.load_frontend(http_url)
        else:
            url = f"http://localhost:{vite_port}/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
            logger.info("Loading front-end (dev): %s", url)
            self.window.load_frontend(url)
        self.window.show()

        rc = self.app.exec()
        logger.info("pdf-home window exited with code %s", rc)
        self.cleanup()
        return rc

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
            self.pyqt_bridge = PyQtBridge(self.window)
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
            self.pyqt_bridge = PyQtBridge(self.window)
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
    """Main entry point for standalone execution."""
    app_instance = PdfHomeApp(sys.argv)
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
