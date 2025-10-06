"""
MainWindow for PDF-Viewer - 集成JSConsoleLogger

这个版本的MainWindow会将javaScriptConsoleMessage自动传递给
JSConsoleLogger，实现完整的JS控制台日志记录功能，
并支持pdf_id动态命名。
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from src.qt.compat import (
    QMainWindow, QVBoxLayout, QWidget, QStatusBar,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QUrl, pyqtSignal, QAction, QSizePolicy
)

from src.frontend.pyqtui.main_window import write_js_console_message


class MainWindow(QMainWindow):
    """主窗口 for PDF-Viewer - 集成JSConsoleLogger"""
    send_debug_message_requested = pyqtSignal()
    web_loaded = pyqtSignal()

    def __init__(self, app, remote_debug_port: int | None = None, js_log_file: str | None = None, js_logger=None, pdf_id: str = "empty"):
        """初始化主窗口

        Args:
            app: QApplication实例
            remote_debug_port: 远程调试端口
            js_log_file: JS日志文件路径
            js_logger: JSConsoleLogger实例（可选）
            pdf_id: PDF标识符，用于日志文件命名
        """
        super().__init__()
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9223  # pdf-viewer默认端口
        self._js_log_file = js_log_file
        self.js_logger = js_logger  # 简化版Logger实例
        self.pdf_id = pdf_id

        # 窗口属性
        self.setWindowTitle(f"Anki LinkMaster PDF Viewer - {pdf_id}")
        self.setGeometry(100, 100, 1200, 800)

        # QtWebEngine Inspector设置
        self.inspector_window = None

        # 初始化UI
        self._init_ui()
        self._init_menu()
        self._init_status_bar()

    def set_js_logger(self, js_logger):
        """设置JS日志记录器实例"""
        self.js_logger = js_logger
        # 同时更新WebPage中的引用
        if hasattr(self, 'web_page') and self.web_page and hasattr(self.web_page, 'js_logger'):
            self.web_page.js_logger = js_logger

    def _init_ui(self):
        """初始化用户界面"""
        # 启用远程调试端口 - 必须在创建WebEngineView之前设置
        import os
        os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = str(self._remote_debug_port)

        # 创建WebEngine视图
        self.web_view = QWebEngineView() if QWebEngineView else None
        if self.web_view:
            self.web_view.loadFinished.connect(self._on_web_loaded)
            # 设置大小策略，确保自适应窗口大小变化
            self.web_view.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        # 设置开发者工具属性
        if self.web_view and QWebEngineSettings:
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)

        # 设置安全选项
        if self.web_view and QWebEngineSettings:
            settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.XSSAuditingEnabled, True)

        # 创建增强版自定义页面
        if self.web_view and QWebEnginePage:
            try:
                from PyQt6.QtWebEngineCore import QWebEnginePage as _QWEP  # type: ignore
            except Exception:
                _QWEP = QWebEnginePage

            class EnhancedLoggingWebPage(_QWEP):
                def __init__(self, parent, log_file_path: str | None, js_logger=None, pdf_id: str = "empty"):
                    super().__init__(parent)
                    self._log_file_path = log_file_path
                    self.js_logger = js_logger
                    self.pdf_id = pdf_id

                    try:
                        if self._log_file_path:
                            import os as _os
                            _os.makedirs(_os.path.dirname(self._log_file_path), exist_ok=True)
                    except Exception:
                        pass

                def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore
                    """增强版控制台消息处理"""
                    # 1. 写入到文件（保持原有功能）
                    write_js_console_message(
                        self._log_file_path,
                        level=str(level),
                        message=str(message),
                        line_number=lineNumber,
                        source_id=str(sourceID),
                    )

                    # 2. 同时传递给Logger（新增功能）
                    if self.js_logger and hasattr(self.js_logger, 'log_message'):
                        try:
                            self.js_logger.log_message(
                                level=str(level),
                                message=str(message),
                                source=str(sourceID) if sourceID else "",
                                line=lineNumber
                            )
                        except Exception as e:
                            print(f"Warning: Failed to pass message to js_logger (pdf_id: {self.pdf_id}): {e}")

                    try:
                        return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)  # type: ignore
                    except Exception:
                        return None

            self.web_page = EnhancedLoggingWebPage(self.web_view, self._js_log_file, self.js_logger, self.pdf_id)
            self.web_view.setPage(self.web_page)
        else:
            self.web_page = None

        # 设置主布局
        layout = QVBoxLayout()
        # 设置布局边距为0，确保WebView占满整个窗口
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        if self.web_view:
            layout.addWidget(self.web_view)

        # 创建中心部件
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

        # 设置窗口最小尺寸
        self.setMinimumSize(800, 600)

    def _init_menu(self):
        """初始化菜单栏"""
        menubar = self.menuBar()
        debug_menu = menubar.addMenu('调试（PDF-Viewer）')
        debug_action = QAction(f'发送消息 (pdf_id: {self.pdf_id})', self)
        debug_action.triggered.connect(self.send_debug_message_requested.emit)
        debug_menu.addAction(debug_action)

        # 文件菜单
        file_menu = menubar.addMenu('文件')

    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage(f'准备就绪 (PDF: {self.pdf_id})')

    def _on_web_loaded(self, success: bool):
        """网页加载完成处理"""
        if success:
            # 注入qwebchannel.js脚本以支持QWebChannel
            if self.web_view and self.web_view.page():
                script = """
                (function() {
                    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
                        var script = document.createElement('script');
                        script.src = 'qrc:///qtwebchannel/qwebchannel.js';
                        script.onload = function() {
                            console.log('[MainWindow] qwebchannel.js loaded successfully');
                        };
                        script.onerror = function() {
                            console.error('[MainWindow] Failed to load qwebchannel.js');
                        };
                        document.head.appendChild(script);
                    } else {
                        console.warn('[MainWindow] qt.webChannelTransport not available');
                    }
                })();
                """
                self.web_view.page().runJavaScript(script)

            self.status_bar.showMessage(f'页面加载完成 (PDF: {self.pdf_id})')
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage(f'页面加载失败 (PDF: {self.pdf_id})')

    def load_frontend(self, url: str):
        """加载前端URL"""
        if self.web_view:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f'正在加载: {url} (PDF: {self.pdf_id})')

    def update_js_logger_reference(self):
        """更新WebPage中的js_logger引用"""
        if self.web_page and hasattr(self.web_page, 'js_logger'):
            self.web_page.js_logger = self.js_logger

    def resizeEvent(self, event):
        """窗口大小调整事件"""
        super().resizeEvent(event)
        # 确保WebView正确响应窗口大小变化
        if self.web_view:
            # 强制更新布局
            self.web_view.updateGeometry()

    def closeEvent(self, event):
        """窗口关闭事件 - 停止后台服务（但不杀掉窗口自己）"""
        import subprocess
        import sys
        import json
        from pathlib import Path
        from datetime import datetime

        # 创建日志函数，同时输出到控制台和文件
        def log_message(msg):
            print(msg, flush=True)  # 强制刷新输出
            try:
                log_path = Path(__file__).parent.parent.parent.parent / 'logs' / 'window-close.log'
                log_path.parent.mkdir(parents=True, exist_ok=True)
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"[{timestamp}] {msg}\n")
            except:
                pass

        log_message(f"[MainWindow-{self.pdf_id}] closeEvent触发，开始清理...")

        try:
            # 获取项目根目录 (main_window.py -> pyqt -> pdf-viewer -> frontend -> src -> 项目根目录)
            project_root = Path(__file__).parent.parent.parent.parent.parent
            log_message(f"[MainWindow-{self.pdf_id}] 项目根目录: {project_root}")

            # 第一步：从 frontend-process-info.json 中移除当前窗口的记录
            # 这样 ai_launcher.py stop 就不会杀掉窗口自己
            try:
                frontend_info_path = project_root / 'logs' / 'frontend-process-info.json'
                log_message(f"[MainWindow-{self.pdf_id}] 检查文件: {frontend_info_path}")

                if frontend_info_path.exists():
                    with open(frontend_info_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # 从 frontend 记录中移除 pdf-viewer 相关的实例
                    # pdf-viewer 使用 pdf-viewer-{pdf_id} 作为键名
                    if 'frontend' in data and isinstance(data['frontend'], dict):
                        # 查找并移除所有包含当前pdf_id的键
                        keys_to_remove = [
                            key for key in data['frontend'].keys()
                            if key.startswith('pdf-viewer') and self.pdf_id in key
                        ]
                        for key in keys_to_remove:
                            del data['frontend'][key]
                            log_message(f"[MainWindow-{self.pdf_id}] 已从跟踪列表中移除窗口: {key}")

                    # 写回文件
                    with open(frontend_info_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    log_message(f"[MainWindow-{self.pdf_id}] ✓ 清理前端进程信息成功")
                else:
                    log_message(f"[MainWindow-{self.pdf_id}] 文件不存在，跳过清理")
            except Exception as e:
                log_message(f"[MainWindow-{self.pdf_id}] ✗ 清理前端进程信息失败: {e}")

            # 第二步：调用 ai_launcher.py stop 停止后台服务
            ai_launcher_path = project_root / 'ai_launcher.py'
            if ai_launcher_path.exists():
                log_message(f"[MainWindow-{self.pdf_id}] 正在停止后端服务...")
                result = subprocess.run(
                    [sys.executable, str(ai_launcher_path), 'stop'],
                    cwd=str(project_root),
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                if result.returncode == 0:
                    log_message(f"[MainWindow-{self.pdf_id}] ✓ 后端服务已停止")
                else:
                    log_message(f"[MainWindow-{self.pdf_id}] ✗ 停止后端服务失败 (code={result.returncode})")
                    if result.stderr:
                        log_message(f"[MainWindow-{self.pdf_id}] 错误输出: {result.stderr[:200]}")
            else:
                log_message(f"[MainWindow-{self.pdf_id}] ✗ 未找到 ai_launcher.py: {ai_launcher_path}")

        except subprocess.TimeoutExpired:
            log_message(f"[MainWindow-{self.pdf_id}] ✗ 停止服务超时")
        except Exception as e:
            log_message(f"[MainWindow-{self.pdf_id}] ✗ 关闭窗口时发生错误: {e}")
            import traceback
            log_message(f"[MainWindow-{self.pdf_id}] 堆栈: {traceback.format_exc()}")

        log_message(f"[MainWindow-{self.pdf_id}] closeEvent完成，窗口即将关闭")

        # 接受关闭事件
        event.accept()
