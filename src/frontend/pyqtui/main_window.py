# -*- coding: utf-8 -*-
"""
主窗口类（PyQt）
- 创建与管理 Hosted 模式下的 pdf-home WebView
- 捕获 JavaScript 控制台输出到 UTF-8 日志（严格使用 \n）
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from src.qt.compat import (
    QMainWindow, QVBoxLayout, QWidget, QStatusBar,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QUrl, pyqtSignal, QAction, QSizePolicy
)


def write_js_console_message(
    log_file_path: str | None,
    *,
    level: str,
    message: str,
    line_number: int,
    source_id: str,
) -> None:
    """将 JS 控制台一行写入日志（UTF-8, \n）。"""
    if not log_file_path:
        return

    try:
        import re
        path = Path(log_file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        parsed_message = str(message)

        # 移除开头时间戳（若已带）
        m_ts = re.match(r"^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*", parsed_message)
        if m_ts:
            parsed_message = parsed_message[m_ts.end():].strip()

        # 提取/折叠日志级别
        m_lv = re.match(r"^\[([A-Z]+)\]\s*", parsed_message)
        if m_lv:
            embedded = m_lv.group(1)
            if embedded in {"INFO", "WARN", "WARNING", "ERROR", "DEBUG", "CRITICAL"}:
                level = "WARN" if embedded == "WARNING" else embedded
                parsed_message = parsed_message[m_lv.end():].strip()
        else:
            _lv = str(level).lower()
            if "javascriptconsolemessagelevel" in _lv:
                for key, mapped in [
                    ("infomessagelevel", "INFO"),
                    ("warningmessagelevel", "WARN"),
                    ("errormessagelevel", "ERROR"),
                    ("criticalmessagelevel", "CRITICAL"),
                ]:
                    if key in _lv:
                        level = mapped
                        break

        # 移除冗余前缀（console level / 源 URL）
        for pat in [
            r"^\[\s*JavaScriptConsoleMessageLevel\.[^\]]+\]\s*",
            r"^\[\s*JAVASCRIPTCONSOLEMESSAGELEVEL\.[^\]]+\]\s*",
            r"^\[\s*(?:https?|file)://[^\]]+\]\s*",
        ]:
            parsed_message = re.sub(pat, "", parsed_message, flags=re.IGNORECASE).strip()

        line = f"[{ts}][{level}] {parsed_message}"
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(line + "\n")
    except Exception:
        # 日志助手不抛出异常，避免干扰主流程
        pass


class MainWindow(QMainWindow):
    """Hosted pdf-home 主窗口"""

    send_debug_message_requested = pyqtSignal()
    web_loaded = pyqtSignal()

    def __init__(self, app, remote_debug_port: int | None = None, js_log_file: str | None = None):
        super().__init__()
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9222
        self._js_log_file = js_log_file

        self.setWindowTitle("Anki LinkMaster PDFJS")
        self.setGeometry(100, 100, 1200, 800)

        self.inspector_window = None

        self._init_ui()
        self._init_menu()
        self._init_status_bar()

    def _init_ui(self):
        """初始化 WebView 与页面"""
        import os
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = str(self._remote_debug_port)

        self.web_view = QWebEngineView() if QWebEngineView else None
        if self.web_view:
            self.web_view.loadFinished.connect(self._on_web_loaded)
            self.web_view.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        if self.web_view and QWebEngineSettings:
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, False)

        if self.web_view and QWebEnginePage:
            try:
                from PyQt6.QtWebEngineCore import QWebEnginePage as _QWEP  # type: ignore
            except Exception:
                _QWEP = QWebEnginePage

            class LoggingWebPage(_QWEP):
                def __init__(self, parent, log_file_path: str | None):
                    super().__init__(parent)
                    self._log_file_path = log_file_path
                    try:
                        if self._log_file_path:
                            import os as _os
                            _os.makedirs(_os.path.dirname(self._log_file_path), exist_ok=True)
                    except Exception:
                        pass

                def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore
                    write_js_console_message(
                        self._log_file_path,
                        level=str(level),
                        message=str(message),
                        line_number=int(lineNumber),
                        source_id=str(sourceID),
                    )
                    try:
                        return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)  # type: ignore
                    except Exception:
                        return None

            self.web_page = LoggingWebPage(self.web_view, self._js_log_file)
            self.web_view.setPage(self.web_page)
        else:
            self.web_page = None

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        if self.web_view:
            layout.addWidget(self.web_view)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

        self.setMinimumSize(800, 600)

    def _init_menu(self):
        menubar = self.menuBar()

        # 调试（示例：通过 WS 发送调试消息）
        debug_menu = menubar.addMenu("调试,通过ws发送消息到前端")
        debug_action = QAction("发送消息", self)
        debug_action.triggered.connect(self.send_debug_message_requested.emit)
        debug_menu.addAction(debug_action)

        file_menu = menubar.addMenu("文件")
        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        view_menu = menubar.addMenu("视图")
        refresh_action = QAction("刷新", self)
        refresh_action.triggered.connect(self.reload_page)
        view_menu.addAction(refresh_action)

        dev_menu = menubar.addMenu("开发者")
        inspector_action = QAction("开发者工具 (F12)", self)
        inspector_action.setShortcut("F12")
        inspector_action.triggered.connect(self.toggle_inspector)
        dev_menu.addAction(inspector_action)

        remote_debug_action = QAction("打开远程调试", self)
        remote_debug_action.triggered.connect(self.open_remote_debug)
        dev_menu.addAction(remote_debug_action)

        console_action = QAction("JavaScript控制台 (Ctrl+Shift+J)", self)
        console_action.setShortcut("Ctrl+Shift+J")
        console_action.triggered.connect(self.open_javascript_console)
        dev_menu.addAction(console_action)

        source_action = QAction("查看页面源码 (Ctrl+U)", self)
        source_action.setShortcut("Ctrl+U")
        source_action.triggered.connect(self.view_page_source)
        dev_menu.addAction(source_action)

    def _init_status_bar(self):
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")

    def load_frontend(self, url: str = "http://localhost:3000/pdf-home/index.html"):
        try:
            if self.web_view:
                self.web_view.load(QUrl(url))
                self.status_bar.showMessage(f"正在加载: {url}")
        except Exception as e:
            self.status_bar.showMessage(f"加载失败: {str(e)}")

    def reload_page(self):
        if self.web_view:
            self.web_view.reload()

    def _on_web_loaded(self, success: bool):
        if success:
            self.status_bar.showMessage("页面加载完成")
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage("页面加载失败")

    def show_error(self, message: str):
        self.status_bar.showMessage(f"错误: {message}")

    def toggle_inspector(self):
        if self.inspector_window is None or not self.inspector_window.isVisible():
            self.show_inspector()
        else:
            self.hide_inspector()

    def show_inspector(self):
        try:
            from PyQt6.QtWebEngineWidgets import QWebEngineView
            from PyQt6.QtWidgets import QMainWindow

            if self.inspector_window is None:
                self.inspector_window = QMainWindow(self)
                self.inspector_window.setWindowTitle("开发者工具")
                self.inspector_window.setGeometry(1300, 100, 800, 600)
                self.inspector_view = QWebEngineView()
                self.inspector_window.setCentralWidget(self.inspector_view)

            self.inspector_window.show()
            self.inspector_window.raise_()
            self.inspector_window.activateWindow()

            self.inspector_view.load(QUrl("http://localhost:9222"))
            self.status_bar.showMessage("开发者工具已打开")
        except Exception as e:
            self.status_bar.showMessage(f"打开开发者工具失败: {str(e)}")

    def hide_inspector(self):
        if self.inspector_window:
            self.inspector_window.hide()
            self.status_bar.showMessage("开发者工具已关闭")

    def open_remote_debug(self):
        import webbrowser
        try:
            webbrowser.open("http://localhost:9222")
            self.status_bar.showMessage("远程调试页面已打开")
        except Exception as e:
            self.status_bar.showMessage(f"打开远程调试失败: {str(e)}")

    def open_javascript_console(self):
        # 预留：在某些平台上可结合远程调试页查看 console
        self.open_remote_debug()

    def view_page_source(self):
        # 预留：可通过 remote debug 查看源码
        self.open_remote_debug()

    def open_javascript_console(self):
        """打开JavaScript控制台"""
        try:
            if self.web_page:
                self.web_page.runJavaScript("console.clear(); console.log('JavaScript控制台已激活');")
            self.show_inspector()
            self.status_bar.showMessage("JavaScript控制台已激活")
        except Exception as e:
            self.status_bar.showMessage(f"激活JavaScript控制台失败: {str(e)}")

    def view_page_source(self):
        """查看页面源码"""
        try:
            if self.web_page:
                self.web_page.toHtml(self._on_page_source_loaded)
            self.status_bar.showMessage("正在获取页面源码...")
        except Exception as e:
            self.status_bar.showMessage(f"获取页面源码失败: {str(e)}")

    def _on_page_source_loaded(self, html):
        """页面源码加载完成回调"""
        try:
            from PyQt6.QtWidgets import QDialog, QTextEdit, QVBoxLayout, QPushButton

            # 创建源码查看窗口
            dialog = QDialog(self)
            dialog.setWindowTitle("页面源码")
            dialog.setGeometry(200, 200, 800, 600)

            # 创建文本编辑器
            text_edit = QTextEdit()
            text_edit.setPlainText(html)
            text_edit.setReadOnly(True)

            # 创建关闭按钮
            close_button = QPushButton("关闭")
            close_button.clicked.connect(dialog.close)

            # 设置布局
            layout = QVBoxLayout()
            layout.addWidget(text_edit)
            layout.addWidget(close_button)

            dialog.setLayout(layout)
            dialog.exec_()

            self.status_bar.showMessage("页面源码查看完成")

        except Exception as e:
            self.status_bar.showMessage(f"显示页面源码失败: {str(e)}")

    def resizeEvent(self, event):
        """窗口大小调整事件"""
        super().resizeEvent(event)
        # 确保WebView正确响应窗口大小变化
        if self.web_view:
            # 强制更新布局
            self.web_view.updateGeometry()

    def closeEvent(self, event):
        """窗口关闭事件"""
        # 关闭Inspector窗口
        if self.inspector_window:
            self.inspector_window.close()
        event.accept()
