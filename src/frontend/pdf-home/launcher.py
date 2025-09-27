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

from src.qt.compat import QApplication, QUrl, QWebChannel, QWebSocket
# 使用本地MainWindow模块
from main_window import MainWindow

# Import PdfHomeBridge and JSConsoleLogger from current directory
import importlib.util
current_dir = Path(__file__).parent
bridge_spec = importlib.util.spec_from_file_location("pdf_home_bridge", current_dir / "pdf_home_bridge.py")
bridge_module = importlib.util.module_from_spec(bridge_spec)
bridge_spec.loader.exec_module(bridge_module)
PdfHomeBridge = bridge_module.PdfHomeBridge

# Import JS Console Logger
logger_spec = importlib.util.spec_from_file_location("js_console_logger", current_dir / "js_console_logger.py")
logger_module = importlib.util.module_from_spec(logger_spec)
logger_spec.loader.exec_module(logger_module)
JSConsoleLogger = logger_module.JSConsoleLogger

# Simplified get_vite_port function for standalone launcher


logger = logging.getLogger("pdf-home.launcher")




def _get_js_log_path() -> Path:
    return project_root / 'logs' / 'pdf-home-js.log'

def get_vite_port():
    """Get Vite port from npm-dev-vite.log file or return default.
    Reads the actual running Vite port from log file.
    """
    import re

    # Try to read from npm-dev-vite.log first
    log_file_path = Path(__file__).parent.parent.parent.parent / 'logs' / 'npm-dev-vite.log'

    try:
        if log_file_path.exists():
            with open(log_file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Look for "Local: http://localhost:PORT/" pattern
            match = re.search(r'Local:\s+http://localhost:(\d+)/', content)
            if match:
                port = int(match.group(1))
                logger.info("Found Vite port %d from npm-dev-vite.log", port)
                return port

            # Fallback: look for runtime-ports.json
            ports_file = Path(__file__).parent.parent.parent.parent / 'logs' / 'runtime-ports.json'
            if ports_file.exists():
                with open(ports_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                port = int(data.get('vite_port') or data.get('npm_port') or 3000)
                logger.info("Found Vite port %d from runtime-ports.json", port)
                return port
    except Exception as e:
        logger.warning("Failed to read Vite port from logs: %s", e)

    # Final fallback
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

    def run(self) -> int:
        """Initializes and runs the application."""
        _setup_logging()
        logger.info("Launching pdf-home standalone window")

        # Ports resolution
        args = _parse_args(self.argv[1:])
        vite_json, msgCenter_json, pdfFile_json, extras = _read_runtime_ports()

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

        # 创建MainWindow，传入logger实例
        self.window = MainWindow(self.app, remote_debug_port=js_debug_port, js_log_file=js_log_file, js_logger=self.js_console_logger)

        self.ws_client = QWebSocket()
        self._setup_qwebchannel(msgCenter_port)

        # Load frontend
        url = f"http://localhost:{vite_port}/pdf-home/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
        logger.info("Loading front-end: %s", url)
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

    def _setup_qwebchannel(self, msgCenter_port: int):
        try:
            channel = QWebChannel(self.window)
            bridge = PdfHomeBridge(self.ws_client, self.window)
            channel.registerObject('pdfHomeBridge', bridge)
            if self.window.web_page:
                self.window.web_page.setWebChannel(channel)
            logger.info("QWebChannel initialized and pdfHomeBridge registered")

            ws_url = QUrl(f"ws://127.0.0.1:{msgCenter_port}")
            self.ws_client.connected.connect(lambda: logger.info(f"WebSocket connected to {ws_url.toString()}"))
            self.ws_client.disconnected.connect(lambda: logger.info(f"WebSocket disconnected from {ws_url.toString()}"))
            self.ws_client.error.connect(lambda error: logger.warning(f"WebSocket error: {error}"))
            self.ws_client.open(ws_url)
            logger.info(f"WebSocket connection initiated to {ws_url.toString()}")
        except Exception as exc:
            logger.warning("Failed to initialize QWebChannel bridge: %s", exc)

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
        if self.ws_client:
            self.ws_client.close()
        if self.js_console_logger:
            self.js_console_logger.stop()

        # Explicitly flush and close handlers in the root logger (and this launcher's logger)
        try:
            # logging.shutdown() closes all handlers registered with the root logger
            # It should be sufficient to ensure pdf-home.log is written.
            logging.shutdown()
        except Exception as exc:
            logger.warning("Failed to perform logging.shutdown(): %s", exc)
            
        logger.info("Cleaned up resources.")


def main() -> int:
    """Main entry point for standalone execution."""
    app_instance = PdfHomeApp(sys.argv)
    return app_instance.run()


if __name__ == '__main__':
    sys.exit(main())
