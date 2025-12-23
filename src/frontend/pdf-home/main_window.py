"""
PDF-Home主窗口模块

集成JavaScript控制台日志记录功能的主窗口实现。
自动将javaScriptConsoleMessage传递给JSConsoleLogger进行处理。
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional
import logging
logger = logging.getLogger('pdf-home.main_window')

from src.qt.compat import (
    QMainWindow, QVBoxLayout, QWidget, QStatusBar,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QUrl, pyqtSignal, QAction, QSizePolicy
)
from src.frontend.pyqtui.js_console_logger import BaseLoggingWebPage
import importlib


class PdfHomeLoggingWebPage(BaseLoggingWebPage):
    """
    pdf-home 专用的日志页面：
    - 继承统一的 BaseLoggingWebPage（负责 UTF-8 + \\n 写入与 js_logger 透传）；
    - 额外过滤特定心跳类日志消息，避免噪音污染 pdf-home-js 日志。
    """

    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore[override]
        # 过滤掉早期 Bridge 的心跳确认日志
        if "Console log recorded successfully" in str(message):
            return None
        return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)


class MainWindow(QMainWindow):
    """PDF-Home主窗口"""
    send_debug_message_requested = pyqtSignal()
    web_loaded = pyqtSignal()
    window_closing = pyqtSignal()  # 窗口关闭信号，用于触发生命周期管理清理

    def __init__(self, app, remote_debug_port: int | None = None, js_log_file: str | None = None, js_logger=None, stop_backend_on_close: bool = True):
        """初始化主窗口

        Args:
            app: QApplication实例
            remote_debug_port: 远程调试端口
            js_log_file: JS日志文件路径
            js_logger: JSConsoleLogger实例（可选）
            stop_backend_on_close: 窗口关闭时是否停止后端服务（默认True）
        """
        super().__init__()
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9222
        self.stop_backend_on_close = stop_backend_on_close  # 后端服务停止开关
        # 若未显式传入日志文件，则使用默认路径 logs/pdf-home-js.log（UTF-8）
        if js_log_file:
            self._js_log_file = js_log_file
        else:
            try:
                default_logs = Path(__file__).parent.parent.parent.parent / 'logs'
                default_logs.mkdir(parents=True, exist_ok=True)
                self._js_log_file = str(default_logs / 'pdf-home-js.log')
            except Exception:
                self._js_log_file = None
        self.js_logger = js_logger  # 简化版Logger实例

        # 管理由本窗口打开的 pdf-viewer 窗口（pdf_id -> ViewerMainWindow 实例）
        self.viewer_windows: dict[str, object] = {}

        # 窗口属性
        self.setWindowTitle("Anki LinkMaster PDFJS")
        self.setGeometry(100, 100, 1200, 800)

        # 使用完全无边框窗口（用HTML自定义所有窗口控制按钮）
        from src.frontend.common.pyqt.window_style import apply_frameless_window_flags
        apply_frameless_window_flags(self, logger, label="pdf-home")

        # QtWebEngine Inspector设置
        self.inspector_window = None

        # 初始化UI
        logger.info('MainWindow.__init__ start, remote_debug_port=%s', self._remote_debug_port)
        self._init_ui()
        # self._init_menu()  # 已移除调试菜单栏
        self._init_status_bar()
        logger.info('MainWindow.__init__ done')

    def set_js_logger(self, js_logger):
        """设置JS日志记录器实例"""
        self.js_logger = js_logger

    def _init_ui(self):
        """初始化用户界面"""
        # 启用远程调试端口 - 必须在创建WebEngineView之前设置
        import os
        os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = str(self._remote_debug_port)

        # 选择可用的 WebEngine 类（本地变量，不污染模块级绑定）
        view_cls = QWebEngineView
        page_cls = QWebEnginePage
        settings_cls = QWebEngineSettings

        try:
            if (view_cls is None) or (page_cls is None) or (settings_cls is None):
                _compat = importlib.import_module('src.qt.compat')
                _view = getattr(_compat, 'QWebEngineView', None)
                _page = getattr(_compat, 'QWebEnginePage', None)
                _settings = getattr(_compat, 'QWebEngineSettings', None)
                if _view and _page and _settings:
                    view_cls, page_cls, settings_cls = _view, _page, _settings
                    logger.info('Refreshed WebEngine bindings from compat (late-binding)')
                if (view_cls is None) or (page_cls is None) or (settings_cls is None):
                    try:
                        from PyQt6.QtWebEngineWidgets import QWebEngineView as _DirectView  # type: ignore
                        from PyQt6.QtWebEngineCore import QWebEngineSettings as _DirectSettings, QWebEnginePage as _DirectPage  # type: ignore
                        view_cls, page_cls, settings_cls = _DirectView, _DirectPage, _DirectSettings
                        logger.info('Direct-imported WebEngine classes from PyQt6 (fallback)')
                    except Exception as _e:
                        logger.warning('Direct PyQt6 WebEngine import failed: %s', _e)
        except Exception:
            pass

        # 创建WebEngine视图
        self.web_view = view_cls() if view_cls else None
        logger.info('WebView created? %s', bool(self.web_view))
        if self.web_view:
            try:
                self.web_view.loadStarted.connect(self._on_load_started)
                self.web_view.loadProgress.connect(self._on_load_progress)
            except Exception:
                pass
            self.web_view.loadFinished.connect(self._on_web_loaded)
            # 设置大小策略，确保自适应窗口大小变化
            self.web_view.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        # 设置开发者工具属性
        if self.web_view and settings_cls:
            settings = self.web_view.settings()
            settings.setAttribute(settings_cls.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(settings_cls.WebAttribute.LocalStorageEnabled, True)

        # 设置安全选项
        if self.web_view and settings_cls:
            settings.setAttribute(settings_cls.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(settings_cls.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(settings_cls.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(settings_cls.WebAttribute.JavascriptCanAccessClipboard, False)
            settings.setAttribute(settings_cls.WebAttribute.XSSAuditingEnabled, True)

        # 创建自定义页面：基于统一的 BaseLoggingWebPage，并叠加 pdf-home 特有的过滤规则
        if self.web_view and page_cls:
            self.web_page = PdfHomeLoggingWebPage(self.web_view, self._js_log_file, self.js_logger, pdf_id="pdf-home")
            self.web_view.setPage(self.web_page)
            logger.info('WebPage created and set on WebView (PdfHomeLoggingWebPage)')
        else:
            self.web_page = None
            logger.warning('WebPage is None (either no WebView or no QWebEnginePage)')

        # 设置主布局
        layout = QVBoxLayout()
        # 设置布局边距为0，确保WebView占满整个窗口
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        if self.web_view:
            layout.addWidget(self.web_view)
        else:
            logger.warning('No WebView added to layout')

        # 创建中心部件
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

        # 设置窗口最小尺寸
        self.setMinimumSize(800, 600)

    # def _init_menu(self):
    #     """初始化菜单栏（已移除 - 使用HTML自定义标题栏）"""
    #     menubar = self.menuBar()
    #     debug_menu = menubar.addMenu('调试,通过ws发送消息到前端')
    #     debug_action = QAction('发送消息', self)
    #     debug_action.triggered.connect(self.send_debug_message_requested.emit)
    #     debug_menu.addAction(debug_action)
    #
    #     # 文件菜单
    #     file_menu = menubar.addMenu('文件')

    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage('准备就绪')

    def _on_web_loaded(self, success: bool):
        """网页加载完成处理"""
        logger.info('WebView loadFinished: success=%s', success)
        if success:
            self.status_bar.showMessage('页面加载完成')
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage('页面加载失败')

    def _on_load_started(self):
        try:
            logger.info('WebView loadStarted')
        except Exception:
            pass

    def _on_load_progress(self, value: int):
        try:
            logger.info('WebView loadProgress: %s', value)
        except Exception:
            pass

    def load_frontend(self, url: str):
        """加载前端URL"""
        if self.web_view:
            logger.info('load_frontend called with url=%s', url)
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f'正在加载: {url}')
        else:
            logger.error('load_frontend: WebView is None, cannot load URL')

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
        """窗口关闭事件 - 先关闭由本窗口打开的 pdf-viewer，再清理前端进程跟踪信息"""
        import json
        from pathlib import Path
        from datetime import datetime

        try:
            # 先尝试关闭所有由 pdf-home 打开的 pdf-viewer 窗口
            try:
                if getattr(self, 'viewer_windows', None):
                    for k, win in list(self.viewer_windows.items()):
                        try:
                            # 记录一条日志到 logs/window-close.log
                            log_path = Path(__file__).parent.parent.parent.parent / 'logs' / 'window-close.log'
                            log_path.parent.mkdir(parents=True, exist_ok=True)
                            ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                            with open(log_path, 'a', encoding='utf-8', newline='\n') as f:
                                f.write(f"[{ts}] [pdf-home] 关闭子窗口: pdf-viewer({k})\n")
                        except Exception:
                            pass
                        try:
                            win.close()
                        except Exception:
                            pass
                    try:
                        self.viewer_windows.clear()
                    except Exception:
                        pass
            except Exception:
                pass

            # 获取项目根目录
            project_root = Path(__file__).parent.parent.parent.parent

            # 从 frontend-process-info.json 中移除当前窗口的 PID
            try:
                frontend_info_path = project_root / 'logs' / 'frontend-process-info.json'
                if frontend_info_path.exists():
                    with open(frontend_info_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # 从 frontend 记录中移除 pdf-home
                    if 'frontend' in data and isinstance(data['frontend'], dict):
                        if 'pdf-home' in data['frontend']:
                            del data['frontend']['pdf-home']
                            print(f"[MainWindow] 已从跟踪列表中移除当前窗口")

                    # 写回文件
                    with open(frontend_info_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"[MainWindow] 清理前端进程信息失败: {e}")

        except Exception as e:
            print(f"[MainWindow] 清理过程失败: {e}")
        finally:
            try:
                if hasattr(self, "window_closing"):
                    self.window_closing.emit()
            except Exception:
                pass
            # 接受关闭事件，让窗口优雅关闭
            event.accept()
