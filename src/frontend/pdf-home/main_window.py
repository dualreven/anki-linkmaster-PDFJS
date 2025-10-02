"""
PDF-Home主窗口模块

集成JavaScript控制台日志记录功能的主窗口实现。
自动将javaScriptConsoleMessage传递给JSConsoleLogger进行处理。
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


class MainWindow(QMainWindow):
    """PDF-Home主窗口"""
    send_debug_message_requested = pyqtSignal()
    web_loaded = pyqtSignal()

    def __init__(self, app, remote_debug_port: int | None = None, js_log_file: str | None = None, js_logger=None):
        """初始化主窗口

        Args:
            app: QApplication实例
            remote_debug_port: 远程调试端口
            js_log_file: JS日志文件路径
            js_logger: JSConsoleLogger实例（可选）
        """
        super().__init__()
        self.parent = app
        self._remote_debug_port = remote_debug_port or 9222
        self._js_log_file = js_log_file
        self.js_logger = js_logger  # 简化版Logger实例

        # 窗口属性
        self.setWindowTitle("Anki LinkMaster PDFJS")
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
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, False)
            settings.setAttribute(QWebEngineSettings.WebAttribute.XSSAuditingEnabled, True)

        # 创建自定义页面
        if self.web_view and QWebEnginePage:
            try:
                from PyQt6.QtWebEngineCore import QWebEnginePage as _QWEP  # type: ignore
            except Exception:
                _QWEP = QWebEnginePage

            class LoggingWebPage(_QWEP):
                def __init__(self, parent, log_file_path: str | None, js_logger=None):
                    super().__init__(parent)
                    self._log_file_path = log_file_path
                    self.js_logger = js_logger

                    try:
                        if self._log_file_path:
                            import os as _os
                            _os.makedirs(_os.path.dirname(self._log_file_path), exist_ok=True)
                    except Exception:
                        pass

                def _write_simple_log(self, log_file_path, level, message, line_number, source_id):
                    """简单的日志写入功能，替代 write_js_console_message"""
                    try:
                        from datetime import datetime
                        ts = datetime.now().strftime('%H:%M:%S.%f')[:-3]

                        # 简化源文件路径
                        source_filename = source_id.split('/')[-1] if '/' in source_id else source_id

                        # 简化日志级别
                        if 'InfoMessageLevel' in level:
                            level = 'INFO'
                        elif 'WarningMessageLevel' in level:
                            level = 'WARN'
                        elif 'ErrorMessageLevel' in level:
                            level = 'ERROR'
                        else:
                            level = str(level).upper()

                        log_line = f"[{ts}][{level}][{source_filename}:{line_number}] {message}\n"

                        with open(log_file_path, 'a', encoding='utf-8') as f:
                            f.write(log_line)
                    except Exception:
                        pass  # 静默失败，避免日志错误影响主程序

                def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):  # type: ignore
                    """控制台消息处理"""
                    # 过滤掉"Console log recorded successfully"响应
                    if "Console log recorded successfully" in str(message):
                        return None

                    # 使用 JSConsoleLogger 记录日志
                    if self.js_logger and hasattr(self.js_logger, 'log_message'):
                        try:
                            self.js_logger.log_message(
                                level=str(level),
                                message=str(message),
                                source=str(sourceID) if sourceID else "",
                                line=lineNumber
                            )
                        except Exception as e:
                            print(f"Warning: Failed to pass message to js_logger: {e}")
                    else:
                        # 如果没有 js_logger，直接写入日志文件
                        if self._log_file_path:
                            try:
                                self._write_simple_log(
                                    self._log_file_path,
                                    level=str(level),
                                    message=str(message),
                                    line_number=lineNumber,
                                    source_id=str(sourceID)
                                )
                            except Exception as e:
                                print(f"Warning: Failed to write log: {e}")

                    try:
                        return super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)  # type: ignore
                    except Exception:
                        return None

            self.web_page = LoggingWebPage(self.web_view, self._js_log_file, self.js_logger)
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

    def _init_status_bar(self):
        """初始化状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage('准备就绪')

    def _on_web_loaded(self, success: bool):
        """网页加载完成处理"""
        if success:
            self.status_bar.showMessage('页面加载完成')
            self.web_loaded.emit()
        else:
            self.status_bar.showMessage('页面加载失败')

    def load_frontend(self, url: str):
        """加载前端URL"""
        if self.web_view:
            self.web_view.load(QUrl(url))
            self.status_bar.showMessage(f'正在加载: {url}')

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

        try:
            # 获取项目根目录
            project_root = Path(__file__).parent.parent.parent.parent

            # 第一步：从 frontend-process-info.json 中移除当前窗口的 PID
            # 这样 ai_launcher.py stop 就不会杀掉窗口自己
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

            # 第二步：调用 ai_launcher.py stop 停止后台服务
            ai_launcher_path = project_root / 'ai_launcher.py'
            if ai_launcher_path.exists():
                print(f"[MainWindow] 正在停止后台服务...")
                result = subprocess.run(
                    [sys.executable, str(ai_launcher_path), 'stop'],
                    cwd=str(project_root),
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                if result.returncode == 0:
                    print(f"[MainWindow] 后台服务已停止")
                else:
                    print(f"[MainWindow] 停止服务时出现警告: {result.stderr}")
            else:
                print(f"[MainWindow] 找不到 ai_launcher.py，跳过服务停止")

        except Exception as e:
            print(f"[MainWindow] 停止服务失败: {e}")
        finally:
            # 接受关闭事件，让窗口优雅关闭
            event.accept()