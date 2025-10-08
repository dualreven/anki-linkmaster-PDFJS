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
import logging
import argparse
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.qt.compat import QApplication, QUrl, QWebChannel, QWebSocket
# 使用MainWindow支持JS日志记录
from pyqt.main_window import MainWindow

# Import PdfViewerBridge and JSConsoleLogger from pyqt directory
import importlib.util
pyqt_dir = Path(__file__).parent / "pyqt"
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
    logs_dir = project_root / 'logs'
    python_log = str(logs_dir / f'pdf-viewer-{pdf_id}.log')
    js_log = str(logs_dir / f'pdf-viewer-{pdf_id}-js.log')
    return python_log, js_log


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
    parser = argparse.ArgumentParser(description="pdf-viewer standalone launcher")
    parser.add_argument("--vite-port", type=int, dest="vite_port", help="Vite dev server port")
    parser.add_argument("--msgCenter-port", type=int, dest="msgCenter_port", help="消息中心服务器端口")
    parser.add_argument("--pdfFile-port", type=int, dest="pdfFile_port", help="PDF文件服务器端口")
    parser.add_argument("--js-debug-port", type=int, dest="js_debug_port", help="Remote debugging port for PDF-Viewer JS (QTWEBENGINE)")
    parser.add_argument("--no-persist", action="store_true", help="Do not persist ports back to logs/runtime-ports.json")
    parser.add_argument("--file-path", type=str, dest="file_path", help="PDF file path to load automatically")
    parser.add_argument("--pdf-id", type=str, dest="pdf_id", help="PDF ID to resolve to file path")
    parser.add_argument("--page-at", type=int, dest="page_at", help="Target page number to navigate to (1-based index)")
    parser.add_argument("--position", type=float, dest="position", help="Vertical position percentage within the page (0-100)")
    parser.add_argument("--anchor-id", type=str, dest="anchor_id", help="Anchor ID (e.g., pdfanchor-test or pdfanchor-<12-hex>)")
    parser.add_argument("--pdfanchor", type=str, dest="pdfanchor", help="Alias of --anchor-id for convenience")
    parser.add_argument("--diagnose-only", action="store_true", help="Run initialization diagnostics and exit before starting the Qt event loop")
    parser.add_argument("--disable-webchannel", action="store_true", help="Skip QWebChannel bridge setup")
    parser.add_argument("--disable-websocket", action="store_true", help="Skip QWebSocket bridge connection")
    parser.add_argument("--disable-js-console", action="store_true", help="Skip JavaScript console logger thread")
    parser.add_argument("--disable-frontend-load", action="store_true", help="Skip loading the front-end URL into the WebEngine view")
    ns = parser.parse_args(argv)
    # Normalize alias: --pdfanchor → --anchor-id
    if getattr(ns, 'pdfanchor', None) and not getattr(ns, 'anchor_id', None):
        setattr(ns, 'anchor_id', ns.pdfanchor)
    return ns


def _setup_logging(pdf_id: str = "empty") -> None:
    """设置日志系统，支持动态PDF ID命名.

    Args:
        pdf_id: PDF标识符，用于生成日志文件名
    """
    # Use project root for logs directory
    logs_dir = project_root / 'logs'
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


def main() -> int:
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
    window = MainWindow(
        app,
        remote_debug_port=js_debug_port,
        js_log_file=js_log,
        js_logger=js_console_logger,
        pdf_id=pdf_id
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

        def on_connected():
            logger.info("WebSocket connected to %s", ws_url.toString())
            if bridge and file_path:
                bridge.loadPdfFile(file_path)

        def on_disconnected():
            logger.info("WebSocket disconnected from %s", ws_url.toString())

        def on_error(error):
            logger.warning("WebSocket error: %s", error)

        ws_client.connected.connect(on_connected)
        ws_client.disconnected.connect(on_disconnected)
        ws_client.error.connect(on_error)

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

    # Prepare front-end URL and optionally load
    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if file_path:
        import urllib.parse
        file_param = urllib.parse.quote(file_path)
        url += f"&file={file_param}"

    # Add URL navigation parameters (for url-navigation Feature)
    if args.pdf_id:
        # 如果使用pdf-id，添加到URL（前端url-navigation Feature会处理）
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
