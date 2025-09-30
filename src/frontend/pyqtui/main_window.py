"""
主窗口类
负责创建和管理应用程序的主界面
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
    """Append a JavaScript console line to the specified log file.

    备用日志记录函数，仅在JSConsoleLogger不可用时使用。
    包含消息去重和格式化逻辑。
    """
    if not log_file_path:
        return

    try:
        import re
        path = Path(log_file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime('%H:%M:%S.%f')[:-3]

        # 解析消息内容，避免重复的时间戳和日志级别/来源噪声
        parsed_message = str(message)

        # 检查是否已有时间戳格式 [YYYY-MM-DDTHH:MM:SS.xxxZ]
        timestamp_pattern = r'^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]'
        timestamp_match = re.match(timestamp_pattern, parsed_message)
        if timestamp_match:
            # 移除时间戳，因为日志系统会添加自己的时间戳
            parsed_message = parsed_message[len(timestamp_match.group(0)):].strip()

        # 检查是否已有日志级别标记 [INFO]、[WARN]、[ERROR]、[DEBUG] 等
        level_pattern = r'^\[([A-Z]+)\]'
        level_match = re.match(level_pattern, parsed_message)
        if level_match:
            embedded_level = level_match.group(1)
            # 如果消息内已有级别，使用它而不是Qt级别
            if embedded_level in ['INFO', 'WARN', 'WARNING', 'ERROR', 'DEBUG', 'CRITICAL']:
                level = embedded_level if embedded_level != 'WARNING' else 'WARN'
                # 移除消息中的级别标记，避免重复
                parsed_message = parsed_message[len(level_match.group(0)):].strip()
        else:
            # 简化日志级别前缀（兼容大小写/不同格式）
            # 例如: JavaScriptConsoleMessageLevel.InfoMessageLevel / JAVASCRIPTCONSOLEMESSAGELEVEL.INFOMESSAGELEVEL
            _lv = str(level)
            _lv_lower = _lv.lower()
            if 'javascriptconsolemessagelevel' in _lv_lower:
                if 'infomessagelevel' in _lv_lower:
                    level = 'INFO'
                elif 'warningmessagelevel' in _lv_lower:
                    level = 'WARN'
                elif 'errormessagelevel' in _lv_lower:
                    level = 'ERROR'
                elif 'criticalmessagelevel' in _lv_lower:
                    level = 'CRITICAL'
                else:
                    # 回退从最后一段推断
                    try:
                        tail = _lv_lower.split('.')[-1]
                        level = tail.replace('messagelevel', '').upper()
                    except Exception:
                        level = 'INFO'

        # 移除消息开头由某些环境附加的冗余方括号片段（如 JS Console Level、URL 源路径等）
        # 例如: [JAVASCRIPTCONSOLEMESSAGELEVEL.INFOMESSAGELEVEL] [http://localhost:3000/xxx:87]
        cleanup_patterns = [
            r'^\[\s*JavaScriptConsoleMessageLevel\.[^\]]+\]\s*',
            r'^\[\s*JAVASCRIPTCONSOLEMESSAGELEVEL\.[^\]]+\]\s*',
            r'^\[\s*(?:https?|file)://[^\]]+\]\s*'
        ]
        for pat in cleanup_patterns:
            parsed_message = re.sub(pat, '', parsed_message, flags=re.IGNORECASE)
        parsed_message = parsed_message.strip()

        # 优化输出格式：移除源文件路径和行号
        # 这���信息通常不重要，只会增加日志噪音
        # 如果需要调试特定文件，可以从消息内容中的模块名判断
        line = f"[{ts}][{level}] {parsed_message}"
        with path.open('a', encoding='utf-8') as handle:
            handle.write(line + '\n')
    except Exception:
        # Avoid raising from logging helpers; surface issues via console only
        pass


class MainWindow(QMainWindow):
    """主窗口类"""
    send_debug_message_requested = pyqtSignal()
    # 定义信号
    web_loaded = pyqtSignal()

    def __init__(self,app, remote_debug_port: int | None = None, js_log_file: str | None = None):
        """初始化主窗口"""
        super().__init__()
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9222
        self._js_log_file = js_log_file
        # 窗口属性
        self.setWindowTitle("Anki LinkMaster PDFJS")
        self.setGeometry(100, 100, 1200, 800)

        # QtWebEngine Inspector设置
        self.inspector_window = None

        # 初始化UI
        self._init_ui()
        self._init_menu()
        self._init_status_bar()

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
        # 注意：WebSecurityEnabled 在当前PyQt6版本中可能不存在，已移除
        if self.web_view and QWebEngineSettings:
            settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.XSSAuditingEnabled, True)

        # 创建自定义页面以支持Inspector
        if self.web_view and QWebEnginePage:
            # 自定义页面以捕获前端console输出
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
                        line_number=lineNumber,
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
        debug_menu = menubar.addMenu('调试,通过ws发送消息到前端')
        debug_action = QAction('发送消息', self)
        debug_action.triggered.connect(self.send_debug_message_requested.emit)
        debug_menu.addAction(debug_action)


        # 文件菜单
        file_menu = menubar.addMenu('文件')

        # 添加退出动作
        exit_action = QAction('退出', self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # 视图菜单
        view_menu = menubar.addMenu('视图')

        # 刷新动作
        refresh_action = QAction('刷新', self)
        refresh_action.triggered.connect(self.reload_page)
        view_menu.addAction(refresh_action)

        # 开发者菜单
        dev_menu = menubar.addMenu('开发者')

        # 开发者工具
        inspector_action = QAction('开发者工具 (F12)', self)
        inspector_action.setShortcut('F12')
        inspector_action.triggered.connect(self.toggle_inspector)
        dev_menu.addAction(inspector_action)

        # 远程调试
        remote_debug_action = QAction('打开远程调试', self)
        remote_debug_action.triggered.connect(self.open_remote_debug)
        dev_menu.addAction(remote_debug_action)

        # JavaScript控制台
        console_action = QAction('JavaScript控制台 (Ctrl+Shift+J)', self)
        console_action.setShortcut('Ctrl+Shift+J')
        console_action.triggered.connect(self.open_javascript_console)
        dev_menu.addAction(console_action)

        # 页面源码
        source_action = QAction('查看页面源码 (Ctrl+U)', self)
        source_action.setShortcut('Ctrl+U')
        source_action.triggered.connect(self.view_page_source)
        dev_menu.addAction(source_action)

    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")

    def load_frontend(self, url="http://localhost:3000/pdf-viewer/index.html"):
        """加载前端页面"""
        try:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f"正在加载: {url}")
        except Exception as e:
            self.status_bar.showMessage(f"加载失败: {str(e)}")

    def reload_page(self):
        """重新加载当前页面"""
        if self.web_view:
            self.web_view.reload()

    def _on_web_loaded(self, success):
        """页面加载完成回调"""
        if success:
            self.status_bar.showMessage("页面加载完成")
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage("页面加载失败")

    def show_error(self, message):
        """显示错误信息"""
        self.status_bar.showMessage(f"错误: {message}")

    def toggle_inspector(self):
        """切换开发者工具显示"""
        if self.inspector_window is None or not self.inspector_window.isVisible():
            self.show_inspector()
        else:
            self.hide_inspector()

    def show_inspector(self):
        """显示开发者工具"""
        try:
            from PyQt6.QtWebEngineWidgets import QWebEngineView
            from PyQt6.QtWidgets import QMainWindow

            if self.inspector_window is None:
                # 创建Inspector窗口
                self.inspector_window = QMainWindow(self)
                self.inspector_window.setWindowTitle("开发者工具")
                self.inspector_window.setGeometry(1300, 100, 800, 600)

                # 创建Inspector视图
                self.inspector_view = QWebEngineView()
                self.inspector_window.setCentralWidget(self.inspector_view)

            # 显示Inspector
            self.inspector_window.show()
            self.inspector_window.raise_()
            self.inspector_window.activateWindow()

            # 设置Inspector URL
            inspector_url = "http://localhost:9222"
            self.inspector_view.load(QUrl(inspector_url))

            self.status_bar.showMessage("开发者工具已打开")

        except Exception as e:
            self.status_bar.showMessage(f"打开开发者工具失败: {str(e)}")

    def hide_inspector(self):
        """隐藏开发者工具"""
        if self.inspector_window:
            self.inspector_window.hide()
            self.status_bar.showMessage("开发者工具已关闭")

    def open_remote_debug(self):
        """打开远程调试页面"""
        import webbrowser
        try:
            webbrowser.open("http://localhost:9222")
            self.status_bar.showMessage("远程调试页面已打开")
        except Exception as e:
            self.status_bar.showMessage(f"打开远程调试失败: {str(e)}")

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
